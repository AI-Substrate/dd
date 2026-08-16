import { describe, expect, it } from 'vitest';
import type { DdDoc, ResolvedDdSchema } from '../../../../src/core/model.js';
import { FILE_LINK_TARGET, type SchemaResolver } from '../../../../src/core/validate.js';
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
  /**
   * The path a document-relative resolution would INVENT for `src/library.ts`
   * cited from `docs/nested/`. Naming it makes the failure legible: if the fence
   * goes, this is the string that shows up in `loads`, and it is a file that does
   * not exist anywhere in the repository.
   */
  const INVENTED = docPath('docs/nested/src/library.ts');

  const SCHEMA: ResolvedDdSchema = {
    name: 'test/citing',
    sections: {
      // Repo-root relative, by the file-target contract.
      implemented_by: { shape: { type: 'link', target: FILE_LINK_TARGET } },
      // An ordinary dd edge beside it. Without this the loader instrument proves
      // nothing: an empty `loads` is also what a traversal that never ran looks
      // like.
      dependency: { shape: { type: 'link', target: 'test/citing/section/phases' } },
    },
  } as ResolvedDdSchema;

  const WORLD: Record<string, DdDoc> = {
    [CITING]: {
      dd: { schema: 'test/citing' },
      sections: [
        { name: 'implemented_by', value: 'src/library.ts' },
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
        return { ok: false, path, reason: 'missing', message: `address target is missing: ${path}` };
      }
      return { ok: true, path, doc: found, sha: `sha-${path}`, tracked: true };
    }
  }

  const WORLD_SCHEMAS: SchemaResolver = { resolve: () => ({ ok: true, schema: SCHEMA }) };

  it('never loads, queues or resolves an ordinary file named by a target:file cell', () => {
    const loader = new WorldLoader();
    const graph = traverseCorpus([CITING], { schemaResolver: WORLD_SCHEMAS, docLoader: loader }, {
      repoRoot: REPO,
      mode: 'sweep',
    });

    // The whole finding, in one assertion: the ordinary file is absent, and the
    // dd neighbour beside it is present, so the traversal demonstrably ran.
    expect(loader.loads).toEqual([CITING, CHILD]);
    expect(loader.loads).not.toContain(INVENTED);
    expect(graph.visited).toEqual([CITING, CHILD]);

    // Phase 1 defers the ordinary-file edge rather than emitting a wrong one.
    // A document-relative edge here would be worse than no edge: every reader of
    // the graph would take `docs/nested/src/library.ts` for the cited file.
    expect(graph.edges).toEqual([
      expect.objectContaining({ from: CITING, to: CHILD, address: 'child.dd.json#phases' }),
    ]);
    expect(graph.edges.map((edge) => edge.to)).not.toContain(INVENTED);
    expect(graph.issues).toEqual([]);
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
