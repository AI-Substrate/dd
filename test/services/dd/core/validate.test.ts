import { describe, expect, it } from 'vitest';
import type { DdDoc, ResolvedDdSchema } from '../../../../src/core/model.js';
import {
  collectFileRefs,
  type DdIssue,
  type FileExistence,
  type SchemaResolver,
  validateDocument,
  validateFileRefs,
} from '../../../../src/core/validate.js';
import { FixtureSchemaResolver, fixtureDoc } from '../helpers.js';

const resolver = new FixtureSchemaResolver();

function issues(relative: string): DdIssue[] {
  return validateDocument(fixtureDoc(relative), `/repo/${relative}`, resolver, '/repo');
}

function expectIssue(
  relative: string,
  issueClass: DdIssue['class'],
  severity: DdIssue['severity'],
) {
  expect(issues(relative)).toEqual(
    expect.arrayContaining([expect.objectContaining({ class: issueClass, severity })]),
  );
}

describe('dd-core depth-zero validation', () => {
  it.each([
    ['invalid/duplicate-id.dd.json', 'duplicate-id'],
    ['invalid/malformed-minted-id.dd.json', 'id-invalid'],
    ['invalid/malformed-address.dd.json', 'address-malformed'],
    ['invalid/unresolvable-schema.dd.json', 'schema-unresolvable'],
    ['invalid/blocked-note-missing.dd.json', 'state-note-required'],
    ['invalid/na-note-missing.dd.json', 'state-note-required'],
    ['invalid/human-skipped-receipt-missing.dd.json', 'human-skipped-receipt-required'],
    ['invalid/bad-enum.dd.json', 'enum-invalid'],
    ['invalid/link-type-mismatch.dd.json', 'link-type-mismatch'],
  ] as const)('%s reports exact ERROR class %s', (relative, issueClass) => {
    expectIssue(relative, issueClass, 'ERROR');
  });

  /**
   * The whole-file form in a cell that may not hold one, on the shape with no
   * declared type to be rejected against.
   *
   * The fixture above stays a GRAMMAR failure (an empty interior segment), so it
   * says nothing about this case: an untargeted cell holding a bare path parses
   * cleanly and is refused by the link-cell contract instead. That is the shape a
   * lost `#` most often takes, and the one place where widening the grammar could
   * have quietly turned an ERROR into a missing-file WARN. Its typed twin —
   * link-type-mismatch with zero existence probes — is pinned in `walk.test.ts`.
   */
  it('refuses the whole-file form in an untargeted link cell', () => {
    const doc: DdDoc = {
      dd: { schema: 'test/untargeted' },
      sections: [{ name: 'see_also', value: 'plan.dd.jsontasks' }],
      references: [],
    };
    const untargetedResolver: SchemaResolver = {
      resolve: () => ({
        ok: true,
        schema: { name: 'test/untargeted', sections: { see_also: { shape: { type: 'link' } } } },
      }),
    };
    expect(validateDocument(doc, '/repo/plan.dd.json', untargetedResolver, '/repo')).toEqual([
      {
        class: 'address-malformed',
        severity: 'ERROR',
        location: '$.sections[see_also].value',
        message: 'address must contain exactly one "#" file/interior boundary',
        owner: '/repo/plan.dd.json',
      },
    ]);
  });

  it.each([
    'valid/base.dd.json',
    'valid/minted-id.dd.json',
    'valid/state-notes.dd.json',
    'valid/custom-enum.dd.json',
  ])('%s has no ERROR findings', (relative) => {
    expect(issues(relative).filter((issue) => issue.severity === 'ERROR')).toEqual([]);
  });

  it.each([
    ['warn/absolute-path.dd.json', 'address-path-absolute'],
    ['warn/non-posix-path.dd.json', 'address-path-non-posix'],
    ['warn/path-escape.dd.json', 'address-path-escape'],
  ] as const)('%s reports WARN, never ERROR, for %s', (relative, issueClass) => {
    const result = issues(relative);
    expect(result).toEqual(
      expect.arrayContaining([expect.objectContaining({ class: issueClass, severity: 'WARN' })]),
    );
    expect(
      result.filter((issue) => issue.class === issueClass && issue.severity === 'ERROR'),
    ).toEqual([]);
  });

  it('hand-rolls required-field shape conformance', () => {
    const doc: DdDoc = {
      dd: { schema: 'test/plan' },
      sections: [{ name: 'tasks', value: [{ id: 'tk-a1b2', state: 'checked' }] }],
      references: [],
    };
    expect(validateDocument(doc, '/repo/shape.dd.json', resolver, '/repo')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          class: 'schema-shape',
          severity: 'ERROR',
          location: '$.sections[tasks].value[0].title',
          owner: '/repo/shape.dd.json',
        }),
      ]),
    );
  });

  it('accepts custom field types that have no declared validation vocabulary', () => {
    const doc: DdDoc = {
      dd: { schema: 'test/custom' },
      sections: [{ name: 'content', value: { payload: { arbitrary: true } } }],
      references: [],
    };
    const customResolver = {
      resolve: () => ({
        ok: true as const,
        schema: {
          name: 'test/custom',
          sections: {
            content: {
              shape: {
                type: 'object',
                required: ['payload'],
                fields: { payload: { type: 'custom-card' } },
              },
            },
          },
        },
      }),
    };
    expect(validateDocument(doc, '/repo/custom.dd.json', customResolver, '/repo')).toEqual([]);
  });

  it('applies note rules when a state is the section value', () => {
    const doc: DdDoc = {
      dd: { schema: 'test/direct-state' },
      sections: [{ name: 'status', value: 'blocked' }],
      references: [],
    };
    const directStateResolver = {
      resolve: () => ({
        ok: true as const,
        schema: {
          name: 'test/direct-state',
          sections: { status: { shape: { type: 'state' } } },
        },
      }),
    };
    expect(
      validateDocument(doc, '/repo/direct-state.dd.json', directStateResolver, '/repo'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          class: 'state-note-required',
          severity: 'ERROR',
          location: '$.sections[status].value.note',
        }),
      ]),
    );
  });
});

