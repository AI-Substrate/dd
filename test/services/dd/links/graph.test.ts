import { describe, expect, it } from 'vitest';
import { toMermaid } from '../../../../src/links/graph.js';
import type { DdCorpusGraph, DdGraphNode, DdLinkEdge } from '../../../../src/links/model.js';
import { linksFor, resolveLinksTarget } from '../../../../src/links/report.js';
import { scanCorpus } from '../../../../src/links/scan.js';
import { traverseCorpus } from '../../../../src/links/traverse.js';
import { deps, docPath, FixtureFs, REPO } from './helpers.js';

function corpus(seeds?: string[]) {
  const paths = seeds ?? scanCorpus(new FixtureFs(), REPO).paths;
  return traverseCorpus(paths, deps(), { repoRoot: REPO, mode: 'sweep' });
}

describe('ddocs graph — direct mermaid emission', () => {
  it('emits a valid, deterministic mermaid flowchart', () => {
    const graph = corpus([docPath('docs/plan.dd.json')]);
    const mermaid = toMermaid(graph, REPO);
    expect(mermaid).toBe(
      [
        'flowchart LR',
        '  n0["docs/evidence.dd.json"]',
        '  n1["docs/plan.dd.json"]',
        '  n1 --> n0',
        '  n1 --> n0',
        '',
      ].join('\n'),
    );
    expect(toMermaid(corpus([docPath('docs/plan.dd.json')]), REPO)).toBe(mermaid);
  });

  it('draws an unresolved target as a dashed edge instead of dropping it', () => {
    const mermaid = toMermaid(corpus([docPath('docs/target-missing.dd.json')]), REPO);
    expect(mermaid).toContain('-.->');
    expect(mermaid).toContain('docs/missing.dd.json');
    expect(mermaid).toContain('classDef unresolved');
  });

  it('labels an out-of-repo edge by its address, since it has no node', () => {
    const mermaid = toMermaid(corpus([docPath('docs/path-escape.dd.json')]), REPO);
    expect(mermaid).toContain('["../../../outside.dd.json#entries"]');
  });

  it('covers the whole corpus without emitting a duplicate node', () => {
    const mermaid = toMermaid(corpus(), REPO);
    const ids = [...mermaid.matchAll(/^ {2}([nu]\d+)\[/gm)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(mermaid.startsWith('flowchart LR\n')).toBe(true);
  });
});

describe('ddocs links — inbound and outbound, by local scan', () => {
  const plan = docPath('docs/plan.dd.json');
  const evidence = docPath('docs/evidence.dd.json');

  it('reports what a document points at', () => {
    const report = linksFor(plan, corpus());
    expect(report.outbound.map((edge) => edge.address)).toEqual([
      'evidence.dd.json#entries',
      'evidence.dd.json#entries/ev-5e6f',
    ]);
  });

  it('reports what points at a document, across folders', () => {
    const report = linksFor(plan, corpus());
    expect(report.inbound.map((edge) => edge.from)).toContain(docPath('docs/nested/child.dd.json'));
  });

  it('finds every citer of a widely-referenced document', () => {
    const report = linksFor(evidence, corpus());
    const citers = new Set(report.inbound.map((edge) => edge.from));
    expect(citers).toContain(plan);
    expect(citers).toContain(docPath('docs/basis-stale.dd.json'));
    expect(citers).toContain(docPath('docs/type-match.dd.json'));
    expect(report.outbound).toEqual([]);
  });

  it('never counts a document as its own inbound edge', () => {
    const selfCycle = docPath('docs/self-cycle.dd.json');
    const report = linksFor(selfCycle, corpus());
    expect(report.outbound).toHaveLength(1);
    expect(report.inbound).toEqual([]);
  });

  it.each([
    ['docs/plan.dd.json', docPath('docs/plan.dd.json')],
    ['docs/plan.dd.json#phases/ph-1a2b', docPath('docs/plan.dd.json')],
    [docPath('docs/plan.dd.json'), docPath('docs/plan.dd.json')],
  ])('resolves the target argument %s to a document', (given, expected) => {
    expect(resolveLinksTarget(given, REPO)).toBe(expected);
  });
});

describe('ddocs graph — an ordinary file is a terminal node, or a dashed one', () => {
  const citing = docPath('docs/nested/citing.dd.json');
  const present = docPath('src/library.ts');
  const absent = docPath('src/gone.ts');

  /**
   * Hand-built, because the subject is exactly the RELATIONSHIP between the node
   * list and the edge list: `toMermaid` draws an edge solid when its target is a
   * node and dashed when it is not, and that is the whole visual distinction
   * between a file that exists and one that does not. Building the graph here
   * pins the rule at the one place it is decided, with no traversal in the way.
   */
  function graph(nodes: DdGraphNode[], edges: DdLinkEdge[]): DdCorpusGraph {
    return { nodes, edges, issues: [], visited: [citing] };
  }

  const fileEdge = (to: string, address: string): DdLinkEdge => ({
    kind: 'file',
    from: citing,
    to,
    address,
    location: '$.sections[implemented_by].value',
    target: 'file',
    rel: 'implemented_by',
    sameDocument: false,
  });

  const document: DdGraphNode = {
    kind: 'document',
    path: citing,
    schema: 'test/citing',
    sha: 'sha-citing',
    tracked: true,
    external: false,
  };

  it('draws a solid edge into an existing file, labelled by its repository path', () => {
    const mermaid = toMermaid(
      graph([document, { kind: 'file', path: present }], [fileEdge(present, 'src/library.ts')]),
      REPO,
    );
    expect(mermaid).toContain('["src/library.ts"]');
    expect(mermaid).toContain('|implemented_by|');
    expect(mermaid).not.toContain('-.->');
    expect(mermaid).not.toContain('classDef unresolved');
  });

  it('draws only the missing file dashed, with the existing one solid beside it', () => {
    const mermaid = toMermaid(
      graph(
        [document, { kind: 'file', path: present }],
        [fileEdge(present, 'src/library.ts'), fileEdge(absent, 'src/gone.ts')],
      ),
      REPO,
    );
    expect(mermaid).toContain('["src/gone.ts"]');
    // One of each: the distinction is only meaningful when both are on the page.
    expect(mermaid.match(/ -->\|/g)).toHaveLength(1);
    expect(mermaid.match(/ -\.->\|/g)).toHaveLength(1);
    expect(mermaid).toContain('classDef unresolved');
  });

  it('reports both cell origins as inbound edges of the ordinary file', () => {
    const incidental: DdLinkEdge = {
      kind: 'file',
      from: docPath('docs/other.dd.json'),
      to: present,
      address: '../../src/library.ts',
      location: '$.sections[notes].value',
      rel: 'ref',
      sameDocument: false,
    };
    const report = linksFor(
      present,
      graph(
        [document, { kind: 'file', path: present }],
        [fileEdge(present, 'src/library.ts'), incidental],
      ),
    );
    expect(report.inbound.map((edge) => edge.from)).toEqual([
      citing,
      docPath('docs/other.dd.json'),
    ]);
    // A terminal node has no outbound edges — it was never opened, so there is
    // nothing inside it that could point anywhere.
    expect(report.outbound).toEqual([]);
  });
});
