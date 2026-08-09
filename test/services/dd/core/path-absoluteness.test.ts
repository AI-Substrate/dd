import { describe, expect, it } from 'vitest';
import { parse } from '../../../../src/core/parse.js';
import {
  type DdIssue,
  isPathWithinRepo,
  resolveAddressFile,
  validateDocument,
} from '../../../../src/core/validate.js';
import { FixtureSchemaResolver } from '../helpers.js';

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

/**
 * The DISCLOSED WIDENING of the `address-path-absolute` finding — pinned as a row
 * rather than left as prose.
 *
 * The finding used to ask its own question:
 *
 *   address.file.startsWith('/') || /^[A-Za-z]:[\\/]/.test(address.file)
 *
 * A backslash-rooted path with NO drive letter — `\repo\other.dd.json` — answered
 * NO to both halves, so it was silently accepted as relative. It was root-anchored
 * the whole time; nobody was ever told. Collapsing both of this module's
 * absoluteness questions onto `isRootAnchored` (which slash-normalises first) means
 * the WARN now fires on it.
 *
 * This lives in the F2 file because it is an absoluteness-DETECTION behaviour: the
 * predicate changed, and this is the input on which the new predicate and the old
 * one disagree. It is not an identity-spelling question, so it does not belong in
 * `path-identity.test.ts`.
 *
 * The pair of assertions is the point. The FINDING widened; the RESOLUTION did
 * not — `resolveAddressFile` slash-normalised before testing even before the fix,
 * so `\repo\other.dd.json` always passed through unanchored. Reporting a WARN for
 * a path that was already being treated as absolute is the report catching up with
 * the behaviour, not a new behaviour.
 */
describe('address-path-absolute — the backslash-rooted widening', () => {
  const DOC_PATH = '/repo/docs/plan.dd.json';
  const REPO_ROOT = '/repo';

  /** A document whose one address target is backslash-rooted and drive-letter free. */
  function backslashRootedIssues(): DdIssue[] {
    const doc = parse(
      JSON.stringify({
        dd: { schema: 'test/plan', spec: 'dd@1' },
        sections: [
          {
            name: 'tasks',
            value: [
              {
                id: 'tk-a1b2',
                title: 'Backslash-rooted path',
                state: 'checked',
                dependency: '\\repo\\other.dd.json#tasks/tk-b2c3',
              },
            ],
          },
        ],
        references: [],
      }),
    );
    if (Array.isArray(doc)) throw new Error(`inline fixture failed to parse: ${doc[0]?.message}`);
    return validateDocument(doc, DOC_PATH, new FixtureSchemaResolver(), REPO_ROOT);
  }

  it('reports address-path-absolute for a backslash-rooted, drive-letter-free path', () => {
    expect(backslashRootedIssues()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ class: 'address-path-absolute', severity: 'WARN' }),
      ]),
    );
  });

  it('still reports address-path-non-posix for it, and neither finding is an ERROR', () => {
    const issues = backslashRootedIssues();
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ class: 'address-path-non-posix', severity: 'WARN' }),
      ]),
    );
    expect(issues.filter((issue) => issue.severity === 'ERROR')).toEqual([]);
  });

  it('resolves it unchanged — the report widened, the resolution did not', () => {
    expect(resolveAddressFile(DOC_PATH, '\\repo\\other.dd.json')).toBe('/repo/other.dd.json');
    expect(isPathWithinRepo('/repo/other.dd.json', REPO_ROOT)).toBe(true);
  });
});
