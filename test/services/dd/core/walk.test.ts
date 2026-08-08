import { describe, expect, it } from 'vitest';
import type { DdDoc } from '../../../../src/core/model.js';
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
