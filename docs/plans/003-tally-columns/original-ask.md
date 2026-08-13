# Original ask — tally columns

**Ordinal**: 003 · **Slug**: `tally-columns` · **Branch**: `feat/tally-columns` (cut from `main` @ `6fc7d83`)
**Captured**: 2026-08-12 · **Source**: Jordan, via `BRIEF-tally-columns.md` (o-prime `pij-mental-dajeil`) and his own rulings in session

---

## The ask, in Jordan's words

> "columns must be marked as 'in' before they are included. so turn on the colum. then turn on
> the rows and that will work."

A **tally**: spreadsheet-style sums over a dd table, with **nothing implicit**.

- A column is marked **in** (opt-in). Only marked columns participate.
- Marked columns produce a **tally row at the bottom** of the rendered table.
- A **row-total column** sums the marked columns of each row.
- The two compose, and the **grand total falls out at the intersection**.

## What it is NOT

Not a general calculated-column feature. **No expression language.** The row tally is a sum
*across* columns, so it is only meaningful when the marked columns share a unit — days of a week,
dollars per bucket. `qty × price` is explicitly out of scope: an invoice is the wrong mental
model, a **timesheet** is the right one.

## Rulings taken during the work

| # | Question | Ruling | Ruled by |
|---|---|---|---|
| 1 | Stored or render-only? | **Written into the `.dd.json`.** Not render-only. | Jordan (o-prime recommended render-only on staleness grounds and was overruled) |
| 2 | Where do row totals live? | **A normal declared column**, through the existing `columnsFor` path. | Jordan — *"yeah i think just declare it as a column"* |
| 3 | Where do footer sums live? | **A third key on the section**, `{name, value, tally}`, with the grand total stored **explicitly**. | Jordan — *"we need to store it all cause we need agents to be able to query it using jq etc so they are not trying to do sums"* |
| 4 | Does `dd validate` recompute? | **Yes, in scope.** Recompute and compare, report **mismatch as a finding**. Report only — no repair, no `--fix`. | o-prime `pij-mental-dajeil` |
| 5 | Tooling to declare a tally column | **Wanted** — *"we should have first class tooling to assist agents to do it."* | Jordan |

## Why ruling 4 is load-bearing

Storing the tally creates a failure mode nothing else in the repo can see: a hand-edited
`.dd.json` yields a table whose total contradicts its own rows while **`dd build --check`
PASSES**, because the markdown is a faithful render of the wrong JSON. Not drift — internally
consistent and false. Recompute-and-compare is what turns the stored tally from trusted data
into a **checked invariant**.

The hand-edit case is not hypothetical: merge `cfcd437` resolved a conflict in
`docs/plans/wishlist.dd.json` **by hand**, in this repo, in the 72 hours before the work started.

## Still unruled — both Jordan's

1. **Float precision.** Node sums give `3.5900000000000003`; under ruling 3 that is the number the
   next agent reads back with `jq`, not merely what renders. Proposed but **not ruled**: sum at the
   precision the column's own data carries. Implemented behind one named function,
   `roundToDataPrecision` (`src/core/tally.ts:81`) — swapping the policy is one function body.
2. **The tooling verb (ruling 5).** **Held** by the o-prime on a capability-class finding: `dd schema`
   has exactly two subcommands, both read-only, and `src/acts/schema.ts` contains no filesystem
   write of any kind — **dd has never written a schema**. Three unpriced consequences: no atomic
   write / rollback / sibling-lockstep analogue exists for schemas; blast radius is categorically
   larger (a corrupt schema breaks every document resolving to it); and the four-rung resolution
   ladder makes "which schema do I write?" ambiguous, so a write verb could manufacture the very
   shadowing `dd schema list` already reports as degraded. A **zero-write alternative** — print the
   JSON fragment for the agent to place — is unscored. Jordan owns the call.

## Delivered under this ordinal

Two commits on `feat/tally-columns`, unpushed:

- `0cf703e` — `docs(wishlist)`: wl-0027, the general finding (an unmodelled section key is
  **destroyed**, not dropped)
- `b1d3d99` — `feat(tally)`: the storage / render / validate substrate

Gate green on the committed state: 69 files, 810 tests.

## Standing constraints

- No push, no PR, no tag, no release without the o-prime's word.
- The tooling verb is not to be designed without returning to the o-prime first.
