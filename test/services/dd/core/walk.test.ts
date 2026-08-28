import { describe, expect, it } from 'vitest';
import type { DdDoc, ResolvedDdSchema } from '../../../../src/core/model.js';
import type {
  FileExistence,
  SchemaResolveResult,
  SchemaResolver,
} from '../../../../src/core/validate.js';
import {
  type DocLoader,
  type DocLoadResult,
  shouldExcludeFromSweep,
  validateWalk,
} from '../../../../src/core/walk.js';
import { FixtureSchemaResolver, fixtureDoc } from '../helpers.js';

const SHA_BY_NAME: Record<string, string> = {
  'chain-a.dd.json': 'sha-a',
  'chain-b.dd.json': 'sha-b',
  'chain-c.dd.json': 'sha-c',
  'chain-d-invalid.dd.json': 'sha-d-invalid',
  'cycle-a.dd.json': 'sha-cycle-a',
  'cycle-b.dd.json': 'sha-cycle-b',
  'untracked.dd.json': 'sha-untracked',
};

class FixtureDocLoader implements DocLoader {
  readonly calls: string[] = [];

  load(path: string): DocLoadResult {
    this.calls.push(path);
    const name = path.split('/').at(-1);
    const sha = name ? SHA_BY_NAME[name] : undefined;
    if (!name || name === 'missing.dd.json' || !sha) {
      return { ok: false, path, reason: 'missing', message: `missing: ${path}` };
    }
    const folder = name.startsWith('chain-') || name.startsWith('cycle-') ? 'graph' : 'warn';
    return {
      ok: true,
      path,
      doc: fixtureDoc(`${folder}/${name}`),
      sha,
      tracked: name !== 'untracked.dd.json',
    };
  }
}

const resolver = new FixtureSchemaResolver();

function walk(relative: string, depth: number, loader = new FixtureDocLoader()) {
  return {
    loader,
    issues: validateWalk(
      fixtureDoc(relative),
      `/repo/${relative}`,
      { schemaResolver: resolver, docLoader: loader },
      { repoRoot: '/repo', depth, mode: 'direct' },
    ),
  };
}

