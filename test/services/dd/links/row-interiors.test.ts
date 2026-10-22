import { describe, expect, it } from 'vitest';
import type { DdDoc, ResolvedDdSchema } from '../../../../src/core/model.js';
import type { DdIssue } from '../../../../src/core/validate.js';
import { type DocLoader, type DocLoadResult, validateWalk } from '../../../../src/core/walk.js';
import { runDoctor } from '../../../../src/links/doctor.js';
import { interiorResolver } from '../../../../src/links/resolver.js';
import { traverseCorpus } from '../../../../src/links/traverse.js';
import type { SchemaFs } from '../../../../src/schema/model.js';

/**
 * Backlog rows 30 and 31: a link to a ROW that does not exist.
 *
 * Every case carries both arms: `halden` is a real row and must stay clean,
 * `haldn` is a typo and must be flagged, with exact counts, so an
 * implementation that flagged every link would fail as surely as one that
 * flagged none.
 */

const REPO = '/repo';
const WORLD = `${REPO}/world.dd.json`;
const CH = `${REPO}/ch.dd.json`;
const NESTED = `${REPO}/sub/ch.dd.json`;
const SELF = `${REPO}/self.dd.json`;
const WHAT = '$.sections[beats].value[0].what';
const INTRODUCES = '$.sections[beats].value[0].introduces';
const MISSING_ROW = 'no entry with id "haldn" in "entities"';

const SCHEMAS: Record<string, ResolvedDdSchema> = {
  't/ent': {
    name: 't/ent',
    sections: {
      entities: {
        shape: {
          type: 'array',
          items: { type: 'object', fields: { id: { type: 'string' }, name: { type: 'string' } } },
        },
      },
    },
  },
  't/ch': {
    name: 't/ch',
    sections: {
      beats: {
        shape: {
          type: 'array',
          items: {
            type: 'object',
            fields: {
              id: { type: 'string' },
              what: { type: 'text' },
              introduces: {
                type: 'array',
                items: { type: 'link', target: 't/ent/section/entities' },
              },
            },
          },
        },
      },
    },
  },
  't/self': {
    name: 't/self',
    sections: {
      entities: {
        shape: {
          type: 'array',
          items: {
            type: 'object',
            fields: {
              id: { type: 'string' },
              cites: { type: 'array', items: { type: 'link', target: 't/self/section/entities' } },
            },
          },
        },
      },
    },
  },
} as unknown as Record<string, ResolvedDdSchema>;

const WORLD_DOC: DdDoc = {
  dd: { schema: 't/ent' },
  sections: [
    {
      name: 'entities',
      value: [
        { id: 'halden', name: 'Halden' },
        { id: 'chalk', name: 'Chalk' },
      ],
    },
  ],
  references: [],
};

function chapter(beat: { what?: string; introduces?: string[] }): DdDoc {
  return {
    dd: { schema: 't/ch' },
    sections: [
      {
        name: 'beats',
        value: [{ id: 'b1', what: beat.what ?? '', introduces: beat.introduces ?? [] }],
      },
    ],
    references: [],
  };
}

/** A whole in-memory repository: dd documents plus the ordinary files that exist. */
function corpus(docs: Record<string, DdDoc>, files: readonly string[] = []) {
  const fs: SchemaFs = {
    readdir(path) {
      const prefix = `${path}/`;
      const names = new Set<string>();
      for (const key of Object.keys(docs)) {
        if (key.startsWith(prefix)) names.add(key.slice(prefix.length).split('/')[0] as string);
      }
      return [...names].sort();
    },
    exists: (path) => path in docs || files.includes(path),
    readText: () => null,
  };
  const docLoader: DocLoader = {
    load(path): DocLoadResult {
      const doc = docs[path];
      return doc === undefined
        ? { ok: false, path, reason: 'missing', message: `address target is missing: ${path}` }
        : { ok: true, path, doc, sha: `sha-${path}`, tracked: true };
    },
  };
  const schemaResolver = {
    resolve: (ref: string) => {
      const schema = SCHEMAS[ref];
      return schema ? { ok: true as const, schema } : { ok: false as const, message: ref };
    },
  };
  const base = { schemaResolver, docLoader };
  const resolveInterior = interiorResolver(base, REPO);

  return {
    walk(path: string, options: { depth?: number; interior?: boolean } = {}): DdIssue[] {
      const doc = docs[path];
      if (!doc) throw new Error(`no such document: ${path}`);
      return validateWalk(
        doc,
        path,
        {
          ...base,
          fileExistence: fs,
          ...(options.interior !== false && { resolveInterior }),
        },
        { repoRoot: REPO, depth: options.depth ?? 3 },
      );
    },
    graph(seed: string) {
      return traverseCorpus(
        [seed],
        { ...base, fileExistence: fs },
        { repoRoot: REPO, mode: 'direct' },
      );
    },
    doctor() {
      return runDoctor(fs, base, { repoRoot: REPO, root: REPO });
    },
    resolveInterior,
  };
}

