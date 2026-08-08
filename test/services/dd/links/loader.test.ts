import { describe, expect, it } from 'vitest';
import { FsDocLoader, MemoizingDocLoader } from '../../../../src/links/index.js';

/**
 * `FsDocLoader` at its new home — the D-2 landing, asserted at the IMPORT-PATH
 * level.
 *
 * Every symbol here is imported from `src/links/index.js` and not from
 * `src/links/loader.js`, on purpose. `links/index.ts` is what `@ai-substrate/dd
 * /links` resolves to, so importing the barrel is the only version of this test
 * that says anything a consumer can use. A module-path import would still pass if
 * the barrel forgot to re-export the class, which is the exact regression the
 * landing exists to prevent.
 *
 * BEHAVIOUR IS UNCHANGED by the move — the class body is byte-identical to the one
 * that lived in `src/acts/shared.ts`. What is new is that it had NO direct test at
 * all: it was covered only through the acts that constructed it, which is why the
 * rows below assert the loader's own contract rather than re-testing a verb.
 *
 * THE TYPE SIGNATURES ARE STRUCTURAL, and that is load-bearing rather than
 * incidental. In `acts/` the constructor named `Pick<FsPort,'readText'>` and
 * `HashPort`; those live in `src/adapters/`, which the SDK-tree purity gate
 * forbids `src/links/` from importing (`test/architecture/dd-core-isolation
 * .test.ts`, ac-0001). So `links/loader.ts` declares the two shapes itself, the
 * way `render/refresh.ts` and `schema/model.ts` already do. The stand-ins below
 * are plain object literals that name no dd type whatsoever — if they compile and
 * run, a foreign consumer port compiles and runs, which is the property the P1
 * census (group C) measured and the trial fixture depends on.
 */

/** A fs stand-in that names no dd type — the point of the structural signature. */
function fsWith(files: Record<string, string>) {
  return {
    readText(path: string): string | null {
      return files[path] ?? null;
    },
  };
}

/** A hash stand-in, likewise nominally unrelated to dd's own `HashPort`. */
const countingHash = {
  calls: 0,
  sha256Hex(input: string): string {
    countingHash.calls += 1;
    return `sha(${input.length})`;
  },
};

const DOC = JSON.stringify({
  dd: { schema: 'test/plan', spec: 'dd@1' },
  sections: [],
  references: [],
});

describe('FsDocLoader — reachable from the ./links barrel', () => {
  it('is exported by name from the barrel a consumer imports', () => {
    expect(typeof FsDocLoader).toBe('function');
    expect(FsDocLoader.name).toBe('FsDocLoader');
  });

  it('loads a document, hashing its text', () => {
    const loader = new FsDocLoader(fsWith({ '/repo/a.dd.json': DOC }), countingHash, null);
    const result = loader.load('/repo/a.dd.json');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toBe('/repo/a.dd.json');
    expect(result.sha).toBe(`sha(${DOC.length})`);
  });

  it('reports a missing file as missing rather than throwing', () => {
    const loader = new FsDocLoader(fsWith({}), countingHash, null);
    const result = loader.load('/repo/gone.dd.json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('missing');
  });

  it('reports an unparseable file as missing, not as a crash', () => {
    const loader = new FsDocLoader(
      fsWith({ '/repo/bad.dd.json': '{ not json' }),
      countingHash,
      null,
    );
    const result = loader.load('/repo/bad.dd.json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('missing');
    expect(result.message).toContain('not a readable dd document');
  });

  /**
   * The `tracked` contract, which is the one piece of this class that is a
   * judgement rather than plumbing: null means "this host has no tracking
   * concept", NOT "everything is tracked". Reading null as false would suppress
   * every untracked-target WARN silently.
   */
  it('treats a null tracked-set as "no tracking concept", not as untracked', () => {
    const loader = new FsDocLoader(fsWith({ '/repo/a.dd.json': DOC }), countingHash, null);
    const result = loader.load('/repo/a.dd.json');
    expect(result.ok && result.tracked).toBe(true);
  });

  it('honours a real tracked-set in both directions', () => {
    const files = { '/repo/in.dd.json': DOC, '/repo/out.dd.json': DOC };
    const loader = new FsDocLoader(fsWith(files), countingHash, new Set(['/repo/in.dd.json']));
    expect(loader.load('/repo/in.dd.json')).toMatchObject({ ok: true, tracked: true });
    expect(loader.load('/repo/out.dd.json')).toMatchObject({ ok: true, tracked: false });
  });

  /**
   * The census's C1/C3 shape: `MemoizingDocLoader(new FsDocLoader(...))`, one
   * expression, in every measured consumer. Both halves now come from the same
   * barrel — which is the whole point of the landing, since the decorator was
   * public while the thing it decorates was not (census group B1, fr-0010).
   */
  it('composes under MemoizingDocLoader from the same barrel, reading the file once', () => {
    const before = countingHash.calls;
    const loader = new MemoizingDocLoader(
      new FsDocLoader(fsWith({ '/repo/a.dd.json': DOC }), countingHash, null),
    );
    loader.load('/repo/a.dd.json');
    loader.load('/repo/a.dd.json');
    expect(countingHash.calls - before).toBe(1);
  });
});
