FIX_REQUIRED

# P4 / S-1 review — `5b6ad12` + `f9b7b03`

## Finding

- **P1 — the disclosed backslash-rooted widening is untested.** `src/core/validate.ts`
  now sends `\foo` through `isRootAnchored()` after normalizing it to `/foo`, so it emits
  `address-path-absolute`. The stated behavior is in the commit message and
  `docs/plans/002-sdk-build/assets/p4-notes.md`, but it is not a test row:
  `git grep -nE "\\\\\\\\foo|\\\\foo" f9b7b03 -- test` has no matches; the only
  `address-path-absolute` fixture is
  `test/services/dd/fixtures/warn/absolute-path.dd.json`, whose path is
  `/repo/other.dd.json`. Neither P4 test file adds this validation case. Add a direct
  validation row for a backslash-rooted address and assert the warning class before
  accepting the behavior widening.

## Required checks completed

- **Dim-0, independently in a clean `/tmp/dd-p4-review.JuFLlq` archive of `f9b7b03`:**
  baseline targeted suites were 30/30 green. Replacing `canonicalFilePath()` with
  `normalizeFilePath(raw)` made F1's `path-identity` suite fail 5/10 while both F2 suites
  stayed 16/16 green. Changing `ABSOLUTE_FILE_PATH` to reject only
  `[A-Za-z]:/other/` made F2 core absoluteness fail 3/6 while F1 identity stayed 10/10
  green. Restored after each mutation.
- **F2 sites are individually non-vacuous:** reverting only the `doctor` call to the old
  `startsWith('/')` scope guard failed exactly its three drive rows while graph rows stayed
  green; the equivalent isolated `graph` mutation failed exactly its three graph rows.
  The F1 suite stayed green under the doctor mutation.
- **Family split and S-1 constraints:** `5b6ad12` changes only F2's two acts, core
  absolute predicate, and F2 tests; `f9b7b03` changes only private core canonicalization,
  F1 tests, and notes. The core implementation uses a predicate/slash normalization, not
  `toPosix` as its fix; lowercase drive rows, POSIX pass-through, and relative re-anchor
  rows are present.
- **Mirrored constant deviation:** both regexes are textually
  `/^([A-Za-z]:)?\//`. Adding
  `import { resolveInRepo } from '../shared/posix-path.js'` to archived
  `core/validate.ts` made `dd-core-isolation.test.ts` fail with
  `node builtin: core/validate.ts -> shared/posix-path.ts -> node:path`; the architecture
  test therefore actually forces the deviation.
- **Surface neutrality:** `git diff --exit-code 68bc594..f9b7b03 -- package.json` exits
  0; `src/links/index.ts` is unchanged; public declaration names from
  `src/core/validate.ts` are identical at the baseline and reviewed commit. The added
  helpers are private.
- **Exposure ordering:** an archive of F2-only `5b6ad12` passes its own F2 suite 16/16.
  Running the F1 identity pin from `f9b7b03` against that F2-only code fails 5/10
  (lowercase identity and loader route), proving F2 exposes the separate F1 defect and
  the F1 pin is real.