/** `address` is given for an inline link: its message names the link, since a field can hold many. */
function unresolved(
  issue: { location: string; severity: string; address?: string },
  owner: string,
  missing = MISSING_ROW,
) {
  return {
    class: 'link-unresolved',
    severity: issue.severity,
    location: issue.location,
    message: issue.address === undefined ? missing : `${issue.address}: ${missing}`,
    owner,
    reason: 'id-not-found',
  };
}

describe('row 31: validate resolves the interior of a typed link', () => {
  const world = () =>
    corpus({
      [WORLD]: WORLD_DOC,
      [CH]: chapter({
        introduces: ['world.dd.json#entities/halden', 'world.dd.json#entities/haldn'],
      }),
    });

  it('flags the misspelled row as one E430 ERROR and passes the real row', () => {
    expect(world().walk(CH)).toEqual([
      unresolved({ location: `${INTRODUCES}[1]`, severity: 'ERROR' }, CH),
    ]);
  });

  it('reports no interior finding when no resolver is injected (absent means unmeasured)', () => {
    expect(world().walk(CH, { interior: false })).toEqual([]);
  });

  it('resolves a same-document (bare #) typed link too: one ERROR for haldn, none for halden', () => {
    const docs = {
      [SELF]: {
        dd: { schema: 't/self' },
        sections: [
          {
            name: 'entities',
            value: [
              { id: 'halden', cites: [] },
              { id: 'chalk', cites: ['#entities/halden', '#entities/haldn'] },
            ],
          },
        ],
        references: [],
      },
    };
    const location = '$.sections[entities].value[1].cites[1]';
    const expected = [unresolved({ location, severity: 'ERROR' }, SELF)];
    expect(corpus(docs).walk(SELF)).toEqual(expected);
    const doctor = corpus(docs).doctor();
    expect(doctor.findings).toEqual(expected);
    expect(doctor.counts).toEqual({ error: 1, warn: 0 });
  });
});

