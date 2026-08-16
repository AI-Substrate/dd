import { describe, expect, it } from 'vitest';
import type { DdDoc, ResolvedDdSchema } from '../../../../src/core/model.js';
import {
  collectFileRefs,
  FILE_LINK_TARGET,
  type FileExistence,
  type SchemaResolver,
  validateFileRefs,
} from '../../../../src/core/validate.js';
import type { DocLoader, DocLoadResult } from '../../../../src/core/walk.js';
import type { DdLinkEdge } from '../../../../src/links/model.js';
import { reachableFrom, traverseCorpus } from '../../../../src/links/traverse.js';
import { deps, docPath, FixtureDocLoader, REPO } from './helpers.js';

function traverse(seeds: string[], mode: 'direct' | 'sweep' = 'sweep') {
  const loader = new FixtureDocLoader();
  return { loader, graph: traverseCorpus(seeds, deps(loader), { repoRoot: REPO, mode }) };
}

describe('ddocs links traversal — loop breakers', () => {
  it('terminates the two-document loop, visiting each document once', () => {
    const { loader, graph } = traverse([
      docPath('docs/cycle-a.dd.json'),
      docPath('docs/cycle-b.dd.json'),
    ]);
    // This is the mutation-sensitive assertion: without the visited set the queue
    // never drains, the derived tripwire fires, and both expectations below fail
    // in milliseconds instead of hanging the suite.
    expect(loader.loads).toEqual([
      docPath('docs/cycle-a.dd.json'),
      docPath('docs/cycle-b.dd.json'),
    ]);
    expect(graph.issues).toEqual([]);
    expect(graph.visited).toHaveLength(2);
    expect(graph.edges).toHaveLength(2);
  });

  it('terminates a document that cites itself', () => {
    const { loader, graph } = traverse([docPath('docs/self-cycle.dd.json')]);
    expect(loader.loads).toEqual([docPath('docs/self-cycle.dd.json')]);
    expect(graph.visited).toEqual([docPath('docs/self-cycle.dd.json')]);
    // Self-reference by path, not by the bare-`#` form: the edge still points
    // back at its own document, which is what the visited set has to survive.
    expect(graph.edges[0]).toMatchObject({
      from: docPath('docs/self-cycle.dd.json'),
      to: docPath('docs/self-cycle.dd.json'),
      sameDocument: false,
    });
    expect(graph.issues).toEqual([]);
  });

  it('records the bare-# form as a same-document edge', () => {
    const { graph } = traverse([docPath('docs/bare-same-doc.dd.json')]);
    expect(graph.edges).toEqual([
      expect.objectContaining({
        sameDocument: true,
        to: docPath('docs/bare-same-doc.dd.json'),
      }),
    ]);
    expect(graph.visited).toHaveLength(1);
  });

  it('terminates the whole corpus at radius infinity', () => {
    const seeds = [
      docPath('docs/cycle-a.dd.json'),
      docPath('docs/self-cycle.dd.json'),
      docPath('docs/plan.dd.json'),
      docPath('docs/nested/child.dd.json'),
    ];
    const { loader, graph } = traverse(seeds);
    expect(new Set(loader.loads).size).toBe(loader.loads.length);
    expect(graph.issues.filter((issue) => issue.class === 'link-scan-failed')).toEqual([]);
  });

  it('does not trip its own tripwire on a document with two missing neighbours', () => {
    // F001 regression. The tripwire counts POPS against SCHEDULED paths. Counting
    // it against successfully *loaded* paths instead made this exact shape fail:
    // one seed plus two distinct missing targets is three legitimate pops against
    // a bound of two, so a perfectly terminating walk reported itself as a scan
    // failure — and the doctor turned two ruled WARNs into an E439 ERROR.
    const { graph } = traverse([docPath('docs/two-missing-neighbours.dd.json')]);
    expect(graph.issues.filter((issue) => issue.class === 'link-scan-failed')).toEqual([]);
    expect(graph.issues.filter((issue) => issue.severity === 'ERROR')).toEqual([]);
    expect(graph.edges.map((edge) => edge.to)).toEqual([
      docPath('docs/gone-one.dd.json'),
      docPath('docs/gone-two.dd.json'),
    ]);
  });

  it('scales that bound with the number of missing neighbours, not the loaded ones', () => {
    // The same shape at greater width: every additional missing target is another
    // legitimate pop, so a bound that ignores them gets worse as the corpus grows.
    const seed = `${REPO}/docs/many-missing.dd.json`;
    const targets = Array.from({ length: 12 }, (_, index) => `missing-${index}.dd.json`);
    const doc = {
      dd: { schema: 'links/plan' },
      sections: [
        { name: 'phases', value: [{ id: 'ph-1a2b', brief: 'many missing neighbours' }] },
        {
          name: 'citations',
          value: targets.map((path, index) => ({ id: `ct-${index}`, cite: `${path}#entries` })),
        },
      ],
      references: [],
    };
    const inner = new FixtureDocLoader();
    const graph = traverseCorpus(
      [seed],
      {
        schemaResolver: deps().schemaResolver,
        docLoader: {
          load: (path) =>
            path === seed
              ? { ok: true as const, path, doc: doc as never, sha: 'sha-many', tracked: true }
              : inner.load(path),
        },
      },
      { repoRoot: REPO, mode: 'sweep' },
    );
    expect(graph.issues.filter((issue) => issue.class === 'link-scan-failed')).toEqual([]);
    expect(graph.edges).toHaveLength(targets.length);
  });
});

