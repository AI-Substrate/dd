# Tally-absence implementation tasks

## Phase: Tally absence mismatch fix

1. In `src/core/tally.ts`, change both mismatch comparisons so absence is silent and stored disagreement is still reported.
2. Add four separate behavioral assertions: nothing stored; partial correct footer; correct hand-filled row totals without footer; wrong stored value still reports.
3. Run the focused tally tests and report the exact command and result.
4. Do not commit, push, modify plan/ledger files, or touch paths outside the packet allowlist.
