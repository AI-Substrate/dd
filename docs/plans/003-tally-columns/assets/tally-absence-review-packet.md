# Independent review packet — tally absence

## Action

Review delegation `dlg-0002` independently. Return `APPROVE`, `APPROVE_WITH_NOTES`, or `FIX_REQUIRED` with evidence. Do not implement fixes.

## Identity and baseline

- Repo: `/Users/jordanknight/substrate/dd-worktrees/tally-absent`
- Branch: `fix/tally-absent-vs-wrong`
- Parent: `969a35930761754f45d25093e671ef8e8f9706a3`
- Coder: `pij-watery-octopus` · `github-copilot/claude-opus-5:xhigh`
- Reviewer: `pij-molecular-cobra` · `github-copilot/gpt-5.6-terra:xhigh`
- Worker packet: `docs/plans/003-tally-columns/assets/tally-absence-flow-pair/runs/2026-08-14T02-02-50Z-github.com-AI-Substr/prompts/dlg-0002.md`
- Captured diff: `docs/plans/003-tally-columns/assets/tally-absence-flow-pair/runs/2026-08-14T02-02-50Z-github.com-AI-Substr/diffs/diff-0001.patch`
- Rubric: `/Users/jordanknight/pi-hacking/pij/skills/flow-pair/references/review-rubrics.md`

## Scope

Review only the coder-owned changes:

- `src/core/tally.ts`
- `test/services/dd/core/tally.test.ts`

Other untracked brief, plan, task, packet, and ledger paths are PM-owned artifacts, not coder scope violations.

Do not persist edits. A temporary mutation of `src/core/tally.ts` is authorized only for Dimension 0; restore it byte-identical before reporting. Do not commit, push, merge, tag, or modify flow state/ledger files.

Forbidden writes:

- `.the-flow-state.json`
- `the-flow.json`
- `the-flow.md`
- `.flow-pair/`
- `docs/plans/003-tally-columns/assets/tally-absence-flow-pair/`

## Ruling to verify, not reopen

Report a tally mismatch only for an exact cell where a value is stored and disagrees. Absence is silent at both row-total and footer sites. No written-state inference. Explicit JSON `null` is present and may disagree; only missing/`undefined` is absent.

Four separate behavioral assertions are mandatory:

1. Nothing stored: silent.
2. Partial correct footer (`tally: {a: 10}`): the stored cell is checked; absent `b`/`t` are silent.
3. Correct hand-filled row totals and no footer: silent.
4. Wrong stored value (`tally.a: 99` vs true `10`): the mismatch still reports unchanged.

## Required review evidence

1. Inspect `git diff -- src/core/tally.ts test/services/dd/core/tally.test.ts`; check both comparison sites, all four assertions, scope, contract, regression risk, and prompt-follow against the rubric.
2. Run `npx vitest run test/services/dd/core/tally.test.ts` and report exact counts.
3. Dimension 0 empirical mutation: remove or invert the stored-presence guards, run the focused file to RED, record failing/passing counts and which new assertions fail, restore the original bytes, rerun to GREEN, and confirm restoration is byte-identical.
4. Confirm the stored-and-wrong assertion is load-bearing; green tests alone are not approval.
5. Return findings by severity, named files/lines, verdict, and a concise mutation receipt.

## Wire report

Send the PM a C10 message whose first line is `DECISION: APPROVE`, `DECISION: APPROVE_WITH_NOTES`, or `ACTION: FIX_REQUIRED`. Include:

- reviewed files;
- findings by severity;
- focused test count;
- RED→GREEN mutation evidence;
- exact load-bearing assertion for the wrong-stored case;
- confirmation that temporary edits were restored and no persistent files changed.
