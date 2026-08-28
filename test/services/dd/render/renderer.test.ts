import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deriveState } from '../../../../src/core/derive.js';
import type { DdDoc, ResolvedDdSchema } from '../../../../src/core/model.js';
import { parse } from '../../../../src/core/parse.js';
import type {
  DdAdapterContext,
  DdAdapterIssue,
  DdAdapterSet,
} from '../../../../src/render/contract.js';
import {
  headingSlug,
  MAX_CELL_DEPTH,
  RENDER_BANNER,
  renderDd,
} from '../../../../src/render/renderer.js';
import { parseSchemaDeclaration } from '../../../../src/schema/declarations.js';

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

function read(relative: string): string {
  return readFileSync(`${FIXTURES}${relative}`, 'utf8');
}

function doc(relative: string): DdDoc {
  const parsed = parse(read(relative));
  if (Array.isArray(parsed)) throw new Error(`fixture is not a dd document: ${relative}`);
  return parsed;
}

function schema(
  relative: string,
  name: string,
): { schema: ResolvedDdSchema; gateTerminal: readonly string[] } {
  const declaration = parseSchemaDeclaration(read(relative), name, `${FIXTURES}${relative}`);
  if (!declaration.ok) {
    throw new Error(`fixture schema failed to parse: ${JSON.stringify(declaration.issues)}`);
  }
  return {
    schema: declaration.declaration.schema,
    gateTerminal: declaration.declaration.gateTerminal,
  };
}

/**
 * Fake adapter set (house rule: fakes, never `vi.mock`). T002 proves the renderer
 * honours the W1 contract; T004 re-proves this same golden through the REAL
 * jiti-loaded fixture adapters, so the golden is never left resting on a fake.
 */
class FakeAdapters implements DdAdapterSet {
  readonly issues: DdAdapterIssue[] = [];
  readonly calls: DdAdapterContext[] = [];

  constructor(private readonly handlers: Record<string, (value: unknown) => string | null> = {}) {}

  render(value: unknown, ctx: DdAdapterContext): string | null {
    this.calls.push(ctx);
    const handler = this.handlers[ctx.type];
    if (!handler) {
      this.issues.push({
        class: 'adapter-not-found',
        severity: 'WARN',
        type: ctx.type,
        message: `no adapter for "${ctx.type}"`,
        location: ctx.location,
      });
      return null;
    }
    return handler(value);
  }
}

function durationAdapters(): FakeAdapters {
  return new FakeAdapters({
    duration: (value) => {
      const minutes = Number(value);
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return hours > 0 ? `**${hours}h ${rest}m**` : `**${rest}m**`;
    },
  });
}

describe('renderDd — golden corpus', () => {
  it('renders the showcase document byte-for-byte', () => {
    const path = 'showcase/repo/docs/showcase.dd.json';
    const resolved = schema(
      'showcase/repo/.dd/schemas/render/showcase/schema.json',
      'render/showcase',
    );
    const output = renderDd(doc(path), {
      path: `/absolute/and/irrelevant/${path}`,
      schema: resolved.schema,
      gateTerminal: resolved.gateTerminal,
      adapters: durationAdapters(),
    });
    expect(output).toEqual(read('showcase/repo/docs/showcase.dd.md'));
  });

  it('renders the drift fixture to its correct (not hand-edited) form', () => {
    const resolved = schema('drift/repo/.dd/schemas/render/simple/schema.json', 'render/simple');
    const output = renderDd(doc('drift/repo/docs/drift.dd.json'), {
      path: 'drift.dd.json',
      schema: resolved.schema,
      gateTerminal: resolved.gateTerminal,
    });
    expect(output).toEqual(read('drift/repo/docs/drift.expected.md'));
    expect(output).not.toEqual(read('drift/repo/docs/drift.dd.md'));
  });

  it('renders the transclusion chain, taking the cross-file summary as a precomputed input', () => {
    const resolved = schema('chain/repo/.dd/schemas/render/chain/schema.json', 'render/chain');
    const source = doc('chain/repo/docs/source.dd.json');
    expect(
      renderDd(source, {
        path: 'chain/repo/docs/source.dd.json',
        schema: resolved.schema,
        gateTerminal: resolved.gateTerminal,
      }),
    ).toEqual(read('chain/repo/docs/source.dd.md'));

    const items = source.sections.find((section) => section.name === 'items');
    if (!items) throw new Error('source fixture lost its items section');
    const output = renderDd(doc('chain/repo/docs/consumer.dd.json'), {
      path: 'chain/repo/docs/consumer.dd.json',
      schema: resolved.schema,
      gateTerminal: resolved.gateTerminal,
      derived: new Map([['source.dd.json#items', deriveState(items, resolved.gateTerminal)]]),
    });
    expect(output).toEqual(read('chain/repo/docs/consumer.dd.md'));
  });

  it('collapses a nested cell exactly at MAX_CELL_DEPTH and no sooner', () => {
    const resolved = schema('limits/repo/.dd/schemas/render/limits/schema.json', 'render/limits');
    const output = renderDd(doc('limits/repo/docs/limits.dd.json'), {
      path: 'limits/repo/docs/limits.dd.json',
      schema: resolved.schema,
      gateTerminal: resolved.gateTerminal,
    });
    expect(output).toEqual(read('limits/repo/docs/limits.dd.md'));
    expect(MAX_CELL_DEPTH).toBe(2);
    // The bound is real, not decorative: one row sits at it, the next crosses it.
    expect(output).toContain('nested: (b: 2) |');
    expect(output).toContain('deeper: ⟨…⟩');
  });
});

