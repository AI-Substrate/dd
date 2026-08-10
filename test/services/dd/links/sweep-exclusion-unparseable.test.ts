import { describe, expect, it } from 'vitest';
import type { SchemaResolver } from '../../../../src/core/validate.js';
import { traverseCorpus } from '../../../../src/links/traverse.js';

/**
 * wl-0025 — a `.dd.json` that does not PARSE must still be excluded from a sweep.
 *
 * `links/doctor.ts` promises the exclusion is "what lets a repository keep a
 * known-bad corpus committed and still run a green `harness checks`" — and a
 * document bad enough not to parse is the most obvious known-bad document anyone
 * would commit. It did not work: the loader failed first, `link-scan-incomplete`
 * was reported, and the envelope degraded for a file the sweep meant to skip.
 *
 * The cause was ordering, not logic. `shouldExcludeFromSweep` is two predicates —
 * `sweep_exclude` (needs the parsed doc) and the fixture PATH (needs nothing) —
 * and both were asked after the load. The path half now runs before it.
 *
 * NO BAD FIXTURE IS COMMITTED. A loader that refuses is enough to express the
 * defect, and a committed unparseable `.dd.json` would break every other sweep in
 * this repository — which is exactly the trap the finding came out of.
 * Found by `pij-related-meadowlark`, by a coder building a fixture.
 */

const REFUSING_LOADER = {
  load: (path: string) => ({
    ok: false as const,
    path,
    reason: 'unparseable' as const,
    message: `unexpected token in ${path}`,
  }),
};

const NEVER_RESOLVES: SchemaResolver = {
  resolve: () => ({ ok: false as const, reason: 'not-found' as const, message: 'no schema' }),
};

const deps = { schemaResolver: NEVER_RESOLVES, docLoader: REFUSING_LOADER } as never;

const incompleteFor = (seed: string, mode: 'direct' | 'sweep'): number =>
  traverseCorpus([seed], deps, { repoRoot: '/repo', mode }).issues.filter(
    (i) => i.class === 'link-scan-incomplete',
  ).length;

const FIXTURE = '/repo/test/services/dd/links/fixtures/broken.dd.json';
const ORDINARY = '/repo/docs/plans/broken.dd.json';

describe('wl-0025 — the sweep exclusion is reachable for an unparseable document', () => {
  it('CONTROL — an ordinary unparseable seed still reports link-scan-incomplete in a sweep', () => {
    // If this ever goes to 0 the test below proves nothing: it would mean the
    // walk stopped reporting unreadable documents at all, not that the exclusion
    // works. The control is what makes the assertion underneath it readable.
    expect(incompleteFor(ORDINARY, 'sweep')).toBe(1);
  });

  it('a fixture-path document that CANNOT PARSE is skipped by a sweep, silently', () => {
    expect(incompleteFor(FIXTURE, 'sweep')).toBe(0);
  });

  it('CONTROL — `direct` mode never skips, so the same fixture DOES report', () => {
    // OD-1: a caller who named one document gets an answer about it, exclusion or
    // not. This is the arm that proves the fix narrowed nothing beyond sweeps.
    expect(incompleteFor(FIXTURE, 'direct')).toBe(1);
  });
});