describe('ddocs links traversal — edges and nodes', () => {
  it('records every schema-declared link cell as an edge', () => {
    const { graph } = traverse([docPath('docs/plan.dd.json')]);
    expect(graph.edges).toEqual([
      expect.objectContaining({
        from: docPath('docs/plan.dd.json'),
        to: docPath('docs/evidence.dd.json'),
        address: 'evidence.dd.json#entries',
        target: 'links/evidence/section/entries',
        sameDocument: false,
      }),
      expect.objectContaining({
        address: 'evidence.dd.json#entries/ev-5e6f',
        to: docPath('docs/evidence.dd.json'),
      }),
    ]);
  });

  it('marks documents reached by a link but never seeded as external', () => {
    const { graph } = traverse([docPath('docs/plan.dd.json')]);
    expect(graph.nodes).toEqual([
      expect.objectContaining({ path: docPath('docs/plan.dd.json'), external: false }),
      expect.objectContaining({
        path: docPath('docs/evidence.dd.json'),
        schema: 'links/evidence',
        external: true,
      }),
    ]);
  });

  it('never follows an address out of the repository', () => {
    const { graph, loader } = traverse([docPath('docs/path-escape.dd.json')]);
    expect(graph.edges[0]?.to).toBeNull();
    expect(loader.loads).toEqual([docPath('docs/path-escape.dd.json')]);
  });

  it('reports a document whose schema will not resolve instead of calling it a leaf', () => {
    const { graph } = traverse([docPath('docs/plan.dd.json')], 'direct');
    const unknown = traverseCorpus(
      [docPath('docs/plan.dd.json')],
      {
        schemaResolver: { resolve: () => ({ ok: false, message: 'schema not found: links/plan' }) },
        docLoader: new FixtureDocLoader(),
      },
      { repoRoot: REPO, mode: 'direct' },
    );
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(unknown.edges).toEqual([]);
    expect(unknown.nodes).toEqual([
      expect.objectContaining({ path: docPath('docs/plan.dd.json'), schema: 'links/plan' }),
    ]);
    expect(unknown.issues).toEqual([
      expect.objectContaining({ class: 'link-scan-incomplete', severity: 'WARN' }),
    ]);
  });

  it('reports an unreadable seed, and stays silent about an unreadable neighbour', () => {
    const seeded = traverse([docPath('docs/missing.dd.json')]);
    expect(seeded.graph.issues).toEqual([
      expect.objectContaining({ class: 'link-scan-incomplete', severity: 'WARN' }),
    ]);
    // A neighbour that will not load is dd-core's `address-target-missing` WARN,
    // owned by the document that points at it — repeating it here would double it.
    const neighbour = traverse([docPath('docs/target-missing.dd.json')]);
    expect(neighbour.graph.issues).toEqual([]);
    expect(neighbour.graph.edges[0]?.to).toBe(docPath('docs/missing.dd.json'));
  });
});

