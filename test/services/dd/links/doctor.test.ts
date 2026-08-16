import { describe, expect, it } from 'vitest';
import type { DdDoc, ResolvedDdSchema } from '../../../../src/core/model.js';
import { FILE_LINK_TARGET } from '../../../../src/core/validate.js';
import type { DocLoader, DocLoadResult } from '../../../../src/core/walk.js';
import { runDoctor } from '../../../../src/links/doctor.js';
import type { DdAdapterGapSource } from '../../../../src/links/model.js';
import type { SchemaFs } from '../../../../src/schema/model.js';
import { deps, docPath, FixtureDocLoader, FixtureFs, REPO } from './helpers.js';

function doctor(adapterGaps?: DdAdapterGapSource, root = REPO) {
  const loader = new FixtureDocLoader();
  return {
    loader,
    report: runDoctor(
      new FixtureFs(),
      { ...deps(loader), ...(adapterGaps && { adapterGaps }) },
      { repoRoot: REPO, root },
    ),
  };
}

const owners = (report: ReturnType<typeof doctor>['report'], issueClass: string) =>
  report.findings.filter((finding) => finding.class === issueClass).map((finding) => finding.owner);

describe('ddocs doctor — the validate engine at radius infinity', () => {
  it('sweeps the corpus and terminates on it', () => {
    const { report } = doctor();
    expect(report.discovered.length).toBeGreaterThanOrEqual(23);
    expect(report.swept.length).toBeGreaterThan(0);
    expect(report.findings.filter((finding) => finding.class === 'link-scan-failed')).toEqual([]);
  });

  it.each([
    ['section-unknown', 'docs/unresolved-section.dd.json'],
    ['part-unknown', 'docs/unresolved-part.dd.json'],
    ['id-not-found', 'docs/unresolved-id.dd.json'],
    ['not-a-container', 'docs/unresolved-not-a-container.dd.json'],
  ] as const)('reports interior reason %s as an ERROR on %s', (reason, relative) => {
    const { report } = doctor();
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          class: 'link-unresolved',
          severity: 'ERROR',
          reason,
          owner: docPath(relative),
        }),
      ]),
    );
  });

  it.each([
    ['address-path-absolute', 'WARN'],
    ['address-path-non-posix', 'WARN'],
    ['address-path-escape', 'WARN'],
    ['address-target-missing', 'WARN'],
    ['address-target-untracked', 'WARN'],
    ['basis-stale', 'WARN'],
    ['link-type-mismatch', 'ERROR'],
    ['state-note-required', 'ERROR'],
  ] as const)('carries the workshop-001 severity for %s', (issueClass, severity) => {
    const { report } = doctor();
    const found = report.findings.filter((finding) => finding.class === issueClass);
    expect(found.length).toBeGreaterThan(0);
    for (const finding of found) expect(finding.severity).toBe(severity);
  });

  it('owns a finding by the file that must change', () => {
    const { report } = doctor();
    // `plan-cites-broken` is clean; the document it cites is not. The finding
    // surfaces on the sweep, but it belongs to the neighbour, because the
    // neighbour is what has to be edited to fix it.
    expect(owners(report, 'state-note-required')).toContain(
      docPath('docs/broken-neighbour.dd.json'),
    );
    expect(owners(report, 'state-note-required')).not.toContain(
      docPath('docs/plan-cites-broken.dd.json'),
    );
  });

  it('reports each finding once, however many roots reach it', () => {
    const { report } = doctor();
    const keys = report.findings.map(
      (finding) => `${finding.owner}|${finding.class}|${finding.location}|${finding.message}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(report.counts.error).toBe(
      report.findings.filter((finding) => finding.severity === 'ERROR').length,
    );
  });

  it('does not report a missing target twice, or at the wrong severity', () => {
    // Resolution cannot reach a target that is not there, but "the file is
    // missing" is already a WARN from the walk — promoting it to an unresolved
    // ERROR here would contradict the severity table.
    const { report } = doctor();
    const missing = report.findings.filter(
      (finding) => finding.owner === docPath('docs/target-missing.dd.json'),
    );
    expect(missing).toEqual([
      expect.objectContaining({ class: 'address-target-missing', severity: 'WARN' }),
    ]);
  });
});

describe('ddocs doctor — the exclusion contract (OD-1, AC-15)', () => {
  it('skips an opted-out document and every finding inside it', () => {
    const { report } = doctor();
    const excluded = docPath('docs/sweep-excluded.dd.json');
    expect(report.discovered).toContain(excluded);
    expect(report.swept).not.toContain(excluded);
    expect(report.findings.some((finding) => finding.owner === excluded)).toBe(false);
  });
});

describe('ddocs doctor — adapter gaps (AC-04, consumed by interface)', () => {
  it('repeats a render-layer adapter gap as a WARN', () => {
    // Phase 3 owns the aggregation; Phase 4 owns only this seam, so the source is
    // faked against the declared shape and no Phase 3 module is imported.
    const source: DdAdapterGapSource = {
      adapterGaps: (paths) => [
        {
          path: paths[0] ?? docPath('docs/plan.dd.json'),
          kind: 'not-found',
          message: 'no adapter for type "burndown"',
          schema: 'links/plan',
          type: 'burndown',
        },
      ],
    };
    const { report } = doctor(source);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          class: 'adapter-gap',
          severity: 'WARN',
          location: '$.adapters[links/plan/burndown]',
        }),
      ]),
    );
  });

  it('reports nothing extra when the render layer is absent', () => {
    const withSource = doctor({ adapterGaps: () => [] }).report.findings.length;
    expect(doctor().report.findings).toHaveLength(withSource);
  });
});

describe('ddocs doctor — scoping', () => {
  it('scopes the root set without changing the radius', () => {
    const { report } = doctor(undefined, `${REPO}/docs/nested`);
    expect(report.discovered).toEqual([
      docPath('docs/nested/child.dd.json'),
      docPath('docs/nested/gateway.dd.json'),
    ]);
    // Radius stays infinite: the walk still leaves the scoped subtree by link.
    expect(report.graph.nodes.map((node) => node.path)).toContain(docPath('docs/plan.dd.json'));
    expect(report.swept).toEqual([
      docPath('docs/nested/child.dd.json'),
      docPath('docs/nested/gateway.dd.json'),
    ]);
  });

  it('reports a bad interior in a document reached BEYOND the scoped subtree', () => {
    // F002 regression. `--path` scopes which documents SEED the sweep; it never
    // caps the walk. `beyond-scope.dd.json` sits outside the scoped subtree and is
    // reached only by a link from inside it — and it is broken on its own terms.
    // Driving the interior pass from the root set alone silently dropped this
    // finding, which is precisely the class of miss a radius-∞ doctor exists to
    // prevent.
    const { report } = doctor(undefined, `${REPO}/docs/nested`);
    const beyond = docPath('docs/beyond-scope.dd.json');
    expect(report.swept).not.toContain(beyond);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          class: 'link-unresolved',
          severity: 'ERROR',
          reason: 'section-unknown',
          owner: beyond,
        }),
      ]),
    );
  });

  it('offers adapter-gap aggregation every reached document, not just the seeds', () => {
    const seen: string[] = [];
    const source: DdAdapterGapSource = {
      adapterGaps: (paths) => {
        seen.push(...paths);
        return [];
      },
    };
    doctor(source, `${REPO}/docs/nested`);
    expect(seen).toContain(docPath('docs/beyond-scope.dd.json'));
    expect(seen).toContain(docPath('docs/nested/gateway.dd.json'));
  });

  it('still excludes an opted-out document from the reached set', () => {
    // The widened pass must not widen past the exclusion contract: a document
    // skipped by `sweep_exclude` never becomes a node, so it is not "reached".
    const seen: string[] = [];
    const source: DdAdapterGapSource = {
      adapterGaps: (paths) => {
        seen.push(...paths);
        return [];
      },
    };
    const { report } = doctor(source);
    const excluded = docPath('docs/sweep-excluded.dd.json');
    expect(seen).not.toContain(excluded);
    expect(report.findings.some((finding) => finding.owner === excluded)).toBe(false);
  });
});

/**
 * The doctor and ordinary files, over a corpus of its own.
 *
 * A separate world rather than more cells in the shared fixture tree: the claim
 * is about what the doctor does NOT do, and proving that needs a loader whose
 * every call is recorded — which the shared corpus's counts-based assertions
 * would not survive.
 */
describe('ddocs doctor — an ordinary file is never a document', () => {
  const SUBJECT = docPath('docs/nested/subject.dd.json');
  const NEIGHBOUR = docPath('docs/nested/neighbour.dd.json');
  /** A Markdown href WITH a fragment: the shape that parses as a qualified address. */
  const FRAGMENT_TARGET = docPath('docs/nested/handbook.md');

  const SCHEMA: ResolvedDdSchema = {
    name: 'test/doctor-files',
    sections: {
      implemented_by: { shape: { type: 'link', target: FILE_LINK_TARGET } },
      notes: { shape: { type: 'text' } },
      dependency: { shape: { type: 'link', target: 'test/doctor-files/section/notes' } },
    },
  } as ResolvedDdSchema;

  const WORLD: Record<string, DdDoc> = {
    [SUBJECT]: {
      dd: { schema: 'test/doctor-files' },
      sections: [
        { name: 'implemented_by', value: 'src/library.ts' },
        // `#section` is the trap. Without the fence this destination parses as a
        // QUALIFIED dd address — file plus interior — so the resolver stops
        // refusing it on grammar and goes and opens `handbook.md` as a document.
        { name: 'notes', value: 'Read the [handbook](handbook.md#section) first.' },
        { name: 'dependency', value: 'neighbour.dd.json#notes' },
      ],
      references: [],
    },
    [NEIGHBOUR]: {
      dd: { schema: 'test/doctor-files' },
      sections: [{ name: 'notes', value: 'Nothing here.' }],
      references: [],
    },
  };

  /** Every ordinary target this corpus can cite; a sweep may be handed a subset. */
  const ALL_PRESENT = [docPath('src/library.ts'), FRAGMENT_TARGET];

  class WorldFs implements SchemaFs {
    constructor(private readonly present: readonly string[] = ALL_PRESENT) {}

    readdir(path: string): string[] {
      if (path === REPO) return ['docs'];
      if (path === docPath('docs')) return ['nested'];
      if (path === docPath('docs/nested')) return ['neighbour.dd.json', 'subject.dd.json'];
      return [];
    }

    exists(path: string): boolean {
      return this.present.includes(path);
    }

    readText(): string | null {
      return null;
    }
  }

  class WorldLoader implements DocLoader {
    readonly loads: string[] = [];

    load(path: string): DocLoadResult {
      this.loads.push(path);
      const found = WORLD[path];
      return found === undefined
        ? { ok: false, path, reason: 'missing', message: `address target is missing: ${path}` }
        : { ok: true, path, doc: found, sha: `sha-${path}`, tracked: true };
    }
  }

  /** Records what the doctor believes the reached DOCUMENT set is. */
  class GapRecorder implements DdAdapterGapSource {
    asked: string[] = [];

    adapterGaps(paths: readonly string[]) {
      this.asked = [...paths];
      return [];
    }
  }

  function sweep(present: readonly string[] = ALL_PRESENT) {
    const loader = new WorldLoader();
    const gaps = new GapRecorder();
    const report = runDoctor(
      new WorldFs(present),
      {
        schemaResolver: { resolve: () => ({ ok: true, schema: SCHEMA }) },
        docLoader: loader,
        adapterGaps: gaps,
      },
      { repoRoot: REPO, root: REPO },
    );
    return { loader, report, gaps };
  }

  it('never opens an ordinary file, not even one whose href carries a fragment', () => {
    const { loader, report } = sweep();
    // The two documents, each loaded once by the sweep and again by the walk —
    // and nothing else. The dd neighbour proves the loader is live.
    expect(new Set(loader.loads)).toEqual(new Set([SUBJECT, NEIGHBOUR]));
    expect(loader.loads).not.toContain(FRAGMENT_TARGET);
    expect(loader.loads).not.toContain(docPath('src/library.ts'));
    expect(report.findings.filter((finding) => finding.class === 'link-scan-failed')).toEqual([]);
  });

  it('keeps ordinary files out of the swept-document metric it reports', () => {
    const { report } = sweep();
    // `swept` answers "which DOCUMENTS did this sweep inspect", and every
    // consumer counts it as documents. An existing ordinary file is a node in the
    // same graph, so the two have to be told apart HERE or the count silently
    // inflates with every code file the corpus cites.
    expect(report.swept).toEqual([NEIGHBOUR, SUBJECT]);
    // …and the file nodes really are in the graph, so the line above is a filter
    // rather than an empty population.
    expect(report.graph.nodes.filter((node) => node.kind === 'file').map((n) => n.path)).toEqual([
      docPath('src/library.ts'),
      FRAGMENT_TARGET,
    ]);
  });

  it('asks the adapter-gap source about documents only', () => {
    const { gaps } = sweep();
    // `adapterGaps` answers a RENDER-layer question — which custom types a
    // document declares and cannot load. A `.ts` path has no custom types, and
    // asking about one invites a finding owned by a file dd does not render.
    expect(gaps.asked.sort()).toEqual([NEIGHBOUR, SUBJECT]);
  });

  it('reports no ERROR for a correct ordinary-file citation', () => {
    const { report } = sweep();
    // A `target: "file"` cell naming a whole file is CORRECT, and the doctor owns
    // interior defects. Reading the refusal as `section-unknown` would make every
    // ordinary-file citation in a corpus an ERROR — which is exactly what
    // happened before the reason was named.
    expect(report.findings.filter((finding) => finding.severity === 'ERROR')).toEqual([]);
    expect(report.findings.filter((finding) => finding.class === 'link-unresolved')).toEqual([]);
    expect(report.counts.error).toBe(0);
  });

  it('still reports a genuine interior failure in the same sweep', () => {
    // Non-vacuity: silence about ordinary files must not be silence about
    // everything. One broken dd interior, same corpus, same run.
    const broken = { ...WORLD[SUBJECT] } as DdDoc;
    broken.sections = [
      ...(WORLD[SUBJECT] as DdDoc).sections.slice(0, 2),
      { name: 'dependency', value: 'neighbour.dd.json#nosuchsection' },
    ];
    const report = runDoctor(
      new WorldFs(),
      {
        schemaResolver: { resolve: () => ({ ok: true, schema: SCHEMA }) },
        docLoader: {
          load: (path) => {
            const doc = path === SUBJECT ? broken : WORLD[path];
            return doc === undefined
              ? { ok: false, path, reason: 'missing', message: 'missing' }
              : { ok: true, path, doc, sha: 'sha', tracked: true };
          },
        },
      },
      { repoRoot: REPO, root: REPO },
    );
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          class: 'link-unresolved',
          severity: 'ERROR',
          reason: 'section-unknown',
        }),
      ]),
    );
  });

  it('says nothing about ordinary files that are all there', () => {
    const { report } = sweep();
    expect(report.findings.filter((finding) => finding.class === 'address-target-missing')).toEqual(
      [],
    );
    expect(report.counts).toEqual({ error: 0, warn: 0 });
  });

  it('reports a missing ordinary file with the class, location and owner build reports', () => {
    // Same corpus, one file removed from the world. The sweep must not be the
    // one surface that stays quiet: before this, `ddocs build` degraded on this
    // document while `ddocs doctor` called the whole corpus healthy.
    const { report } = sweep([FRAGMENT_TARGET]);
    expect(report.findings.filter((finding) => finding.class === 'address-target-missing')).toEqual(
      [
        {
          class: 'address-target-missing',
          severity: 'WARN',
          location: '$.sections[implemented_by].value',
          message: 'file link target is missing: src/library.ts',
          owner: SUBJECT,
        },
      ],
    );
    expect(report.counts.error).toBe(0);
  });
});
