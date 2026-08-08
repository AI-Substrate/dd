import { describe, expect, it } from 'vitest';
import { isPathWithinRepo, resolveAddressFile } from '../../../../src/core/validate.js';

/**
 * S-1 · F2 — absoluteness detection, at the CORE site.
 *
 * `resolveAddressFile` tested absoluteness with `posixTarget.startsWith('/')`,
 * so a drive-letter address target was read as RELATIVE and re-anchored under
 * the CITING DOCUMENT's directory:
 *
 *   resolveAddressFile('/repo/docs/plan.dd.json', 'C:/other/evidence.dd.json')
 *     -> '/repo/docs/C:/other/evidence.dd.json'
 *
 * This is the third site named in requirements §7a S-1, and the one upstream
 * deferred — it will never arrive by forward port. It is also the site that
 * matters most for an SDK: `resolveAddressFile` is exported from the public
 * `./core/validate` subpath, and its output is used as an IDENTITY (compared
 * with `===` in `core/walk.ts` and `render/refresh.ts`, and as an index key in
 * `plan/index-plan.ts`).
 *
 * The predicate deliberately mirrors `shared/posix-path.ts`'s `ABSOLUTE_LOGICAL`
 * rather than importing it: dd-core is transitively free of `node:` builtins
 * (`test/architecture/dd-core-isolation.test.ts`) and `shared/posix-path.ts`
 * imports `node:path`.
 *
 * SCOPE OF THIS FILE: re-anchoring only. What SPELLING a passed-through
 * drive-letter path lands in is the other defect family and is pinned in
 * `path-identity.test.ts` — so the lowercase row here asserts only that the
 * path was not re-anchored, deliberately saying nothing about drive case.
 */
describe('resolveAddressFile — S-1 F2 absoluteness detection', () => {
  const FROM = '/repo/docs/plan.dd.json';

  it.each([
    ['C:/other/evidence.dd.json'],
    ['C:\\other\\evidence.dd.json'],
    ['c:/other/evidence.dd.json'],
  ])('%s is recognised as absolute, not glued onto the citing document', (target) => {
    const resolved = resolveAddressFile(FROM, target);
    expect(resolved.startsWith('/repo/')).toBe(false);
    expect(resolved.toLowerCase()).toBe('c:/other/evidence.dd.json');
  });

  it('a POSIX-absolute target still passes through (regression)', () => {
    expect(resolveAddressFile(FROM, '/elsewhere/evidence.dd.json')).toBe(
      '/elsewhere/evidence.dd.json',
    );
  });

  it('a genuinely relative target still re-anchors on the citing document (regression)', () => {
    expect(resolveAddressFile(FROM, '../evidence/e.dd.json')).toBe('/repo/evidence/e.dd.json');
    expect(resolveAddressFile(FROM, 'nested/e.dd.json')).toBe('/repo/docs/nested/e.dd.json');
  });

  it('a drive-letter repo still contains its own documents (regression)', () => {
    expect(isPathWithinRepo('C:/repo/docs/plan.dd.json', 'C:/repo')).toBe(true);
    expect(isPathWithinRepo('C:/elsewhere/plan.dd.json', 'C:/repo')).toBe(false);
  });
});