describe('dd-core validate walk', () => {
  it('distinguishes depth 2 from depth 3 on the three-hop chain', () => {
    const depth2 = walk('graph/chain-a.dd.json', 2).issues;
    const depth3 = walk('graph/chain-a.dd.json', 3).issues;
    expect(depth2).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          class: 'basis-stale',
          owner: '/repo/graph/chain-b.dd.json',
        }),
      ]),
    );
    expect(depth2.some((issue) => issue.owner.endsWith('chain-d-invalid.dd.json'))).toBe(false);
    expect(depth3).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          class: 'enum-invalid',
          owner: '/repo/graph/chain-d-invalid.dd.json',
        }),
      ]),
    );
  });

  it('terminates a cyclic graph at infinite radius', () => {
    const { issues, loader } = walk('graph/cycle-a.dd.json', Number.POSITIVE_INFINITY);
    expect(issues.filter((issue) => issue.severity === 'ERROR')).toEqual([]);
    expect(loader.calls).toHaveLength(2);
  });

  it.each([
    ['warn/untracked-target.dd.json', 'address-target-untracked'],
    ['warn/missing-target.dd.json', 'address-target-missing'],
  ] as const)('%s maps target state to WARN class %s', (relative, issueClass) => {
    const result = walk(relative, 1).issues;
    expect(result).toEqual(
      expect.arrayContaining([expect.objectContaining({ class: issueClass, severity: 'WARN' })]),
    );
    expect(result.some((issue) => issue.class === issueClass && issue.severity === 'ERROR')).toBe(
      false,
    );
  });

  /**
   * A-2's policy guard, and the row that would catch the obvious "simplification".
   *
   * `tracked` is `boolean | null`, where null means the host has no tracking
   * concept. The WARN policy on such a host is deliberately UNCHANGED: say
   * nothing. Writing the test for it matters because the natural spelling of the
   * check — `if (!loaded.tracked)` — is CORRECT for `false` and WRONG for `null`,
   * and the difference is invisible until a non-repo host runs the walk. So the
   * two arms below are one test: null stays silent, false still speaks. Either
   * arm alone would pass against a broken implementation of the other.
   */
  it('says nothing about tracking on a null-tracked host, but still reports a definite false', () => {
    class TrackedStateLoader implements DocLoader {
      constructor(private readonly tracked: boolean | null) {}
      load(path: string): DocLoadResult {
        const name = path.split('/').at(-1);
        const sha = name ? SHA_BY_NAME[name] : undefined;
        if (!name || !sha) {
          return { ok: false, path, reason: 'missing', message: `missing: ${path}` };
        }
        return { ok: true, path, doc: fixtureDoc(`warn/${name}`), sha, tracked: this.tracked };
      }
    }
    const untrackedIssues = (tracked: boolean | null) =>
      validateWalk(
        fixtureDoc('warn/untracked-target.dd.json'),
        '/repo/warn/untracked-target.dd.json',
        { schemaResolver: resolver, docLoader: new TrackedStateLoader(tracked) },
        { repoRoot: '/repo', depth: 1, mode: 'direct' },
      ).filter((issue) => issue.class === 'address-target-untracked');

    // "Unknowable" is not an accusation.
    expect(untrackedIssues(null)).toEqual([]);
    // Non-vacuity: the very same walk DOES fire when the answer is a definite no,
    // so the empty result above is suppression and not a walk that found nothing.
    expect(untrackedIssues(false)).toHaveLength(1);
    // And a definite yes is silent for the ordinary reason.
    expect(untrackedIssues(true)).toEqual([]);
  });

  it('skips test fixture roots and sweep_exclude docs only in sweep mode', () => {
    const excluded = fixtureDoc('excluded/sweep-excluded.dd.json');
    const path = '/repo/test/services/dd/fixtures/excluded/sweep-excluded.dd.json';
    expect(shouldExcludeFromSweep(path, excluded)).toBe(true);
    expect(
      validateWalk(
        excluded,
        path,
        { schemaResolver: resolver, docLoader: new FixtureDocLoader() },
        { repoRoot: '/repo', depth: 0, mode: 'sweep' },
      ),
    ).toEqual([]);
    expect(
      validateWalk(
        excluded,
        path,
        { schemaResolver: resolver, docLoader: new FixtureDocLoader() },
        { repoRoot: '/repo', depth: 0, mode: 'direct' },
      ),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ class: 'enum-invalid' })]));
  });

  it('honours sweep_exclude outside fixture paths while direct invocation still validates', () => {
    const excluded: DdDoc = {
      ...fixtureDoc('invalid/bad-enum.dd.json'),
      dd: { schema: 'test/plan', sweep_exclude: true },
    };
    expect(shouldExcludeFromSweep('/repo/docs/excluded.dd.json', excluded)).toBe(true);
    expect(
      validateWalk(
        excluded,
        '/repo/docs/excluded.dd.json',
        { schemaResolver: resolver, docLoader: new FixtureDocLoader() },
        { repoRoot: '/repo', depth: 0, mode: 'sweep' },
      ),
    ).toEqual([]);
    expect(
      validateWalk(
        excluded,
        '/repo/docs/excluded.dd.json',
        { schemaResolver: resolver, docLoader: new FixtureDocLoader() },
        { repoRoot: '/repo', depth: 0, mode: 'direct' },
      ),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ class: 'enum-invalid' })]));
  });
});

/**
 * wl-0023's approval condition, pinned as a tripwire.
 *
 * Widening the grammar to accept a bare path is the risky half of this stream,
 * and the risk is not the happy path — it is that `plan.dd.json#tasks` with the
 * `#` lost to a typo STOPS being a hard error and starts being a missing-file
 * WARN. Nothing about that decay is visible in a passing suite: the address
 * still parses, the walk still runs, and a WARN still gets reported, so the only
 * thing that changed is that a broken link no longer fails anything.
 *
 * Both link shapes are asserted because they fail for DIFFERENT reasons and only
 * one of them is covered by the type system of the schema: a cell with a
 * declared dd target is rejected ON TYPE, statically, before anything is looked
 * for; a cell with no target is rejected on the address contract itself. And the
 * loader is counted, not just the findings — "no missing-file WARN" would also
 * be true of an implementation that probed the filesystem and happened to find
 * the file, so the probe count is what makes the assertion mean what it says.
 */