describe('renderDd — determinism and purity of output', () => {
  it('produces identical bytes across runs and ignores everything but the path basename', () => {
    const resolved = schema('drift/repo/.dd/schemas/render/simple/schema.json', 'render/simple');
    const source = doc('drift/repo/docs/drift.dd.json');
    const first = renderDd(source, { path: '/one/place/drift.dd.json', schema: resolved.schema });
    const second = renderDd(source, {
      path: 'C:\\another\\place\\drift.dd.json',
      schema: resolved.schema,
    });
    expect(first).toEqual(second);
    expect(first).toContain('**Source**: drift.dd.json');
    expect(first.startsWith(`${RENDER_BANNER}\n`)).toBe(true);
    expect(first.endsWith('\n')).toBe(true);
  });
});

describe('renderDd — render rules', () => {
  const simple = () => schema('drift/repo/.dd/schemas/render/simple/schema.json', 'render/simple');

  function renderSections(sections: DdDoc['sections'], override: Partial<ResolvedDdSchema> = {}) {
    const base = simple();
    return renderDd(
      { dd: { schema: 'render/simple' }, sections, references: [] },
      { path: 'doc.dd.json', schema: { ...base.schema, ...override } },
    );
  }

  it('titles the document from the first section carrying a title, else the filename', () => {
    expect(renderSections([{ name: 'meta', value: { title: 'From meta' } }])).toContain(
      '# From meta',
    );
    expect(renderSections([{ name: 'items', value: [] }])).toContain('# doc.dd.json');
  });

  it('pips a gate-terminal enum but leaves a plain vocabulary enum unpipped', () => {
    const output = renderSections([{ name: 'meta', value: { grade: 'shipped', mood: 'calm' } }], {
      enums: {
        grade: { values: ['draft', 'shipped'], gate_terminal: ['shipped'] },
        mood: { values: ['calm', 'tense'] },
      },
      sections: {
        meta: {
          shape: {
            type: 'object',
            fields: {
              grade: { type: 'enum', enum: 'grade' },
              mood: { type: 'enum', enum: 'mood' },
            },
          },
        },
      },
    });
    expect(output).toContain('| grade | [x] shipped |');
    expect(output).toContain('| mood | calm |');
  });

  it('renders an undeclared interior, pipping a structurally-named state field (A3)', () => {
    const output = renderSections([
      { name: 'evidence', value: { 'tk-1': [{ id: 'dw-1', state: 'blocked', why: 'no proof' }] } },
    ]);
    expect(output).toContain('### tk-1');
    expect(output).toContain('| id | state | why |');
    expect(output).toContain('| dw-1 | [-] blocked | no proof |');
  });

  it('titles a section by document, then schema, then derivation from its name', () => {
    // Tier 3 — nothing declared anywhere: the machine key becomes a heading a
    // human wants to read, so a schema gets decent headings for free.
    expect(renderSections([{ name: 'non_goals', value: ['a'] }])).toContain('## Non goals');
    expect(renderSections([{ name: 'acceptance_criteria', value: [] }])).toContain(
      '## Acceptance criteria',
    );

    // Tier 2 — the SCHEMA names it, so every document of this kind inherits it.
    // NOTE: this proves the renderer READS a schema title; it does NOT prove the
    // schema parser carries one, because `renderSections` hands renderDd a
    // hand-built ResolvedDdSchema and never runs that parser. Deleting the
    // parser's allow-list entry leaves this assertion green — a mutation run
    // showed exactly that. The parser side is pinned in
    // test/services/dd/schema/declarations.test.ts instead.
    expect(
      renderSections([{ name: 'non_goals', value: ['a'] }], {
        sections: { non_goals: { shape: { type: 'array' }, title: 'Non-goals' } },
      }),
    ).toContain('## Non-goals');

    // Tier 1 — the DOCUMENT overrides its schema for this one section.
    expect(
      renderSections(
        [{ name: 'non_goals', title: 'What we are deliberately not doing', value: [] }],
        {
          sections: { non_goals: { shape: { type: 'array' }, title: 'Non-goals' } },
        },
      ),
    ).toContain('## What we are deliberately not doing');
  });

  it('keeps a section address pinned to its NAME however the title is written', () => {
    // The load-bearing invariant of FU-2. A title is display; the anchor is
    // identity. If the address were derived from the heading TEXT, retitling a
    // section would silently move `#non-goals` and strand every inbound link —
    // so the explicit anchor must read the same for all three tiers.
    const derived = renderSections([{ name: 'non_goals', value: [] }]);
    const schemaTitled = renderSections([{ name: 'non_goals', value: [] }], {
      sections: { non_goals: { shape: { type: 'array' }, title: 'Non-goals' } },
    });
    const docTitled = renderSections([
      { name: 'non_goals', title: 'Wildly different words', value: [] },
    ]);

    for (const output of [derived, schemaTitled, docTitled]) {
      expect(output).toContain('<a id="non-goals"></a>');
    }
    // ...and the headings really are different, so the assertion above is not
    // passing merely because all three rendered identically.
    expect(schemaTitled).not.toEqual(derived);
    expect(docTitled).not.toEqual(schemaTitled);
  });

  it('renders every address in an array-of-link cell as a real link, declared or inferred', () => {
    // The execution-log shape: one row, many outbound addresses. A cell that
    // holds a LIST of addresses must be as clickable as a cell that holds one —
    // rendering it as plain text strands exactly the links dd exists to make
    // navigable. Both routes are covered: the DECLARED `array of link` shape,
    // and the undeclared interior that falls back to address inference (A3).
    // The declared case deliberately targets a NON-.dd.json file: address
    // inference refuses those (`looksLikeAddress`), so this assertion can only
    // pass by honouring the declared `link` shape. Using a .dd.json target here
    // would let inference carry the test and prove nothing about declaration.
    const declared = renderSections(
      [
        {
          name: 'entries',
          value: [{ id: 'lg-1', links: ['notes.md#section/detail', '#entries'] }],
        },
      ],
      {
        sections: {
          entries: {
            shape: {
              type: 'array',
              items: {
                type: 'object',
                fields: { links: { type: 'array', items: { type: 'link' } } },
              },
            },
          },
        },
      },
    );
    expect(declared).toContain('[detail](notes.md#section)');
    expect(declared).toContain('[entries](#entries)');

    const inferred = renderSections([
      { name: 'entries', value: [{ id: 'lg-1', links: ['plan.dd.json#phases/ph-0001'] }] },
    ]);
    expect(inferred).toContain('[ph-0001](plan.dd.md#phases)');
  });

  it('escapes a cell but never block prose', () => {
    const output = renderSections([
      { name: 'items', value: [{ id: 'a', label: 'x | y <z>' }] },
      { name: 'notes', value: 'prose | with `pipes` and <tags>' },
    ]);
    expect(output).toContain('| a | x \\| y &lt;z&gt; | — |');
    expect(output).toContain('prose | with `pipes` and <tags>');
  });

  it('anchors an instance link on the nearest heading with the id visible', () => {
    const output = renderSections(
      [
        { name: 'items', value: [{ id: 'a', label: 'l', state: 'checked' }] },
        { name: 'meta', value: { title: 'T', link: '#items/a', away: 'other.dd.json#items/b' } },
      ],
      {
        sections: {
          meta: {
            shape: {
              type: 'object',
              fields: { title: { type: 'string' }, link: { type: 'link' } },
            },
          },
        },
      },
    );
    // `link` is declared; `away` is not, and is recovered by the address inference.
    expect(output).toContain('[a](#items)');
    expect(output).toContain('[b](other.dd.md#items)');
    expect(headingSlug('Some Heading')).toBe('some-heading');
  });

  it('reads an undeclared address as a link, but never mistakes prose for one', () => {
    const output = renderSections([
      {
        name: 'evidence',
        value: { 'tk-1': [{ id: 'dw-1', proof: '#items/a', note: 'See #items' }] },
      },
    ]);
    expect(output).toContain('| dw-1 | [a](#items) | See #items |');
  });

  it('says so honestly when a section is empty rather than emitting a headless table', () => {
    const output = renderSections([
      { name: 'items', value: [] },
      { name: 'undeclared', value: {} },
      { name: 'notes', value: '' },
    ]);
    expect(output).toContain('_No entries._');
    expect(output).toContain('_No fields._');
    expect(output).toContain('_Empty._');
  });

  it('shows a declared-but-absent field as an empty cell rather than hiding it', () => {
    expect(renderSections([{ name: 'meta', value: { title: 'T' } }])).toContain('| status | — |');
  });

  it('keeps a malformed address readable instead of throwing', () => {
    const output = renderSections([
      { name: 'meta', value: { title: 'T', link: 'no-boundary-here' } },
    ]);
    expect(output).toContain('no-boundary-here');
  });
});