describe('ddocs links traversal — an ordinary file is not a document', () => {
  const CITING = docPath('docs/nested/citing.dd.json');
  const CHILD = docPath('docs/nested/child.dd.json');
  /** Repo-root anchored, because that is where a structured `target: "file"` path is ruled to sit. */
  const LIBRARY = docPath('src/library.ts');
  /** Document-relative, because that is the href a reader clicks in the generated sibling. */
  const HANDBOOK = docPath('docs/handbook.md');
  /**
   * The path a document-relative resolution would INVENT for `src/library.ts`
   * cited from `docs/nested/`. Naming it makes the failure legible: if the two
   * bases are ever collapsed into one, this is the string that shows up — and it
   * is a file that does not exist anywhere in the repository.
   */
  const INVENTED = docPath('docs/nested/src/library.ts');

  const SCHEMA: ResolvedDdSchema = {
    name: 'test/citing',
    sections: {
      // Repo-root relative, by the file-target contract.
      implemented_by: { shape: { type: 'link', target: FILE_LINK_TARGET } },
      // Document-relative: an inline Markdown link inside declared prose.
      notes: { shape: { type: 'text' } },
      // An ordinary dd edge beside them. Without this the loader instrument
      // proves nothing: an empty `loads` is also what a traversal that never ran
      // looks like.
      dependency: { shape: { type: 'link', target: 'test/citing/section/phases' } },
    },
  } as ResolvedDdSchema;

  const WORLD: Record<string, DdDoc> = {
    [CITING]: {
      dd: { schema: 'test/citing' },
      sections: [
        { name: 'implemented_by', value: 'src/library.ts' },
        { name: 'notes', value: 'See the [handbook](../handbook.md) before editing.' },
        { name: 'dependency', value: 'child.dd.json#phases' },
      ],
      references: [],
    },
    [CHILD]: {
      dd: { schema: 'test/citing' },
      sections: [{ name: 'phases', value: [] }],
      references: [],
    },
  };

  class WorldLoader implements DocLoader {
    readonly loads: string[] = [];

    load(path: string): DocLoadResult {
      this.loads.push(path);
      const found = WORLD[path];
      if (found === undefined) {
        return {
          ok: false,
          path,
          reason: 'missing',
          message: `address target is missing: ${path}`,
        };
      }
      return { ok: true, path, doc: found, sha: `sha-${path}`, tracked: true };
    }
  }

  const WORLD_SCHEMAS: SchemaResolver = { resolve: () => ({ ok: true, schema: SCHEMA }) };

  /** Existence over a named world, recording every path it was asked about. */
  class Present implements FileExistence {
    readonly probes: string[] = [];

    constructor(private readonly present: ReadonlySet<string>) {}

    exists(path: string): boolean {
      this.probes.push(path);
      return this.present.has(path);
    }
  }

  function walk(present: Iterable<string>) {
    const loader = new WorldLoader();
    const existence = new Present(new Set(present));
    const graph = traverseCorpus(
      [CITING],
      { schemaResolver: WORLD_SCHEMAS, docLoader: loader, fileExistence: existence },
      { repoRoot: REPO, mode: 'sweep' },
    );
    return { graph, loader, existence };
  }

  const BOTH = [LIBRARY, HANDBOOK];

  it('never loads, queues or resolves an ordinary file named by a target:file cell', () => {
    const { graph, loader } = walk(BOTH);

    // The whole finding, in one assertion: the ordinary files are absent from the
    // loader, and the dd neighbour beside them is present, so the traversal
    // demonstrably ran.
    expect(loader.loads).toEqual([CITING, CHILD]);
    expect(loader.loads).not.toContain(LIBRARY);
    expect(loader.loads).not.toContain(HANDBOOK);
    expect(loader.loads).not.toContain(INVENTED);
    expect(graph.visited).toEqual([CITING, CHILD]);
    expect(graph.issues).toEqual([]);
  });

  it('anchors a structured path on the repository root and a Markdown href on the document', () => {
    const { graph } = walk(BOTH);
    expect(graph.edges).toEqual([
      {
        kind: 'document',
        from: CITING,
        to: CHILD,
        address: 'child.dd.json#phases',
        location: '$.sections[dependency].value',
        target: 'test/citing/section/phases',
        rel: 'ref',
        sameDocument: false,
      },
      {
        kind: 'file',
        from: CITING,
        to: LIBRARY,
        address: 'src/library.ts',
        location: '$.sections[implemented_by].value',
        target: FILE_LINK_TARGET,
        rel: 'ref',
        sameDocument: false,
      },
      {
        kind: 'file',
        from: CITING,
        to: HANDBOOK,
        address: '../handbook.md',
        location: '$.sections[notes].value',
        rel: 'ref',
        sameDocument: false,
      },
    ]);
    expect(graph.edges.map((edge) => edge.to)).not.toContain(INVENTED);
  });

  it('makes an existing ordinary file a resolved terminal node carrying nothing it did not measure', () => {
    const { graph, existence } = walk(BOTH);
    expect(existence.probes).toEqual([LIBRARY, HANDBOOK]);
    expect(graph.nodes).toEqual([
      expect.objectContaining({ kind: 'document', path: CITING }),
      { kind: 'file', path: LIBRARY },
      { kind: 'file', path: HANDBOOK },
      expect.objectContaining({ kind: 'document', path: CHILD }),
    ]);
    // No invented digest, tracking flag or schema — the probe read nothing, so
    // there is nothing honest to put in those fields.
    const file = graph.nodes.find((node) => node.path === LIBRARY);
    expect(Object.keys(file ?? {})).toEqual(['kind', 'path']);
  });

  it('leaves a missing ordinary file as an edge with no node, and still never opens it', () => {
    const { graph, loader } = walk([HANDBOOK]);
    expect(graph.nodes.map((node) => node.path)).toEqual([CITING, HANDBOOK, CHILD]);
    // The citation survives its target's absence: the edge is what a reader needs
    // to see in order to fix the path.
    expect(graph.edges).toContainEqual(expect.objectContaining({ kind: 'file', to: LIBRARY }));
    expect(loader.loads).toEqual([CITING, CHILD]);
  });

  it('emits edges but no file nodes when no existence probe was supplied', () => {
    const loader = new WorldLoader();
    const graph = traverseCorpus(
      [CITING],
      { schemaResolver: WORLD_SCHEMAS, docLoader: loader },
      { repoRoot: REPO, mode: 'sweep' },
    );
    // "I did not check" and "it is not there" must not render the same way as
    // each other by accident, but they DO render the same way here on purpose:
    // only a measured existence earns a resolved node.
    expect(graph.edges.filter((edge) => edge.kind === 'file')).toHaveLength(2);
    expect(graph.nodes.every((node) => node.kind === 'document')).toBe(true);
    expect(loader.loads).toEqual([CITING, CHILD]);
  });

  it('refuses to probe a path that escapes the repository', () => {
    const escaping: Record<string, DdDoc> = {
      [CITING]: {
        dd: { schema: 'test/citing' },
        sections: [{ name: 'implemented_by', value: '../../etc/passwd' }],
        references: [],
      },
    };
    const existence = new Present(new Set());
    const graph = traverseCorpus(
      [CITING],
      {
        schemaResolver: WORLD_SCHEMAS,
        docLoader: {
          load: (path) => {
            const found = escaping[path];
            return found === undefined
              ? { ok: false, path, reason: 'missing', message: 'missing' }
              : { ok: true, path, doc: found, sha: 'sha', tracked: true };
          },
        },
        fileExistence: existence,
      },
      { repoRoot: REPO, mode: 'sweep' },
    );
    // The probe is a host call. dd does not make one about a path outside the
    // tree it was asked about — the same rule `validateFileRefs` holds.
    expect(existence.probes).toEqual([]);
    expect(graph.edges).toEqual([expect.objectContaining({ kind: 'file', to: null })]);
    expect(graph.nodes.map((node) => node.kind)).toEqual(['document']);
  });
});

