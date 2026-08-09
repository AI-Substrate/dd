import { describe, expect, it } from 'vitest';
import { isPathWithinRepo, resolveAddressFile } from '../../../../src/core/validate.js';
import type { DocLoader, DocLoadResult } from '../../../../src/core/walk.js';
import { resolveLink } from '../../../../src/links/resolver.js';
import { resolveInRepo, toPosix } from '../../../../src/shared/posix-path.js';
import { FixtureDocLoader, FixtureSchemaResolver } from '../links/helpers.js';

/**
 * S-1 · F1 — identity spelling. The SECOND defect family, and a different kind
 * of wrong from the first: F2 was "this path went to the wrong place", F1 is
 * "this path went to the right place under a name nothing else uses".
 *
 * A resolved path is an IDENTITY here. It is compared with `===`
 * (`core/walk.ts:123`, `render/refresh.ts:147`), used as an index key
 * (`plan/index-plan.ts`), and used as the memoizing loader's CACHE key. Two
 * spellings of one document therefore become two documents.
 *
 * dd has TWO producers of that identity and they spelled it differently:
 *
 *   - `shared/posix-path.ts` (`toPosix`, `posixJoin`, `resolveInRepo`) UPPER-CASES
 *     a drive letter. This is the spelling of every path that arrives from the
 *     filesystem: `repoRoot` is `toPosix(cwd())` (`acts/shared.ts:193`) and every
 *     swept path is `posixJoin`-built (`links/scan.ts:47`).
 *   - `core/address.ts`'s `normalizeFilePath` does NOT. This is the spelling of
 *     every path that arrives from a parsed dd ADDRESS, via `resolveAddressFile`.
 *
 * `links/resolver.ts:176-179` picks between the two IN ONE EXPRESSION, on
 * nothing more than whether the address has a citing document:
 *
 *     const targetPath =
 *       address.file === null ? options.fromPath
 *       : options.fromPath === null ? resolveInRepo(address.file, options.repoRoot)
 *       : resolveAddressFile(options.fromPath, address.file);
 *
 * so ONE address text resolves to two different strings depending on where it
 * was written. That is the whole defect, and it is why the fix belongs in
 * `core/validate.ts` rather than at either call site: making the two producers
 * agree fixes every consumer at once.
 *
 * REACHABILITY, stated precisely. This was NOT reachable before the F2 commit
 * (`5b6ad12`): a drive-letter address was re-anchored before it could be
 * mis-spelled, so it failed for the other reason. F2 stops the re-anchoring and
 * hands the path through in the SPELLING THE AUTHOR USED — which is what arms
 * this one. The two families are distinct in kind and ordered in exposure, and
 * that ordering is exactly why S-1 insists they be fixed as two commits and why
 * a lowercase-drive test is mandatory: it is the only thing that catches the
 * second family being left behind by the first.
 *
 * `normalizeFilePath` itself is deliberately NOT changed — it is exported from
 * the public `./core/address` subpath, so its spelling is surface, not detail.
 * See `docs/plans/002-sdk-build/assets/p4-notes.md`.
 */

const REPO = 'C:/repo';
const PLAN = 'C:/repo/docs/plan.dd.json';
const EVIDENCE = 'C:/repo/docs/evidence.dd.json';

describe('resolveAddressFile — S-1 F1 identity spelling', () => {
  it.each([
    ['c:/repo/docs/evidence.dd.json'],
    ['C:/repo/docs/evidence.dd.json'],
    ['C:\\repo\\docs\\evidence.dd.json'],
    ['c:\\repo\\docs\\evidence.dd.json'],
  ])('%s is one identity, however it is spelled', (target) => {
    expect(resolveAddressFile(PLAN, target)).toBe(EVIDENCE);
  });

  it('agrees with the filesystem-side producer on the same document', () => {
    // The convergence itself, asserted against the OTHER grammar rather than
    // against a literal — a literal would still pass if both drifted together.
    expect(resolveAddressFile(PLAN, 'c:/repo/docs/evidence.dd.json')).toBe(
      resolveInRepo('c:/repo/docs/evidence.dd.json', REPO),
    );
    expect(resolveAddressFile(PLAN, 'c:/repo/docs/evidence.dd.json')).toBe(
      toPosix('c:\\repo\\docs\\evidence.dd.json'),
    );
  });

  it('leaves POSIX paths exactly as they were (regression)', () => {
    expect(resolveAddressFile('/repo/docs/plan.dd.json', 'evidence.dd.json')).toBe(
      '/repo/docs/evidence.dd.json',
    );
    expect(resolveAddressFile('/repo/docs/plan.dd.json', '/other/e.dd.json')).toBe(
      '/other/e.dd.json',
    );
  });
});

describe('isPathWithinRepo — S-1 F1 identity spelling', () => {
  it('a document is inside its own repo however the drive is spelled', () => {
    expect(isPathWithinRepo('c:/repo/docs/plan.dd.json', 'C:/repo')).toBe(true);
    expect(isPathWithinRepo('C:/repo/docs/plan.dd.json', 'c:/repo')).toBe(true);
  });

  it('still refuses a path that genuinely leaves the repo (regression)', () => {
    expect(isPathWithinRepo('c:/elsewhere/plan.dd.json', 'C:/repo')).toBe(false);
    expect(isPathWithinRepo('/elsewhere/plan.dd.json', '/repo')).toBe(false);
    expect(isPathWithinRepo('/repo/docs/plan.dd.json', '/repo')).toBe(true);
  });
});

/**
 * A DRIVE-MOUNTED loader: it answers for exactly the canonical `C:/repo/…`
 * spelling and for nothing else. That strictness is the instrument — it is what
 * turns "spelled differently" into an observable ("this document does not
 * exist"), which is what a user would actually see. A case-insensitive loader
 * would hide the very thing under test.
 */
class DriveMountedLoader implements DocLoader {
  readonly loads: string[] = [];
  private readonly inner = new FixtureDocLoader();

  load(path: string): DocLoadResult {
    this.loads.push(path);
    if (!path.startsWith(`${REPO}/`)) {
      return { ok: false, path, reason: 'missing', message: `address target is missing: ${path}` };
    }
    return this.inner.load(`/repo/${path.slice(`${REPO}/`.length)}`);
  }
}

describe('resolveLink — one address, one document, whoever cites it', () => {
  function resolve(raw: string, fromPath: string | null) {
    const loader = new DriveMountedLoader();
    const result = resolveLink(
      raw,
      { schemaResolver: new FixtureSchemaResolver(), docLoader: loader },
      { repoRoot: REPO, fromPath },
    );
    return { result, loads: loader.loads };
  }

  it('resolves a lowercase-drive address to the same document from either side', () => {
    const raw = 'c:/repo/docs/evidence.dd.json#entries';
    // Route 1 — no citing document: `resolveInRepo`, the filesystem grammar.
    const bare = resolve(raw, null);
    // Route 2 — cited from a document: `resolveAddressFile`, the address grammar.
    const cited = resolve(raw, PLAN);

    expect(bare.loads).toEqual([EVIDENCE]);
    expect(cited.loads).toEqual([EVIDENCE]);
    expect(bare.result.ok).toBe(true);
    expect(cited.result.ok).toBe(true);
  });

  it('an upper-case-drive address behaves identically (control)', () => {
    const cited = resolve('C:/repo/docs/evidence.dd.json#entries', PLAN);
    expect(cited.loads).toEqual([EVIDENCE]);
    expect(cited.result.ok).toBe(true);
  });
});