describe('renderDd — an ordinary file link renders as a working href', () => {
  const REPO_ROOT = '/repo';
  /** Deliberately deep: a sibling-relative href only differs from the authored one below the root. */
  const NESTED = '/repo/docs/plans/004-file-links/plan.dd.json';

  const SCHEMA = {
    name: 'test/filelinks',
    sections: {
      meta: {
        shape: {
          type: 'object',
          fields: { title: { type: 'string' }, spec: { type: 'link', target: 'file' } },
        },
      },
      tasks: {
        shape: {
          type: 'array',
          items: {
            type: 'object',
            fields: {
              id: { type: 'string' },
              implemented_by: { type: 'link', target: 'file' },
              sources: { type: 'array', items: { type: 'link', target: 'file' } },
              notes: { type: 'text' },
            },
          },
        },
      },
    },
  } as unknown as ResolvedDdSchema;

  const DOC: DdDoc = {
    dd: { schema: 'test/filelinks' },
    sections: [
      { name: 'meta', value: { title: 'File links', spec: 'docs/spec.md' } },
      {
        name: 'tasks',
        value: [
          {
            id: 'tk-a1b2',
            implemented_by: 'src/search/index.ts',
            sources: ['src/a.ts', 'src/b.ts'],
            notes: 'Read the [handbook](../handbook.md) first.',
          },
        ],
      },
    ],
    references: [],
  };

  function render(repoRoot?: string): string {
    return renderDd(DOC, {
      path: NESTED,
      schema: SCHEMA,
      ...(repoRoot !== undefined && { repoRoot }),
    });
  }

  it('rebases a repository-relative path onto the generated sibling, with no trailing #', () => {
    const markdown = render(REPO_ROOT);
    // The sibling is `docs/plans/004-file-links/plan.dd.md`, so reaching the
    // repository root costs exactly three levels. The href bytes ARE the
    // contract: a reader clicks this, and `../../../` is what makes it open.
    expect(markdown).toContain('[src/search/index.ts](../../../src/search/index.ts)');
    expect(markdown).not.toContain('src/search/index.ts#');
    expect(markdown).not.toContain('](src/search/index.ts)');
  });

  it('rebases a file link in a field table as well as in a row', () => {
    expect(render(REPO_ROOT)).toContain('[docs/spec.md](../../../docs/spec.md)');
  });

  it('rebases every member of a declared array of file links', () => {
    const markdown = render(REPO_ROOT);
    expect(markdown).toContain('[src/a.ts](../../../src/a.ts)');
    expect(markdown).toContain('[src/b.ts](../../../src/b.ts)');
  });

  it('leaves an authored Markdown link exactly as written', () => {
    // Document-relative already, because that is what an href in the sibling
    // means. Rebasing it would break the link AND disagree with the existence
    // check, which resolves the same bytes against the same directory.
    expect(render(REPO_ROOT)).toContain('Read the [handbook](../handbook.md) first.');
  });

  it('renders the authored path as plain text when no repository root was given', () => {
    // Without a root there is no honest href to compute — `src/search/index.ts`
    // relative to the sibling names a file that is not there. Say the path,
    // rather than link to the wrong one.
    const markdown = render();
    expect(markdown).toContain('src/search/index.ts');
    expect(markdown).not.toContain('](src/search/index.ts)');
    expect(markdown).not.toContain('[src/search/index.ts](');
  });

  it('emits a document-rooted document the same href it authored', () => {
    // The degenerate arm: with the document AT the repository root the rebase is
    // the identity, so a test that only ever runs deep could pass on a helper
    // that returns its input.
    const flat = renderDd(DOC, { path: '/repo/plan.dd.json', schema: SCHEMA, repoRoot: REPO_ROOT });
    expect(flat).toContain('[src/search/index.ts](src/search/index.ts)');
  });
});