describe('ddocs links traversal — sweep exclusion (OD-1)', () => {
  const excluded = docPath('docs/sweep-excluded.dd.json');

  it('skips an opted-out document in sweep mode only', () => {
    const paths = (mode: 'direct' | 'sweep') =>
      traverse([excluded], mode).graph.nodes.map((node) => node.path);
    expect(paths('sweep')).toEqual([]);
    expect(paths('direct')).toContain(excluded);
  });

  it('skips fixture-path documents in sweep mode only', () => {
    const loader = new FixtureDocLoader();
    const asFixture = `${REPO}/test/services/dd/fixtures/plan.dd.json`;
    const load = (mode: 'direct' | 'sweep') =>
      traverseCorpus(
        [asFixture],
        {
          schemaResolver: deps(loader).schemaResolver,
          docLoader: {
            load: (path) => ({ ...loader.load(docPath('docs/plan.dd.json')), path }) as never,
          },
        },
        { repoRoot: REPO, mode, follow: false },
      );
    expect(load('sweep').nodes).toEqual([]);
    expect(load('direct').nodes).toEqual([expect.objectContaining({ path: asFixture })]);
  });
});

describe('ddocs links traversal — reachability over a built edge list', () => {
  const edge = (from: string, to: string | null): DdLinkEdge => ({
    kind: 'document',
    from,
    to,
    address: `${to ?? 'nowhere'}#entries`,
    location: '$.sections[citations].value[0].cite',
    // `rel` is required by DdLinkEdge and was absent upstream — a latent type error
    // upstream's tsconfig never saw, because it includes only `src`. `ref` is the
    // default the type's own doc comment names, and `reachableFrom` reads only
    // `from`/`to`, so this completes the fixture without touching what it proves.
    // (plan 001, tk-0006)
    rel: 'ref',
    sameDocument: false,
  });

  it('closes over the whole component, transitively', () => {
    // The doctor's component skip depends on this: a walk rooted anywhere in a
    // component must already cover the component, or it re-validates documents
    // it has already answered for.
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('x', 'y')];
    expect([...reachableFrom('a', edges)].sort()).toEqual(['a', 'b', 'c']);
    expect([...reachableFrom('x', edges)].sort()).toEqual(['x', 'y']);
  });

  it('terminates on a cycle and on a self-reference', () => {
    expect([...reachableFrom('a', [edge('a', 'b'), edge('b', 'a')])].sort()).toEqual(['a', 'b']);
    expect([...reachableFrom('a', [edge('a', 'a')])]).toEqual(['a']);
  });

  it('follows nothing through an edge that never resolved to a file', () => {
    expect([...reachableFrom('a', [edge('a', null), edge('a', 'b')])].sort()).toEqual(['a', 'b']);
  });

  it('returns the seed alone when nothing leaves it', () => {
    expect([...reachableFrom('lonely', [edge('a', 'b')])]).toEqual(['lonely']);
  });
});

