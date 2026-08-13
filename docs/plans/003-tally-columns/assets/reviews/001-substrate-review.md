# Review — tally substrate (`0cf703e` + `b1d3d99`) · o-prime, 2026-08-12

**Reviewer**: `pij-mental-dajeil` (o-prime). **Scope**: the two commits on
`feat/tally-columns`, reviewed at two depths on separate days: behavioural
(independent end-to-end reproduction in a throwaway repo against the worktree bin) and
code (every load-bearing hunk read: `tally.ts` whole, `parse.ts`, `mutate.ts`,
`validate.ts`, `renderer.ts`, `declarations.ts` diffs, test counts).
**Context**: produced by a PM seat operating off-contract (solo implementation under a
`pm` role; see `.harness/government/how-fleets-work.md`). This review therefore stands
IN PLACE of the coder/reviewer split the fleet model would have provided — it is the
review the process owed and did not get.

## Verdict: APPROVE — the work is good. The defect was process, not product.

## Behavioural evidence (verified independently, not from the PM's report)

- Gate: 69 files / 810 tests green under a clean HOME, re-run by me post-commit.
- Real writer verb computes everything: row totals per row, section `tally` key,
  grand total stored explicitly; intersection self-consistent (6+3 = 5+4 = 9).
- **The lie, reproduced by my own plants** (`tally.mon` 6→99, row total 5→42):
  `dd build --check` exit 0 while the render shows 2+3=42 — and `dd validate`
  E463 ×2 exit 1, both plants named by location and both numbers.
- Repair path: an unrelated `dd add` corrected both plants; no `--fix` exists (grepped).
- Mutation proofs are real: both plants named in first-failure output (11/21 and 6/21).

## Code findings

**Genuinely good, called out as such:**
- `computeTally` builds column samples on a **null-prototype object** with the reason
  documented (`__proto__` as a schema-authored column name would assign the prototype).
  That is a hazard most reviews would not have caught in the first place.
- The grand total is computed as the column-sum of the total column — literally the
  intersection, one route, no second computation to disagree with.
- Renderer emits **stored values only**, keeping `build --check` a drift gate over the
  tally; recompute lives in exactly two places (write path, validate) with one shared core.
- `parseSections` carries `section.tally` **with validation** (finite numbers only), and
  the comment names the serializeDoc-destroys-unknown-keys hazard — the wl-0027 class.
- Refusals speak the domain: non-numeric tally refused with the type named; two `total`
  columns refused with both names, because key order deciding is "exactly the kind of
  implicit behaviour this feature refuses".
- Comment density and register match the repo idiom throughout; the commit message
  reconstructs every ruling without the conversation.

**Minor, non-blocking (recorded, not fixed — fix opportunistically in the next pass):**
1. `renderObjectRows` footer: when column 0 is itself a marked column, the `**Tally**`
   label is displaced by that column's sum — the footer renders unlabelled. Cosmetic;
   surfaces only on tables whose FIRST column is numeric-marked.
2. A row with no addend values gets a stored row total of `0` rather than absent.
   Defensible for timesheets (empty row = zero) but it is a semantic choice made
   silently; one sentence in the eventual docs should state it.
3. A hand-edited **non-numeric** tally value fails at parse (`document-invalid`) rather
   than as E463 — stricter than the mismatch path, fine, but the asymmetry is worth a
   line in the E463 manifest note.

**Checked for and absent (the failure modes this repo has already paid for):**
- No recompute-in-renderer (would paper over the lie). Absent — stored only.
- No `--fix` or silent repair in validate. Absent — report only, by grep and by test.
- No key eaten by an allow-list: both `parseShape` and `parseSections` additions landed
  with negation proofs that name their plants.
- No exports widened silently: `DdTallyRole` tripped the baseline gate and was approved
  explicitly (o-prime, 2026-08-12).

## Standing state

Unmerged, unpushed, on `feat/tally-columns` (2 commits from `6fc7d83`). Open rulings:
Q1 write-vs-print for schema verbs (workshop 001), Q2 float precision (seam:
`roundToDataPrecision`, `src/core/tally.ts:81`). Docs gap open: `tally` appears in zero
shipped docs — the how-to page predates the feature.