describe('dd-core whole-file grammar — the removed-# typo stays a hard error', () => {
  const INTENDED = 'plan.dd.json#tasks';
  const MISTYPED = 'plan.dd.jsontasks';

  const TYPO_SCHEMA: ResolvedDdSchema = {
    name: 'typo/plan',
    sections: {
      tasks: { shape: { type: 'array', items: { type: 'object', fields: {} } } },
      rows: {
        shape: {
          type: 'object',
          fields: {
            targeted: { type: 'link', target: 'typo/plan/section/tasks' },
            untargeted: { type: 'link' },
          },
        },
      },
    },
  };

  class TypoResolver implements SchemaResolver {
    resolve(schemaRef: string): SchemaResolveResult {
      return schemaRef === TYPO_SCHEMA.name
        ? { ok: true, schema: TYPO_SCHEMA }
        : { ok: false, message: `schema not found: ${schemaRef}` };
    }
  }

  /** Every path this walk asked the host about. Empty means nothing was probed. */
  class CountingLoader implements DocLoader {
    readonly calls: string[] = [];
    load(path: string): DocLoadResult {
      this.calls.push(path);
      return { ok: false, path, reason: 'missing', message: `address target is missing: ${path}` };
    }
  }

  function walkCell(field: 'targeted' | 'untargeted', raw: string) {
    const doc: DdDoc = {
      dd: { schema: TYPO_SCHEMA.name },
      sections: [
        { name: 'tasks', value: [] },
        { name: 'rows', value: { [field]: raw } },
      ],
      references: [],
    };
    const loader = new CountingLoader();
    const issues = validateWalk(
      doc,
      '/repo/docs/plan.dd.json',
      { schemaResolver: new TypoResolver(), docLoader: loader },
      { repoRoot: '/repo', depth: 3, mode: 'direct' },
    );
    return { issues, probed: loader.calls };
  }

  it('rejects the dd-TARGETED cell on type, before anything is probed', () => {
    const { issues, probed } = walkCell('targeted', MISTYPED);
    expect(issues).toEqual([
      expect.objectContaining({
        class: 'link-type-mismatch',
        severity: 'ERROR',
        location: '$.sections[rows].value.targeted',
        owner: '/repo/docs/plan.dd.json',
      }),
    ]);
    expect(probed).toEqual([]);
  });

  it('rejects the UNTARGETED cell on the address contract, before anything is probed', () => {
    const { issues, probed } = walkCell('untargeted', MISTYPED);
    expect(issues).toEqual([
      expect.objectContaining({
        class: 'address-malformed',
        severity: 'ERROR',
        location: '$.sections[rows].value.untargeted',
        owner: '/repo/docs/plan.dd.json',
      }),
    ]);
    expect(probed).toEqual([]);
  });

  it.each(['targeted', 'untargeted'] as const)(
    'control arm: the INTENDED address on the %s cell does reach the probe',
    (field) => {
      const { issues, probed } = walkCell(field, INTENDED);
      // The typo arms above claim an absence. This arm proves the same walk fires
      // when the address is well-formed, so that absence is a refusal and not a
      // walk that never looked.
      expect(probed).toEqual(['/repo/docs/plan.dd.json']);
      expect(issues).toEqual([
        expect.objectContaining({ class: 'address-target-missing', severity: 'WARN' }),
      ]);
    },
  );

  /**
   * A `target: "file"` cell names an ordinary file, and the walk's loader is the
   * one thing in this layer that READS, PARSES and HASHES a target. Proving the
   * loader was never called is therefore the mechanical form of the
   * existence-only ruling: nothing else could have read the file, because
   * nothing else here can.
   *
   * BOTH file cells matter, and the second is the one that earns the guard. A
   * WELL-FORMED file value is already skipped for naming no interior, so a test
   * using only that shape passes with the file-target check DELETED — measured,
   * not assumed: the first version of this test did exactly that and survived
   * the mutation. A file cell holding an INTERIOR is rejected on type and would
   * otherwise be walked as a dd document, which is the only input that tells the
   * two guards apart.
   */
  it('never loads, parses or hashes an ordinary file named by a target:file cell', () => {
    const schema: ResolvedDdSchema = {
      name: 'typo/plan',
      sections: {
        tasks: { shape: { type: 'array', items: { type: 'object', fields: {} } } },
        rows: {
          shape: {
            type: 'object',
            fields: {
              implemented_by: { type: 'link', target: 'file' },
              mistyped_file: { type: 'link', target: 'file' },
              dependency: { type: 'link', target: 'typo/plan/section/tasks' },
            },
          },
        },
      },
    };
    const loader = new CountingLoader();
    const issues = validateWalk(
      {
        dd: { schema: schema.name },
        sections: [
          { name: 'tasks', value: [] },
          {
            name: 'rows',
            value: {
              implemented_by: 'src/search/index.ts',
              mistyped_file: 'src/search/index.ts#parseThing',
              dependency: 'other.dd.json#tasks',
            },
          },
        ],
        references: [],
      },
      '/repo/docs/plan.dd.json',
      {
        schemaResolver: {
          resolve: (ref: string) =>
            ref === schema.name
              ? { ok: true as const, schema }
              : { ok: false as const, message: `schema not found: ${ref}` },
        },
        docLoader: loader,
      },
      { repoRoot: '/repo', depth: 3, mode: 'direct' },
    );
    // The dd cell beside them WAS followed, so the file cells' absence from this
    // list is an exclusion and not a walk that loaded nothing at all.
    expect(loader.calls).toEqual(['/repo/docs/other.dd.json']);
    expect(issues).toEqual([
      expect.objectContaining({
        class: 'link-type-mismatch',
        severity: 'ERROR',
        location: '$.sections[rows].value.mistyped_file',
      }),
      expect.objectContaining({
        class: 'address-target-missing',
        severity: 'WARN',
        location: '$.sections[rows].value.dependency',
      }),
    ]);
  });
});