/**
 * The graph and the validator must probe the SAME bytes.
 *
 * `traverseCorpus` draws an arrow at whatever it resolves a reference to, and
 * `validateFileRefs` reports "missing" about whatever IT resolves the same
 * reference to. Those are two copies of one anchoring rule, sitting in two
 * layers that may not import each other — so if they ever diverge, `ddocs graph`
 * shows an edge into a file `ddocs build` never checked, and neither side has a
 * test that notices.
 *
 * This is that test, and it is deliberately not an assertion about either
 * implementation: the SAME recorder is handed to both, and the two probe lists
 * are compared. It cannot pass by agreeing with itself.
 */
describe('ddocs links traversal — the graph probes what the validator probes', () => {
  const DOC = docPath('docs/plans/nested/subject.dd.json');

  const SCHEMA: ResolvedDdSchema = {
    name: 'test/agreement',
    sections: {
      implemented_by: { shape: { type: 'link', target: FILE_LINK_TARGET } },
      notes: { shape: { type: 'text' } },
    },
  } as ResolvedDdSchema;

  const SUBJECT: DdDoc = {
    dd: { schema: 'test/agreement' },
    sections: [
      // Every shape the anchoring has to get right at once: a repo-root path, a
      // sibling href, an href carrying a fragment, one climbing out of the
      // subtree, and the negatives that must never be probed at all.
      { name: 'implemented_by', value: 'src/deep/library.ts' },
      {
        name: 'notes',
        value: [
          'See [a](./a.md), [b](../b.md), [c](../../c.md#section),',
          '[d](https://example.com/x.md), [e](#anchor) and ![f](../img.png).',
        ].join(' '),
      },
    ],
    references: [],
  };

  class Recorder implements FileExistence {
    readonly probes: string[] = [];

    exists(path: string): boolean {
      this.probes.push(path);
      return false;
    }
  }

  it('resolves both populations to the same paths the existence check tests', () => {
    const fromGraph = new Recorder();
    traverseCorpus(
      [DOC],
      {
        schemaResolver: { resolve: () => ({ ok: true, schema: SCHEMA }) },
        docLoader: {
          load: (path) =>
            path === DOC
              ? { ok: true, path, doc: SUBJECT, sha: 'sha', tracked: true }
              : { ok: false, path, reason: 'missing', message: 'missing' },
        },
        fileExistence: fromGraph,
      },
      { repoRoot: REPO, mode: 'sweep' },
    );

    const fromValidator = new Recorder();
    validateFileRefs(collectFileRefs(SUBJECT, SCHEMA), DOC, REPO, fromValidator);

    expect(fromGraph.probes).toEqual(fromValidator.probes);
    // Non-vacuity: two empty lists are also equal. Name what the shared list must
    // contain, so an agreement on nothing cannot pass.
    expect(fromGraph.probes).toEqual([
      docPath('src/deep/library.ts'),
      docPath('docs/plans/nested/a.md'),
      docPath('docs/plans/b.md'),
      docPath('docs/c.md'),
    ]);
  });
});
