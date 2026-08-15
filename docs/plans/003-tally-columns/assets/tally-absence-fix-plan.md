# Tally-absence fix plan

Source: `BRIEF-tally-absence.md`
Branch: `fix/tally-absent-vs-wrong`
Parent: `969a35930761754f45d25093e671ef8e8f9706a3`

## Decision

A computed tally cell is a mismatch only when that exact stored cell is present and disagrees. Absence is silent at both row-total and footer comparison sites. No written-state inference, render/write-path change, validation repair mode, alias, or compatibility path.

## Fleet roster

- PM: `pij-collective-viper` · `github-copilot/gpt-5.6-sol:xhigh` · worktree `/Users/jordanknight/substrate/dd-worktrees/tally-absent`
- Coder: `pij-watery-octopus` · pane `%33` · `github-copilot/claude-opus-5:xhigh` · spawned by PM via `--harness pi --bin omp`
- Reviewer: `pij-molecular-cobra` · pane `%34` · `github-copilot/gpt-5.6-terra:xhigh` · spawned by PM at first REVIEW via `--harness pi --bin omp`
- Delegation `dlg-0001`: superseded before delivery because its packet omitted the custom ledger directory from the explicit forbidden list.
- Review ordering note: the first verdict arrived before the independent-instrument contract that judged it. It independently mutated the implementation but reused the coder-authored unit-test probe, so it did not supply a hand-authored `ddocs validate` route; review was reopened only for that four-case measurement.

## Phase: Tally absence mismatch fix

Allowed implementation paths:

- `src/core/tally.ts`
- tally-focused tests under `test/`

Forbidden paths:

- `.the-flow-state.json`
- `the-flow.json`
- `the-flow.md`
- `.flow-pair/`
- `docs/plans/003-tally-columns/assets/tally-absence-flow-pair/`
- render path
- write path
- `dd build`

Required observable cases, each as a separate assertion:

1. Nothing stored: no mismatch.
2. Partial correct footer (`tally: {a: 10}`): only the stored cell is checked; absent `b` and `t` are silent.
3. Correct hand-filled row totals with no footer: silent.
4. Wrong stored value (`tally.a: 99` for a true sum of `10`): mismatch still reported unchanged.

Review proof:

- Independent reviewer checks the two comparison sites and all four assertions.
- Dim-0 mutation: temporarily remove or invert the stored-presence guard, run the focused test to RED, restore, rerun to GREEN.
- PM sanity glance covers the load-bearing guard and mutation receipt.

Release gate before push:

- Full suite under a clean temporary `HOME`.
- `ddocs doctor`.
- `just checks`.
- Commit with `harness commit`, push branch, open PR, then wait for all CI checks green.
- Stop before merge, tag, or release.
