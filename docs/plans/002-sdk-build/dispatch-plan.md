# Plan 002 — dispatch plan

**PM**: `pij-certain-crab` · **Authorized by**: R-5 (Jordan's go, `requirements.md` §2)
**Fleet**: coder `claude-opus-5:high` · reviewer `gpt-5.6-terra:high` · copilot harness (R-5)
**Exit condition**: PR up against `main`, CI green (R-5 — supersedes push-to-main for this plan)
**Worktree**: `dd-worktrees/s002-sdk-build` · branch `s002/sdk-build` — all work here, never main.

> Every phase runs the code-review loop: dispatch → coder implements → cross-model review
> (Dim-0 mutation gate on code) → fix loop → PM sanity pass → commit. Gates per phase:
> `just checks`, **exit code read** (C-6: a transient red is a finding, never a re-run).

## Constraints binding every packet (cite by id, do not restate)

- `requirements.md` §2 R-1 boundary: measurement may establish WHAT IS REQUIRED, never decide
  WHAT IS OFFERED. A coder whose work starts producing exports-map opinions stops and says so.
- §3 C-2: SHA-only pins. C-4: no publish/tags. C-6: transient red = finding.
- §7a S-1 carried constraints: two defect families, separate changes; lowercase-drive test.
- §7a S-2 rider: destination ruled, landing designed — landing waits for P2.
- Forbidden paths: `.the-flow-state.json`, `the-flow.json`, `the-flow.md` (read AND write).
- Stage named files only; `harness commit "<msg>" -- <paths>`; message derived from
  `git diff --cached`.

## Phases

### P1 · Fixture-skeleton measurement (+ F-4 re-derivation) — MEASUREMENT ONLY
Derive from the four surviving harness files (`acts/flow.ts`, `acts/plan/{index,pr-body,fence}.ts`
in upstream, read-only reference) the complete import list + construction shape the §5.1 trial
fixture must reproduce. Output: a measurement doc (`assets/p1-import-census.md`) listing every
symbol, its current dd module, and whether it is publicly reachable today — plus the fixture
skeleton file (imports + construction only, not runnable, no exports-map changes).
Also: re-derive §4.1's module count (F-4 — six-minus-one vs table-of-four discrepancy).
**R-1 boundary applies in full.** Runs in parallel with Track A (research, PM-run).

### P2 · Design decision doc — GATED on P1 + Track A
Q-4 (public surface: floor = P1 import list; width argued from research), Q-5 (root export:
barrel vs drop), S-2 landing (subpath/name/form for `FsDocLoader`). PM drafts from P1+research;
**prime ratifies before implementation**. fr-0001 (schemas travel) answered here as the
adoption story, together with OQ-2's data fault line, never separately.

### P3 · Implement the designed surface
Exports map per P2, `FsDocLoader` move (S-2 landing), root export fix (Q-5), exports
reachability probe updated to the new surface. Review loop; `just checks` green.

### P4 · S-1 Windows drive-letter fix
Two families as **separate commits** (identity-spelling vs absoluteness-detection). Sites:
`src/acts/doctor.ts:129`, `src/acts/graph.ts:385`, `src/core/validate.ts:88`. Lowercase-drive
acceptance case mandatory. `toPosix` is not the fix.

### P5 · §5.1 trial fixture, wired into `just checks`
Fixture per §5.1: installed tarball (rides the redesigned pack gate, `69b9e74` — branch must
carry it, rebase requested from prime), constructs `ConventionSchemaResolver` +
`MemoizingDocLoader` with a fixture-owned foreign fs port, drives a real plan document through
`validate`, imports every P1-census symbol via public subpaths only. Green fixture = ready to
trial (R-4); prime relays to koala.

### P6 · Ship
`just checks` green (exit code read), push `s002/sdk-build`, PR to `main`, CI green.
No tags, no publish. PM attests each edge with `pij report now`.

## Supervision (R-5)
Watchdog on the coder (default 20m interval; tighten if looping observed). PM checks in via
`pij tail` at phase boundaries — not mid-packet interrupts (route by what the receiver is doing).
Questions for Jordan: pij telegram only.
