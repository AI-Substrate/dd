# P4 — S-1 Windows drive-letter re-anchoring fix

**Phase**: P4 of `dispatch-plan.md`. Full context: `requirements.md` §7a S-1 (read it first —
it carries the constraints verbatim). This phase changes NO exports-map surface — it fixes
path-detection logic in place.

## The defect (already reproduced, §7a)
Three sites test absoluteness with `startsWith('/')`; a drive-letter path (`C:/Users/...`)
fails that test, is treated as relative, and re-anchors under the repo root:

| Site | Function |
|---|---|
| `src/acts/doctor.ts:129` | `resolveScope` |
| `src/acts/graph.ts:385` | `resolveScope` (identical copy) |
| `src/core/validate.ts:88` | `resolveAddressFile` |

## Hard constraints (from upstream's own split — cite S-1, do not re-derive the policy)
1. **Two distinct defect families → two separate commits**: identity-spelling vs
   absoluteness-detection. Do NOT fix as one change.
2. `toPosix` is NOT the fix — it fires on forward-slash drive-letter paths too.
3. Tests MUST include a **lowercase-drive** case (`c:/...`): `toPosix` upper-cases the drive
   letter while `normalizeFilePath` does not, so correctness currently depends on run order —
   the test exists to pin that down.
4. Use dd's internal `src/shared/posix-path.ts` primitives (`resolveInRepo`,
   `ABSOLUTE_LOGICAL`-style detection as upstream did) — do NOT create any new public export
   (design ratification is in flight; this phase is surface-neutral by definition).
5. Posix absolutes must still pass through; genuinely relative paths must still re-anchor —
   regression cases for both.

## Tasks
- T1 (commit 1): absoluteness-detection family — fix the three sites' detection; tests:
  drive-letter upper + lower, posix absolute, relative, forward-slash drive-letter.
- T2 (commit 2): identity-spelling family — whatever normalization inconsistency remains per
  upstream's split (derive it from the sites; record what you found in the commit message).
- T3: note in `docs/plans/002-sdk-build/assets/p4-notes.md` — what each family was, evidence
  commands, and any deviation you had to make from the upstream fix pattern.

## Gates
`just checks` green, exit code read (C-6: transient red = finding — capture and report, never
silently re-run). `harness commit "<msg>" -- <named files>` per commit; two commits minimum
(one per family) plus the notes file (may ride with T2's commit).

## Allowed paths
`src/acts/doctor.ts`, `src/acts/graph.ts`, `src/core/validate.ts`, `src/shared/posix-path.ts`
(read; extend only if the fix pattern genuinely requires a new internal helper — internal,
never exported), `test/**` (new test files for these cases), `docs/plans/002-sdk-build/assets/`.

## Forbidden
package.json / exports map / any new public symbol · `.the-flow-state.json`, `the-flow.json`,
`the-flow.md` · writes outside the worktree · src/plan/ · upstream repo (read-only reference).