/**
 * The walk is what `ddocs validate` and the doctor's sweep both run, and until
 * now it was the one surface that KNEW about ordinary files (it refuses to load
 * them) without ever REPORTING on them — so a missing target degraded `ddocs
 * build` and left `ddocs validate` and `ddocs doctor` saying `ok` about the same
 * document. These pin the agreement.
 */
describe('dd-core validate walk — ordinary file targets are reported, never opened', () => {
  const SCHEMA: ResolvedDdSchema = {
    name: 'files/plan',
    sections: {
      tasks: { shape: { type: 'array', items: { type: 'object', fields: {} } } },
      rows: {
        shape: {
          type: 'object',
          fields: {
            implemented_by: { type: 'link', target: 'file', rel: 'implemented_by' },
            note: { type: 'text' },
            dependency: { type: 'link', target: 'files/plan/section/tasks' },
          },
        },
      },
    },
  };

  const SUBJECT = '/repo/docs/plan.dd.json';
  const NEIGHBOUR = '/repo/docs/other.dd.json';
  const LIBRARY = '/repo/src/library.ts';
  const HANDBOOK = '/repo/docs/handbook.md';

  function docFor(schemaName: string): DdDoc {
    return {
      dd: { schema: schemaName },
      sections: [
        { name: 'tasks', value: [] },
        {
          name: 'rows',
          value: {
            implemented_by: 'src/library.ts',
            note: 'read the [handbook](handbook.md) first',
            dependency: 'other.dd.json#tasks',
          },
        },
      ],
      references: [],
    };
  }

  /** A real dd neighbour, so an empty finding list cannot come from a dead walk. */
  class NeighbourLoader implements DocLoader {
    readonly calls: string[] = [];
    load(path: string): DocLoadResult {
      this.calls.push(path);
      if (path !== NEIGHBOUR) {
        return { ok: false, path, reason: 'missing', message: `missing: ${path}` };
      }
      return {
        ok: true,
        path,
        doc: {
          dd: { schema: SCHEMA.name },
          sections: [{ name: 'tasks', value: [] }],
          references: [],
        },
        sha: 'sha-neighbour',
        tracked: true,
      };
    }
  }

  /**
   * The whole port, and deliberately nothing else: an ordinary file may be
   * asked ONE question. If the walk ever needed to read, hash or stat a file,
   * there would be no method here to do it with.
   */
  class Recorder implements FileExistence {
    readonly probed: string[] = [];
    constructor(private readonly present: readonly string[]) {}
    exists(path: string): boolean {
      this.probed.push(path);
      return this.present.includes(path);
    }
  }

  const schemaResolver: SchemaResolver = {
    resolve: (ref: string) =>
      ref === SCHEMA.name
        ? { ok: true as const, schema: SCHEMA }
        : { ok: false as const, message: `schema not found: ${ref}` },
  };

  function run(present: readonly string[] | null, depth = 3) {
    const loader = new NeighbourLoader();
    const probe = present === null ? null : new Recorder(present);
    const issues = validateWalk(
      docFor(SCHEMA.name),
      SUBJECT,
      { schemaResolver, docLoader: loader, ...(probe && { fileExistence: probe }) },
      { repoRoot: '/repo', depth, mode: 'direct' },
    );
    return {
      loader,
      probe,
      issues,
      files: issues.filter(
        (issue) =>
          issue.class.startsWith('address-path') || issue.class === 'address-target-missing',
      ),
    };
  }

  it('reports nothing when both targets are there, having probed both', () => {
    const { probe, issues, loader } = run([LIBRARY, HANDBOOK]);
    expect(probe?.probed).toEqual([LIBRARY, HANDBOOK]);
    expect(issues).toEqual([]);
    // The dd neighbour WAS followed, so "no findings" is a clean walk and not a
    // walk that never started.
    expect(loader.calls).toEqual([NEIGHBOUR]);
  });

  it('probes only the legal whole-file arm of a mixed target:file document', () => {
    const schema: ResolvedDdSchema = {
      name: 'files/composed',
      sections: {
        rows: {
          shape: {
            type: 'object',
            fields: {
              implemented_by: {
                type: 'array',
                items: { type: 'link', target: 'file', rel: 'implemented_by' },
              },
            },
          },
        },
      },
    };
    const probe = new Recorder(['/repo/src/valid.ts']);
    const issues = validateWalk(
      {
        dd: { schema: schema.name },
        sections: [
          {
            name: 'rows',
            value: { implemented_by: ['src/library.ts#parseThing', 'src/valid.ts'] },
          },
        ],
        references: [],
      },
      SUBJECT,
      {
        schemaResolver: {
          resolve: (ref: string) =>
            ref === schema.name
              ? { ok: true as const, schema }
              : { ok: false as const, message: `schema not found: ${ref}` },
        },
        docLoader: new NeighbourLoader(),
        fileExistence: probe,
      },
      { repoRoot: '/repo', depth: 0, mode: 'direct' },
    );

    expect(probe.probed).toEqual(['/repo/src/valid.ts']);
    expect(issues).toEqual([
      expect.objectContaining({
        class: 'link-type-mismatch',
        severity: 'ERROR',
        location: '$.sections[rows].value.implemented_by[0]',
      }),
    ]);
    expect(
      issues.some(
        (issue) =>
          issue.class === 'address-target-missing' &&
          issue.location === '$.sections[rows].value.implemented_by[0]',
      ),
    ).toBe(false);
  });

  it('reports one WARN per missing target, owned by the citing document', () => {
    const { issues } = run([HANDBOOK]);
    expect(issues).toEqual([
      {
        class: 'address-target-missing',
        severity: 'WARN',
        location: '$.sections[rows].value.implemented_by',
        message: 'file link target is missing: src/library.ts',
        owner: SUBJECT,
      },
    ]);
  });

  it('never hands an ordinary file to the loader, whether it exists or not', () => {
    for (const present of [[LIBRARY, HANDBOOK], []]) {
      expect(run(present).loader.calls).toEqual([NEIGHBOUR]);
    }
  });

  it('still answers for the document itself at depth 0', () => {
    // A file target is TERMINAL — it is not a hop, so the hop budget does not
    // govern it. `--depth 0` means "just this document", and the file this
    // document cites is part of this document.
    const { issues, loader } = run([], 0);
    expect(issues.map((issue) => issue.location)).toEqual([
      '$.sections[rows].value.implemented_by',
      '$.sections[rows].value.note',
    ]);
    expect(loader.calls).toEqual([]);
  });

  it('reports nothing at all when no probe was supplied', () => {
    // Absence of the seam means UNMEASURED. The alternative — defaulting the
    // answer to "exists" — would let a host that never wired the probe publish
    // a clean bill of health it never earned.
    const { issues, loader } = run(null);
    expect(issues).toEqual([]);
    expect(loader.calls).toEqual([NEIGHBOUR]);
  });

  it('reports a file cited by two documents once per citing document', () => {
    // The dedupe that matters is `visited`, which is keyed by DOCUMENT. Two
    // documents naming the same missing file is two findings, because each
    // document is separately wrong about it.
    const probe = new Recorder([HANDBOOK]);
    const loader = new NeighbourLoader();
    const issues = [SUBJECT, NEIGHBOUR].flatMap((path) =>
      validateWalk(
        docFor(SCHEMA.name),
        path,
        { schemaResolver, docLoader: loader, fileExistence: probe },
        { repoRoot: '/repo', depth: 0, mode: 'direct' },
      ),
    );
    expect(
      issues
        .filter((issue) => issue.class === 'address-target-missing')
        .map((issue) => issue.owner),
    ).toEqual([SUBJECT, NEIGHBOUR]);
  });
});
