# P1 — Fixture-skeleton measurement (+ F-4 re-derivation)

**Phase**: P1 of `dispatch-plan.md`. **MEASUREMENT ONLY** — R-1 boundary applies in full
(`requirements.md` §2 R-1 scope ruling): you may establish WHAT IS REQUIRED; you may NOT decide
WHAT IS OFFERED. If your work starts producing opinions about the exports map, STOP and report.

## Tasks

### T1 — Trial import census
Read the four surviving harness consumer files in the upstream repo (READ-ONLY reference,
never write there): `/Users/jordanknight/substrate/harness-engineering/harness/cli/src/acts/flow.ts`
and `acts/plan/{index,pr-body,fence}.ts`. For every dd import and every dd-type construction
they perform, record in `docs/plans/002-sdk-build/assets/p1-import-census.md`:
- symbol · dd module where it lives today (path in THIS repo's src/) · publicly reachable
  today? (against the CURRENT exports map in package.json — derive, don't assert; cite the
  command you ran per row-group)
- construction shape: the exact injection expressions (e.g. the MemoizingDocLoader/FsDocLoader
  nesting at flow.ts:126) — these are what the §5.1 fixture must reproduce.

### T2 — Fixture skeleton (non-runnable)
Write `test/trial-fixture/skeleton.ts` in this worktree: import statements + construction
expressions ONLY, mirroring T1, with a fixture-owned foreign fs port stub (interface only).
It will NOT compile while symbols are unexported — that is the point; it is the measurement.
Mark unresolvable imports with a `// UNREACHABLE:` comment naming the missing export.
Do NOT modify package.json, exports, or any src/ file. Do NOT wire into any build/test lane
yet (P5's job) — keep it excluded from tsconfig if needed so `just checks` stays green.

### T3 — F-4 re-derivation
`requirements.md` §4.1 says `src/plan/` imports six modules absent from the exports map, one
reachable via links/index, table names four. Re-derive the actual count from src/plan/ imports
vs the exports map. Record the true numbers + the command in
`docs/plans/002-sdk-build/assets/p1-f4-rederivation.md`. Do not edit requirements.md.

## Gates
`just checks` must remain green (exit code read — C-6: transient red is a finding, report it,
never silently re-run). Commit with `harness commit "<msg>" -- <named files>` — named files
only, never a directory. Message derived from `git diff --cached`.

## Forbidden
`.the-flow-state.json`, `the-flow.json`, `the-flow.md` (read AND write) · any write outside
this worktree · any write to upstream harness-engineering · exports-map changes · publish/tags.
