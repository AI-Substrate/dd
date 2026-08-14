# Independent-instrument review addendum — tally absence

## Action

Reopen the `dlg-0002` review. The earlier `APPROVE_WITH_NOTES` verdict is superseded until this packet returns a verdict.

A reviewer is a second instrument on the measurement, not a second opinion on the conclusion. First ask: **what did the coder's instrument not measure, and can I measure it another way?** Reusing the coder's unit-test probe is not independent evidence.

## Required independent route

Do not use the coder's test output or mutation receipt as the proof for these cases. Build and exercise a separate end-to-end probe:

1. Outside the repository, hand-author the minimal tally-marked schema and documents needed for all four cases.
2. Use this worktree's binary explicitly: `/Users/jordanknight/substrate/dd-worktrees/tally-absent/bin/ddocs.js`. Do not use the global link.
3. Run `ddocs validate` yourself against each hand-authored document and record the command, exit code, envelope status, and tally-mismatch issue list.
4. Independently prove:
   - nothing stored is silent;
   - a partial correct footer checks only its stored cell while absent siblings are silent;
   - correct hand-filled row totals with no footer are silent;
   - a wrong stored footer value produces the expected mismatch while absent siblings remain silent.
5. Plant the wrong stored value yourself; require the exact singleton E463 path/value/sum. This is the independent non-vacuity proof.
6. If any case cannot be measured independently, report `I could not measure this independently` as a finding. `Looks right` is not evidence.

You may inspect CLI help and repository examples to derive valid document syntax, but the probe inputs and execution must be yours. Store temporary files outside the repository and remove or leave them only under the temporary directory; make no persistent repository changes.

## Existing review context

- Original packet: `docs/plans/003-tally-columns/assets/tally-absence-review-packet.md`
- Reviewed code: `src/core/tally.ts`, `test/services/dd/core/tally.test.ts`
- Ruling: report only an exact stored cell that disagrees; absence is silent at row-total and footer sites.

Forbidden writes:

- `.the-flow-state.json`
- `the-flow.json`
- `the-flow.md`
- `.flow-pair/`
- `docs/plans/003-tally-columns/assets/tally-absence-flow-pair/`
- all repository files

## Wire report

Send a fresh C10 verdict whose first line is `DECISION: APPROVE`, `DECISION: APPROVE_WITH_NOTES`, or `ACTION: FIX_REQUIRED`. Include the independent probe path, commands, four per-case outcomes, exact wrong-stored E463 evidence, and confirmation that the repository remained unchanged.