/**
 * wl-0023 — the file-reference population and the existence contract.
 *
 * The trap this suite is written against (BRIEF § The trap): "a link to a
 * missing file produces a warn" passes against an implementation that warns on
 * EVERYTHING. So every existence assertion here comes in both directions, and
 * the negative population is asserted as a population — not as a couple of edge
 * cases — because a broad regex that swallows URLs, images or bare prose paths
 * passes every happy-path test ever written for this feature.
 */
describe('dd-core file references', () => {
  const FILE_SCHEMA: ResolvedDdSchema = {
    name: 'test/files',
    sections: {
      rows: {
        shape: {
          type: 'array',
          items: {
            type: 'object',
            fields: {
              id: { type: 'string' },
              implemented_by: {
                type: 'array',
                items: { type: 'link', target: 'file', rel: 'implemented_by' },
              },
              note: { type: 'text' },
              // Not `text`: the same Markdown here must never be discovered.
              label: { type: 'string' },
            },
          },
        },
      },
    },
  };

  const filesResolver: SchemaResolver = {
    resolve: () => ({ ok: true, schema: FILE_SCHEMA }),
  };

  function docWith(row: Record<string, unknown>): DdDoc {
    return {
      dd: { schema: FILE_SCHEMA.name },
      sections: [{ name: 'rows', value: [{ id: 'ac-1a2b', ...row }] }],
      references: [],
    };
  }

  /** Records every path it was asked about; `present` is the only thing that exists. */
  class ExistenceStub implements FileExistence {
    readonly asked: string[] = [];
    constructor(private readonly present: readonly string[] = []) {}
    exists(path: string): boolean {
      this.asked.push(path);
      return this.present.includes(path);
    }
  }

  function findingsFor(
    row: Record<string, unknown>,
    present: readonly string[] = [],
    fromPath = '/repo/docs/plan.dd.json',
  ) {
    const probe = new ExistenceStub(present);
    const refs = collectFileRefs(docWith(row), FILE_SCHEMA);
    return { refs, probe, issues: validateFileRefs(refs, fromPath, '/repo', probe) };
  }

  it('collects one structured cell per target:file value, repo-based, keeping the schema relation', () => {
    const { refs } = findingsFor({
      implemented_by: ['src/search/index.ts', 'docs/adr/0007-search.md'],
    });
    expect(refs).toEqual([
      {
        raw: 'src/search/index.ts',
        location: '$.sections[rows].value[0].implemented_by[0]',
        base: 'repo',
        rel: 'implemented_by',
      },
      {
        raw: 'docs/adr/0007-search.md',
        location: '$.sections[rows].value[0].implemented_by[1]',
        base: 'repo',
        rel: 'implemented_by',
      },
    ]);
  });

  it('collects one incidental reference per inline Markdown link in declared text, document-based', () => {
    const { refs } = findingsFor({
      note: 'the hot path is [the query planner](planner.ts), see also [notes](../notes.md)',
    });
    expect(refs).toEqual([
      {
        raw: 'planner.ts',
        location: '$.sections[rows].value[0].note',
        base: 'document',
        rel: 'ref',
      },
      {
        raw: '../notes.md',
        location: '$.sections[rows].value[0].note',
        base: 'document',
        rel: 'ref',
      },
    ]);
  });

  it.each([
    ['an absolute URL', '[docs](https://example.com/a.md)'],
    ['a scheme-only destination', '[mail](mailto:someone@example.com)'],
    ['a fragment-only link', '[back](#tasks)'],
    ['an image', '![diagram](diagram.png)'],
    ['a reference-style link', '[planner][planner-ref]'],
    ['malformed syntax', '[planner](planner.ts'],
    ['a bare path in prose', 'the hot path is src/search/planner.ts and it is fast'],
  ])('excludes %s from the incidental population', (_label, note) => {
    expect(findingsFor({ note }).refs).toEqual([]);
  });

  it('never scans a field the schema did not declare as text', () => {
    // Byte-identical Markdown to the positive case above — the ONLY difference is
    // the declared shape, which is what makes this an assertion about scoping
    // rather than about the regex.
    const markdown = 'the hot path is [the query planner](planner.ts)';
    expect(findingsFor({ note: markdown }).refs).toHaveLength(1);
    expect(findingsFor({ label: markdown }).refs).toEqual([]);
  });

  it('reads a backticked example as code and the real link beside it as a link', () => {
    // Both spellings in ONE value, so this cannot pass by discovering nothing:
    // the assertion is that the extractor tells them apart, not that it is quiet.
    const { refs } = findingsFor({
      note: 'An inline `[label](local/path)` in declared text links, as [notes](../notes.md) does.',
    });
    expect(refs.map((ref) => ref.raw)).toEqual(['../notes.md']);
  });

  it.each([
    ['a single-backtick span', 'see `[label](local/path)` for the form'],
    ['a double-backtick span', 'see ``[label](local/path)`` for the form'],
    ['a fenced block', 'the form is:\n```\n[label](local/path)\n```\nand nothing more'],
    ['a span holding several links', '`[a](a.ts) and [b](b.ts)` are both examples'],
  ])('ignores Markdown inside %s', (_label, note) => {
    expect(findingsFor({ note }).refs).toEqual([]);
  });

  it('rejects a candidate whose closing delimiter was written as code', () => {
    // The form LOOKS closed and is not: the `[` is prose, but the `](` that
    // would close it sits inside the span opened after `label`. An
    // opening-bracket-only test collects `crossing.ts` here, so the real link
    // beside it is the control that keeps this from passing by silence.
    const { refs } = findingsFor({
      note: 'the [label` code](crossing.ts)` example, and [notes](../notes.md) beside it',
    });
    expect(refs.map((ref) => ref.raw)).toEqual(['../notes.md']);
  });

  it('keeps a link whose label merely contains code', () => {
    // This OVERLAPS a code span and is still a link — the span is label
    // CONTENT, and both structural delimiters are outside it. Rejecting on
    // overlap rather than on the delimiters would drop this one, which is why
    // the boundary is drawn at the delimiters and not at the match range.
    const { refs } = findingsFor({ note: '[label with `code`](real.ts) is a link' });
    expect(refs.map((ref) => ref.raw)).toEqual(['real.ts']);
  });

  it('treats an unmatched backtick as prose, not as a span that runs to the end', () => {
    // The failure this forbids is silent: if a stray backtick opened a span with
    // no closer, every real link after it would vanish from the population and
    // the document would look clean because nothing was looked at.
    const { refs } = findingsFor({
      note: 'the ` is a backtick, and [notes](../notes.md) is still a link',
    });
    expect(refs.map((ref) => ref.raw)).toEqual(['../notes.md']);
  });

  /**
   * The path-base mismatch (dossier § Risks). Both cells name the SAME spelling
   * from a document nested two directories deep, and they must resolve to two
   * different files — otherwise one arm is silently checking the wrong thing and
   * every test that uses a repo-root document would pass anyway.
   */
  it('resolves structured cells from the repository root and Markdown from the document', () => {
    const { probe } = findingsFor(
      { implemented_by: ['a.ts'], note: '[a](a.ts)' },
      [],
      '/repo/docs/plans/plan.dd.json',
    );
    expect(probe.asked).toEqual(['/repo/a.ts', '/repo/docs/plans/a.ts']);
  });

  it('drops a Markdown fragment before probing, and still quotes what the author wrote', () => {
    const { probe, issues } = findingsFor({ note: '[intro](notes.md#intro)' });
    expect(probe.asked).toEqual(['/repo/docs/notes.md']);
    expect(issues).toEqual([
      expect.objectContaining({ message: 'file link target is missing: notes.md#intro' }),
    ]);
  });

  it('reports exactly one WARN naming the authored path, location and owner', () => {
    const { issues } = findingsFor({ implemented_by: ['src/search/index.ts'] });
    expect(issues).toEqual([
      {
        class: 'address-target-missing',
        severity: 'WARN',
        location: '$.sections[rows].value[0].implemented_by[0]',
        message: 'file link target is missing: src/search/index.ts',
        owner: '/repo/docs/plan.dd.json',
      },
    ]);
  });

  /**
   * Existing → missing → existing, over ONE unchanged document. A validator that
   * warns on everything fails the first arm; one that warns on nothing fails the
   * second; and the third proves the difference was the world and not the input.
   */
  it('says nothing for a target that exists, warns once when it goes away, and goes quiet again', () => {
    const row = { implemented_by: ['src/search/index.ts'], note: '[planner](planner.ts)' };
    const world = ['/repo/src/search/index.ts', '/repo/docs/planner.ts'];
    expect(findingsFor(row, world).issues).toEqual([]);
    expect(findingsFor(row, ['/repo/docs/planner.ts']).issues).toHaveLength(1);
    expect(findingsFor(row, world).issues).toEqual([]);
  });

  it('reports an escape without probing outside the repository', () => {
    const { probe, issues } = findingsFor({ implemented_by: ['../../secrets.txt'] });
    expect(probe.asked).toEqual([]);
    expect(issues).toEqual([
      expect.objectContaining({ class: 'address-path-escape', severity: 'WARN' }),
    ]);
  });

  it('rejects a target:file cell that names an interior, on type', () => {
    expect(
      validateDocument(
        docWith({ implemented_by: ['src/search/index.ts#parseThing'] }),
        '/repo/docs/plan.dd.json',
        filesResolver,
        '/repo',
      ),
    ).toEqual([
      expect.objectContaining({
        class: 'link-type-mismatch',
        severity: 'ERROR',
        message: 'link targets a document interior, expected "file"',
      }),
    ]);
  });

  it('leaves a well-formed target:file cell alone in the pure pass', () => {
    expect(
      validateDocument(
        docWith({ implemented_by: ['src/search/index.ts'] }),
        '/repo/docs/plan.dd.json',
        filesResolver,
        '/repo',
      ),
    ).toEqual([]);
  });
});
