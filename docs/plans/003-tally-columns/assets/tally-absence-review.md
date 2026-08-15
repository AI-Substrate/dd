# Tally-absence independent review

- Delegation: `dlg-0002`
- Reviewer: `pij-molecular-cobra` · `github-copilot/gpt-5.6-terra:xhigh`
- Verdict: `APPROVE` after independent-instrument addendum
- PM decision: `APPROVE`

## Findings

- Critical: none.
- High: none.
- Medium: none.
- Info: a developer-HOME gate run discovers `/Users/jordanknight/.dd` and makes `test/acts/envelope-contract.test.ts` expect `ok` but receive `degraded`; outside this diff and already tracked as backlog 25. Final acceptance uses a clean `HOME` as required.

## Contract evidence

- Reviewed files: `src/core/tally.ts`, `test/services/dd/core/tally.test.ts`.
- Both comparison sites skip only `held === undefined`; explicit JSON `null` remains a stored claim and may disagree.
- Four separate assertions cover nothing stored, partial correct footer, correct hand-filled row totals without footer, and wrong stored value.
- Focused test: `npx vitest run test/services/dd/core/tally.test.ts` → 1 file, 25/25 passed.
- Scope: coder changed only the two allowed files; `git diff --check` clean.

## Dimension 0 mutation receipt

The reviewer inverted both stored-presence guards and ran the focused file:

- Mutated: 8 failed, 17 passed. All four new assertions failed.
- Restored: 25/25 passed.
- Restored source SHA-256: `e84a693a67f7305dee0481ce3f3d36ce21f76ed20dac0955a4cf9dec56509614`, matching pre-mutation.
- Load-bearing negation assertion: `still reports a stored value that disagrees with the rows` requires the exact singleton `ERROR` at `$.sections[days].tally.mon`, stored `99` versus rows `10`; it failed under mutation.

## PM sanity pass

The load-bearing hunk matches the verdict:

- Row totals bind `held`, return only when it is `undefined`, and otherwise retain the existing `Object.is(held, expected)` mismatch path.
- Footer cells continue only when `held` is `undefined`, and otherwise retain the existing mismatch path.
- The wrong-stored test requires exactly one matching issue, so it proves both non-vacuity and silence for absent sibling cells.

No fix cycle required. Final clean-home gates remain mandatory before commit and push.

## Independent-instrument addendum

The initial verdict preceded the sharpened reviewer contract and independently mutated the implementation, but it reused the coder-authored unit-test probe. The review was reopened only for a different measurement route.

The reviewer hand-authored a schema and four documents at `/var/folders/mv/9mcvlzg504b158ctlswmgwph0000gn/T/tally-absence-independent-review.FuW1ghT8zi`, then exercised this worktree's `/Users/jordanknight/substrate/dd-worktrees/tally-absent/bin/ddocs.js` directly:

1. `nothing-stored.dd.json` → exit 0, status `ok`, issues `[]`.
2. `partial-footer.dd.json` with stored `tally.mon=10` → exit 0, status `ok`, issues `[]`; absent siblings stayed silent.
3. `row-totals-only.dd.json` with two correct hand-filled totals and no footer → exit 0, status `ok`, issues `[]`.
4. `wrong-footer.dd.json` with `tally.mon=99` against rows summing to `10` → exit 1, status `error`, exactly one `E463` at `$.sections[days].tally.mon`: `stored tally says 99 but the rows sum to 10`; absent siblings produced no issue.

This route used reviewer-authored inputs and CLI invocations rather than coder-authored tests. Repository restoration evidence: tracked-diff SHA-256 `9dc8e60a5cdec977d07587cf20e4b60e4f8baf7c941afaf4a97c8625e6914204`; porcelain-state SHA-256 `947f4c9760505e70b16f9f2d3b26b3021bde02123ddd679077bc7e4e16ea4c02`; no repository files were written by the addendum.