describe('row 30: an inline link into a .dd.json interior is a dd address', () => {
  const INLINE =
    '[H](world.dd.json#entities/halden) and [H](world.dd.json#entities/haldn) and [n](notes.md#intro)';
  const world = () =>
    corpus({ [WORLD]: WORLD_DOC, [CH]: chapter({ what: INLINE }) }, [`${REPO}/notes.md`]);

  it('validate flags the misspelled row as one E430 WARN and passes the real row', () => {
    expect(world().walk(CH)).toEqual([
      unresolved({ location: WHAT, severity: 'WARN', address: 'world.dd.json#entities/haldn' }, CH),
    ]);
  });

  it('graph draws both dd addresses as inline document edges and the ordinary file as a file edge', () => {
    const edges = world()
      .graph(CH)
      .edges.filter((edge) => edge.location === WHAT)
      .map(({ kind, origin, address, to }) => ({ kind, origin, address, to }));
    expect(edges).toEqual([
      { kind: 'document', origin: 'inline', address: 'world.dd.json#entities/halden', to: WORLD },
      { kind: 'document', origin: 'inline', address: 'world.dd.json#entities/haldn', to: WORLD },
      { kind: 'file', origin: undefined, address: 'notes.md#intro', to: `${REPO}/notes.md` },
    ]);
  });

  it('keeps two inline misses of the same id in different files apart: validate 2, doctor 2', () => {
    const ATLAS = `${REPO}/atlas.dd.json`;
    const docs = {
      [WORLD]: WORLD_DOC,
      [ATLAS]: WORLD_DOC,
      [CH]: chapter({
        what: '[a](world.dd.json#entities/haldn) [b](atlas.dd.json#entities/haldn) [c](atlas.dd.json#entities/halden)',
      }),
    };
    const expected = [
      unresolved({ location: WHAT, severity: 'WARN', address: 'world.dd.json#entities/haldn' }, CH),
      unresolved({ location: WHAT, severity: 'WARN', address: 'atlas.dd.json#entities/haldn' }, CH),
    ];
    const doctor = corpus(docs).doctor().findings;
    expect(doctor).toHaveLength(2);
    expect(doctor).toEqual(expected);
    expect(corpus(docs).walk(CH)).toEqual(expected);
  });

  it('ignores a dd address written inside a code span: no edge, no finding', () => {
    const docs = {
      [WORLD]: WORLD_DOC,
      [CH]: chapter({
        what: '`[x](world.dd.json#entities/haldn)` and [y](world.dd.json#entities/halden)',
      }),
    };
    const graph = corpus(docs).graph(CH);
    expect(
      graph.edges.filter((edge) => edge.location === WHAT).map((edge) => edge.address),
    ).toEqual(['world.dd.json#entities/halden']);
    expect(corpus(docs).walk(CH)).toEqual([]);
    expect(corpus(docs).doctor().findings).toEqual([]);
  });

  it('resolves a nested document link relative to the citing document', () => {
    const docs = {
      [WORLD]: WORLD_DOC,
      [NESTED]: chapter({
        what: '[a](../world.dd.json#entities/halden) [b](../world.dd.json#entities/haldn)',
      }),
    };
    const targets = corpus(docs)
      .graph(NESTED)
      .edges.filter((edge) => edge.location === WHAT)
      .map((edge) => edge.to);
    expect(targets).toEqual([WORLD, WORLD]);
    expect(corpus(docs).walk(NESTED)).toEqual([
      unresolved(
        { location: WHAT, severity: 'WARN', address: '../world.dd.json#entities/haldn' },
        NESTED,
      ),
    ]);
  });

  it('keeps a fragment-less .dd.json link a file edge with an existence check only', () => {
    const docs = {
      [WORLD]: WORLD_DOC,
      [CH]: chapter({ what: '[w](world.dd.json) [m](missing.dd.json)' }),
    };
    const edges = corpus(docs)
      .graph(CH)
      .edges.filter((edge) => edge.location === WHAT)
      .map(({ kind, origin, address }) => ({ kind, origin, address }));
    expect(edges).toEqual([
      { kind: 'file', origin: undefined, address: 'world.dd.json' },
      { kind: 'file', origin: undefined, address: 'missing.dd.json' },
    ]);
    expect(corpus(docs).walk(CH)).toEqual([
      {
        class: 'address-target-missing',
        severity: 'WARN',
        location: WHAT,
        message: 'file link target is missing: missing.dd.json',
        owner: CH,
      },
    ]);
  });

  it('reports a missing target file exactly once in validate and doctor, with no E430', () => {
    const docs = {
      [WORLD]: WORLD_DOC,
      [CH]: chapter({
        what: '[m](missing.dd.json#entities/halden) [h](world.dd.json#entities/halden)',
      }),
    };
    const missing = {
      class: 'address-target-missing',
      severity: 'WARN',
      location: WHAT,
      message: 'file link target is missing: missing.dd.json#entities/halden',
      owner: CH,
    };
    expect(corpus(docs).walk(CH)).toEqual([missing]);
    expect(corpus(docs).doctor().findings).toEqual([missing]);
    const edges = corpus(docs)
      .graph(CH)
      .edges.filter((edge) => edge.address.startsWith('missing.dd.json'))
      .map(({ kind, origin, to }) => ({ kind, origin, to }));
    expect(edges).toEqual([{ kind: 'document', origin: 'inline', to: `${REPO}/missing.dd.json` }]);
  });

  it('checks file existence at --depth 0 but leaves the interior to depth 1 and beyond', () => {
    const docs = {
      [WORLD]: WORLD_DOC,
      [CH]: chapter({
        what: '[m](missing.dd.json#entities/halden) [h](world.dd.json#entities/haldn)',
      }),
    };
    const missing = {
      class: 'address-target-missing',
      severity: 'WARN',
      location: WHAT,
      message: 'file link target is missing: missing.dd.json#entities/halden',
      owner: CH,
    };
    expect(corpus(docs).walk(CH, { depth: 0 })).toEqual([missing]);
    expect(corpus(docs).walk(CH, { depth: 1 })).toEqual([
      missing,
      unresolved({ location: WHAT, severity: 'WARN', address: 'world.dd.json#entities/haldn' }, CH),
    ]);
  });
});

describe('rows 30 + 31: doctor and validate report a missing row identically', () => {
  const world = () =>
    corpus({
      [WORLD]: WORLD_DOC,
      [CH]: chapter({
        what: '[H](world.dd.json#entities/halden) and [H](world.dd.json#entities/haldn)',
        introduces: ['world.dd.json#entities/halden', 'world.dd.json#entities/haldn'],
      }),
    });

  const expected = [
    unresolved({ location: `${INTRODUCES}[1]`, severity: 'ERROR' }, CH),
    unresolved({ location: WHAT, severity: 'WARN', address: 'world.dd.json#entities/haldn' }, CH),
  ];

  it('doctor reports one ERROR for the typed miss and one WARN for the inline miss', () => {
    const report = world().doctor();
    expect(report.findings).toEqual(expected);
    expect(report.counts).toEqual({ error: 1, warn: 1 });
  });

  it("the walk and a reconstruction of doctor's edge pass produce identical findings", () => {
    const corpusUnderTest = world();
    const walked = corpusUnderTest.walk(CH);
    const edgePass = corpusUnderTest
      .graph(CH)
      .edges.filter((edge) => edge.kind !== 'file' && edge.from === CH)
      .flatMap((edge) =>
        corpusUnderTest.resolveInterior(edge.address, {
          fromPath: edge.from,
          location: edge.location,
          inline: edge.origin === 'inline',
        }),
      );
    expect(walked).toEqual(expected);
    expect(edgePass).toEqual(expected);
  });
});