describe('renderDd — an interior-less address links only where the schema named a file', () => {
  // wl-0023. A whole-file address has no interior, so there is nothing to anchor
  // on and nothing but the authored bytes to point at. Emitting a link anyway
  // produced ten dead `[not-applicable](not-applicable)` hrefs in the shipped
  // plan corpus: the `pressure` escape is a SENTINEL, not an address, and the
  // renderer is the third independent consumer that never learned so. The rule
  // is general over SCHEMA-DIRECTED links — declared cells and bucket entries,
  // zero segments, no declared file target — because the escape is only the
  // instance that was noticed; a typo and a bare path authored into a dd-target
  // cell are the same type error and rendered the same dead href.
  //
  // It stops at the schema. A genuinely undeclared scalar is not type-wrong,
  // because no type was given; `looksLikeAddress` alone decides those and its
  // behaviour is unchanged here — the last test holds that boundary. The legacy
  // test this block replaced looked like it held it but did not: its
  // `cite: { type: 'link' }` was a DECLARED link with an implicit dd target, and
  // its comment calling it undeclared inference was simply wrong.

  function renderRows(
    rows: readonly unknown[],
    itemShape: Record<string, unknown>,
    context: { path?: string; repoRoot?: string } = {},
  ): string {
    const schema = {
      name: 'test/sentinel',
      sections: { acceptance_criteria: { shape: { type: 'array', items: itemShape } } },
    } as unknown as ResolvedDdSchema;
    const doc: DdDoc = {
      dd: { schema: 'test/sentinel' },
      sections: [{ name: 'acceptance_criteria', value: rows }],
      references: [],
    };
    return renderDd(doc, {
      path: context.path ?? '/repo/docs/plans/001-dd-extraction/plan.dd.json',
      schema,
      ...(context.repoRoot !== undefined && { repoRoot: context.repoRoot }),
    });
  }

  const AC_ITEM = {
    type: 'object',
    fields: {
      id: { type: 'string' },
      pressure: { type: 'link', rel: 'pressure' },
    },
  };

  it('renders the pressure escape in a declared dd-target cell as plain text', () => {
    const markdown = renderRows([{ id: 'ac-0001', pressure: 'not-applicable' }], AC_ITEM);
    expect(markdown).toContain('| ac-0001 | not-applicable |');
    // The href BYTES are the defect. Asserting the text alone would pass on the
    // broken renderer, whose output also contains `not-applicable`.
    expect(markdown).not.toContain('[not-applicable]');
    expect(markdown).not.toContain('](not-applicable)');
  });

  it('renders a links-bucket pressure escape as plain text', () => {
    // The bucket carries its relation in the DATA and reaches `renderLink` with
    // no declared target at all, so it is an independent arm: a fix that only
    // read declared shapes would leave this one emitting the dead href.
    const markdown = renderRows(
      [{ id: 'ac-0001', links: [{ rel: 'pressure', ref: 'not-applicable' }] }],
      { type: 'object', fields: { id: { type: 'string' } } },
    );
    expect(markdown).toContain('pressure: not-applicable');
    expect(markdown).not.toContain('[not-applicable]');
    expect(markdown).not.toContain('](not-applicable)');
  });

  it('renders any other bare-path-shaped value in a dd-target cell as plain text', () => {
    // The general class the sentinel belongs to. `docs/spec.md` is a typo or a
    // missing `target: "file"`; `other.dd.json` is a real document the schema
    // still never authorised an href to — and it used to render one, aimed at a
    // sibling `.dd.md` this cell never declared. Both say the value instead.
    //
    // Both declared spellings are on this row: `pressure` leaves the target
    // implicit, `cite` names it. A dd target is a dd target however it was
    // written, and the guard must not be reading the absence of the key.
    const markdown = renderRows(
      [{ id: 'ac-0001', pressure: 'docs/spec.md', cite: 'other.dd.json' }],
      {
        type: 'object',
        fields: {
          id: { type: 'string' },
          pressure: { type: 'link', rel: 'pressure' },
          cite: { type: 'link', target: 'dd' },
        },
      },
    );
    expect(markdown).toContain('| ac-0001 | docs/spec.md | other.dd.json |');
    expect(markdown).not.toContain('](docs/spec.md)');
    expect(markdown).not.toContain('other.dd.md');
    // No trailing-`#` form either: absence of a link subsumes the older
    // separator rule this block replaced.
    expect(markdown).not.toContain('other.dd.json#');
  });

  it('still links a declared target:file whole-file path, rebased onto the sibling', () => {
    // Positive control. The guard must not swallow the ONE declaration that
    // authorises a file href — if it did, tests 1-3 would pass on a renderer
    // that had simply stopped linking.
    const markdown = renderRows(
      [{ id: 'ac-0001', spec: 'docs/spec.md' }],
      {
        type: 'object',
        fields: { id: { type: 'string' }, spec: { type: 'link', target: 'file' } },
      },
      { repoRoot: '/repo' },
    );
    expect(markdown).toContain('[docs/spec.md](../../../docs/spec.md)');
  });

  it('renders an invalid target:file interior plainly beside a valid whole-file href', () => {
    const markdown = renderRows(
      [
        {
          id: 'ac-0001',
          invalid: 'src/library.ts#parseThing',
          valid: 'src/valid.ts',
        },
      ],
      {
        type: 'object',
        fields: {
          id: { type: 'string' },
          invalid: { type: 'link', target: 'file' },
          valid: { type: 'link', target: 'file' },
        },
      },
      { repoRoot: '/repo' },
    );

    expect(markdown).toContain(
      '| ac-0001 | src/library.ts#parseThing | [src/valid.ts](../../../src/valid.ts) |',
    );
    expect(markdown).not.toContain('[src/library.ts#parseThing]');
  });

  it('still links a dd-target address that carries a real interior', () => {
    // The second positive control: an address WITH an interior is untouched, so
    // the guard is proven to key on the empty interior and not on the cell.
    const markdown = renderRows(
      [{ id: 'ac-0001', pressure: 'backpressure.dd.json#instruments/bp-0001' }],
      AC_ITEM,
    );
    expect(markdown).toContain('[bp-0001](backpressure.dd.md#instruments)');
  });

  it('still links a genuinely undeclared bare .dd.json value to its sibling', () => {
    // The boundary the guard must NOT cross. `cite` is absent from the item
    // shape, so nothing declared it a link and nothing declared what it targets:
    // the address inference of A3 / workshop-002 Ruling 3 selected it on the
    // value alone. Whether that inference should accept a bare `.dd.json` at all
    // is a live question, and a separate one — this fix answers what a
    // DECLARATION means, so the inferred bytes must come through untouched.
    const markdown = renderRows([{ id: 'ac-0001', cite: 'other.dd.json' }], {
      type: 'object',
      fields: { id: { type: 'string' } },
    });
    expect(markdown).toContain('[other.dd.json](other.dd.md)');
    // Carried over from the replaced legacy test, and only now on the path that
    // test claimed: `#` with nothing after it is a link to the top of the page,
    // which is a different destination from the page itself.
    expect(markdown).not.toContain('other.dd.md#');
  });
});
