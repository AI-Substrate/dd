import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs gate script, no types emitted for scripts/
import { classify } from '../scripts/audit-gate.mjs';

/**
 * The dependency audit gate's decision, pinned against fixture reports.
 *
 * WHY FIXTURES RATHER THAN THE REAL COMMAND: `npm audit` reaches the registry, so
 * an end-to-end test would be slow and would red on a network blip — and this
 * repository has spent a day proving that a gate which reds for reasons nobody
 * can act on gets skipped. But the alternative, leaving the logic unpinned, is
 * worse: the gate replaced `npm audit --audit-level=high || true`, a step that
 * could not fail and reported success over six high advisories for the life of
 * the branch. Nothing would catch an edit that quietly restored that. So the
 * decision is a pure function and every branch of it is asserted here.
 *
 * The FOURTH case is the one that matters most and the one a fixture can prove
 * where a live audit cannot: a dev advisory that has BECOME fixable must red.
 * Today all six dev advisories are unfixable transitives under vitest — a
 * limitation record, and those go stale silently. The exemption is therefore not
 * a package list and not a date; it is a question re-asked every run. This test
 * is what proves the question is still being asked.
 */

const report = (
  entries: Record<string, { severity: string; fixAvailable?: unknown }>,
): { vulnerabilities: Record<string, { severity: string; fixAvailable: unknown }> } => ({
  vulnerabilities: Object.fromEntries(
    Object.entries(entries).map(([name, v]) => [
      name,
      { severity: v.severity, fixAvailable: v.fixAvailable ?? false },
    ]),
  ),
});

const EMPTY = report({});

describe('audit gate — blocks on actionable, reports on unactionable', () => {
  it('passes a clean tree', () => {
    const verdict = classify(EMPTY, EMPTY);
    expect(verdict.production).toEqual([]);
    expect(verdict.devActionable).toEqual([]);
    expect(verdict.devUnactionable).toEqual([]);
  });

  it('BLOCKS on a production advisory, fix available or not', () => {
    const prod = report({ 'left-pad': { severity: 'high' } });
    const verdict = classify(prod, prod);
    expect(verdict.production.map((f: { name: string }) => f.name)).toEqual(['left-pad']);
    // It reached a user's install; there is always something to do about that,
    // even if the something is a workaround rather than an upgrade.
    expect(verdict.devActionable).toEqual([]);
  });

  it('does NOT block on a dev-only advisory with no fix — the state of this repo today', () => {
    const verdict = classify(EMPTY, report({ vitest: { severity: 'high', fixAvailable: false } }));
    expect(verdict.production).toEqual([]);
    expect(verdict.devActionable).toEqual([]);
    expect(verdict.devUnactionable.map((f: { name: string }) => f.name)).toEqual(['vitest']);
  });

  it('BLOCKS the moment a dev advisory becomes fixable — the anti-staleness mechanism', () => {
    const verdict = classify(
      EMPTY,
      report({ vitest: { severity: 'high', fixAvailable: { name: 'vitest', version: '9.9.9' } } }),
      () => true,
    );
    expect(verdict.devUnactionable).toEqual([]);
    expect(verdict.devPending).toEqual([]);
    expect(verdict.devActionable.map((f: { name: string }) => f.name)).toEqual(['vitest']);
  });

  /**
   * The case that reddened this branch on 2026-08-09, now pinned.
   *
   * `fixAvailable` is a PROXY for "actionable" and it is REGISTRY-RELATIVE: CI
   * saw nanoid as fixable while the local mirror 404'd the fixed version. Nobody
   * can act on a version their registry will not serve, so it is PENDING —
   * distinct from both blocking and clean, and it reds by itself the day the
   * registry catches up. No list, no date, nothing to remember.
   */
  it('defers a dev fix the registry cannot serve — PENDING, not blocking, not clean', () => {
    const unreachable = report({
      nanoid: { severity: 'high', fixAvailable: { name: 'nanoid', version: '3.3.17' } },
    });
    const verdict = classify(EMPTY, unreachable, () => false);
    expect(verdict.devActionable).toEqual([]);
    expect(verdict.devUnactionable).toEqual([]);
    expect(verdict.devPending.map((f: { name: string }) => f.name)).toEqual(['nanoid']);
  });

  it('NEVER defers a PRODUCTION advisory, even when the fix is unreachable', () => {
    const prod = report({
      evil: { severity: 'critical', fixAvailable: { name: 'evil', version: '2.0.0' } },
    });
    // Same unreachable-registry predicate as the case above — and it must not
    // touch this column. A shipped vulnerability is not made safe by being
    // unfixable; that is an emergency for a human, not a gate downgrade.
    const verdict = classify(prod, prod, () => false);
    expect(verdict.production.map((f: { name: string }) => f.name)).toEqual(['evil']);
    expect(verdict.devPending).toEqual([]);
  });

  it('treats a bare `fixAvailable: true` as reachable — it names no version to probe', () => {
    const verdict = classify(EMPTY, report({ x: { severity: 'high', fixAvailable: true } }), () => {
      throw new Error('the reachability probe must not run when there is no version to check');
    });
    expect(verdict.devActionable.map((f: { name: string }) => f.name)).toEqual(['x']);
  });

  it('ignores severities below high, in both trees', () => {
    const noisy = report({ a: { severity: 'moderate' }, b: { severity: 'low' } });
    const verdict = classify(noisy, noisy);
    expect(verdict.production).toEqual([]);
    expect(verdict.devActionable).toEqual([]);
    expect(verdict.devUnactionable).toEqual([]);
  });

  it('counts a package as production, never twice, when it appears in both reports', () => {
    const both = report({ lodash: { severity: 'high', fixAvailable: true } });
    const verdict = classify(both, both);
    expect(verdict.production).toHaveLength(1);
    // Same package in both trees is ONE production finding, not a production
    // finding plus a dev one — otherwise a single advisory reads as two.
    expect(verdict.devActionable).toEqual([]);
    expect(verdict.devUnactionable).toEqual([]);
  });

  it('treats critical as blocking, not just high', () => {
    const crit = report({ evil: { severity: 'critical' } });
    expect(classify(crit, crit).production.map((f: { name: string }) => f.name)).toEqual(['evil']);
  });
});
