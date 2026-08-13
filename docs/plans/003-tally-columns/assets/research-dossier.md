# Research Dossier: tally columns — what was built, what it left open

**Generated**: 2026-08-12T03:05:00Z
**Query**: "Retroactive: tally columns — sums over a dd table with nothing implicit; substrate built and committed, docs and schema verbs open"
**Effort**: Standard (lead only — the change surface is two commits in this tree; institutional memory read directly, no independent question needed a worker)
**Evidence**: 11 current sources · 5 historical sources

## The Ask

Tally columns are spreadsheet-style sums over a dd table: a column is opted **in**, marked columns sum into a footer row, a declared column holds each row's sum, and the grand total falls out where the two axes meet. The substrate for that shipped as two commits on `feat/tally-columns` before any plan existed — the work was dispatched from a handover brief, not through the SDD pipeline.

This dossier is **retroactive**. It describes what *is*: the built-and-reviewed substrate, the surfaces it did not touch, and the two rulings that gate everything still outstanding. It exists so the plan document that follows describes a real position rather than inventing a fiction of work yet to happen.

## Answer

1. **The storage/render/validate substrate is complete, committed, and independently reviewed APPROVE** — `0cf703e` + `b1d3d99`, 810 tests green, behaviour reproduced by the reviewer rather than taken from the author's report.
2. **`dd validate` recompute-and-compare is what makes storage safe.** A stored tally can be made false by hand, and the markdown then renders the falsehood faithfully — so `dd build --check` passes on a document that contradicts its own rows. Recompute is the only thing that sees it.
3. **The feature is invisible in every shipped document.** `tally` appears in zero of the four baked doc chapters; the schema how-to teaches `gate_terminal` by name and does not mention `tally`. An agent following the docs today cannot discover the feature exists.
4. **The tooling Jordan asked for is blocked on a capability-class question, not on effort.** dd has never written a schema; the write verbs would be its first. That question (Q1) is with Jordan, specified to Contract Ready in workshop 001.
5. **Float precision is unruled and isolated.** Every sum leaves through `roundToDataPrecision`; the policy is one function body, so the open question costs nothing to hold.
6. **Three minor findings from the review are recorded and unfixed** — deliberately, so they land as planned work rather than as opportunistic edits after an approval.

## Evidence

| ID | Finding | Evidence | Planning implication | Confidence |
|----|---------|----------|----------------------|------------|
| F-01 | Substrate committed: wishlist row then feature, parented at the branch point | `git log` → `6fc7d83 → 0cf703e → b1d3d99` | Nothing to re-implement; the plan's phase 1 is already done | High |
| F-02 | `roundToDataPrecision` is the sole float seam; integers returned untouched, >15 places untouched | `src/core/tally.ts:81` | Q2 is a one-body change — safe to hold open through any phase | High |
| F-03 | Renderer emits stored values only; never recomputes | `src/render/renderer.ts:414-428` | `dd build --check` stays a drift gate over the tally; do not "fix" by summing at render | High |
| F-04 | Refresh sits in `applied()`, before the gate — the one choke point all writer verbs pass | `src/mutate/mutate.ts:112-122` | A new writer verb inherits tally freshness automatically; `dd build` stays a renderer | High |
| F-05 | `tally` appears in **zero** shipped docs; `how-to-add-a-schema` is 6550 bytes with no match | `dd docs get how-to-add-a-schema` → `mentions tally: false`; `grep -rc tally src/docs/*.ts` → 0,0,0 | The docs gap is a real deliverable, not a nicety — the feature is undiscoverable | High |
| F-06 | **CORRECTED 2026-08-13 — the original was WRONG and would have misled the docs phase.** Docs are generated from **`src/docs/content/<id>.md`** (the manifest's `sourcePath`) → `src/docs/docs-content.ts` **and** → `docs/how/dd/*.md`. **`docs/how/dd/` is a GENERATED VERBATIM MIRROR, not a source**; its own header says *"Edit the SOURCE, then run `npm run gen:dd-docs`"*. The original entry named the mirror as an input. | `scripts/gen-dd-docs.mjs:126,141` (writes the mirror), `docs/how/dd/how-to-add-a-schema.md:1-3` (header), `src/docs/dd-docs-manifest.json` (`sourcePath`) | A docs task edits **`src/docs/content/<id>.md`** and regenerates. Editing the mirror is either silently overwritten by the next generator run or reds `check:dd-docs` with a drift error that reads like a tooling bug. | High |
| F-07 | The teaching site for shape keys is `how-to-add-a-schema` § 2 "Write `schema.json`", which already names `gate_terminal` per-key. **CORRECTED 2026-08-13: edit it at `src/docs/content/how-to-add-a-schema.md`, NOT the `docs/how/dd/` path originally cited — that path is the generated mirror (see F-06).** | `src/docs/content/how-to-add-a-schema.md` (source); the mirror `docs/how/dd/how-to-add-a-schema.md:23,73,175` shows the same text | `tally` belongs beside `gate_terminal` in § 2 + the Checklist — an existing shape, not a new chapter | High |
| F-08 | `deterministic-documents.md` is the narrative chapter and carries "The writer refuses bad values" / "The rendered view cannot drift" sections | `docs/how/dd/deterministic-documents.md:181,225` | The recompute-vs-drift story has a natural home there; the E463 case is exactly its subject | Medium |
| F-09 | Ten verbs registered, schema side read-only; `src/acts/schema.ts` has no filesystem write | `dd status --json` → `ported[10]`; workshop 001 § The asymmetry | Q1 is a capability-class change, not a verb addition | High |
| F-10 | Three minor review findings open: unlabelled footer when column 0 is marked; empty row stores `0`; non-numeric stored tally fails at parse not as E463 | `assets/reviews/001-substrate-review.md:44-53` | Small, independent, all CS-1 — one polish phase, not three | High |
| F-11 | Workshop 001 is at Contract Ready with a full verb roster, refusal matrix and ladder rule | `assets/workshops/001-schema-editing-verbs.md:113-179` | If Q1 rules write, the implementer needs no further design pass | High |

## Historical Evidence

| ID | Prior friction / decision | Source | Applicability now | Implication |
|----|---------------------------|--------|-------------------|-------------|
| H-01 | `parseShape` is an allow-list that silently discarded `valuesShape` once and nearly shipped `rel` inert | `src/schema/declarations.ts:157-162` | **Direct** — the same parser now carries `tally` | The negation proof that names its plant is mandatory for any future shape key, not optional rigour |
| H-02 | wl-0027: `parseSections` + `serializeDoc` **destroy** an unmodelled section key; top-level keys are preserved but section keys are not | `docs/plans/wishlist.dd.json#items` (wl-0027) | **Direct** — raised by this feature, unresolved | A general class with three unscored fix shapes; belongs in the plan as a decision, not a task |
| H-03 | wl-0026: the rollback write was not staged, so either-both-or-neither had a third state | `docs/plans/wishlist.dd.json#items` (wl-0026) | **Partial** — fixed, but it is the crash-safety story any schema writer would need to replicate | Q1's "no atomic-write analogue for schemas" is concrete, not theoretical — this is what would have to be rebuilt |
| H-04 | Hand-edited `.dd.json` is real: merge `cfcd437` resolved `wishlist.dd.json` by hand | `original-ask.md` § Why ruling 4 is load-bearing | **Direct** | The premise under recompute-and-compare is measured, not hypothetical |
| H-05 | A friction ledger exists and is fed by consumers in other repos (12 rows) | `docs/plans/frictions.dd.json#frictions` | **Direct** — this run's dogfood frictions belong there | Route dogfood findings to `fr-00NN`, not into the plan body |

## Risks and Unknowns

| Item | Evidence | Why it matters | Resolution / next evidence |
|------|----------|----------------|----------------------------|
| Q1 write-vs-print unruled | workshop 001 § Open Questions | Gates the largest body of remaining work; a wrong default here is a capability-class mistake, not a refactor | Jordan's ruling. Nothing below implementation starts first |
| Q2 float policy unruled | `src/core/tally.ts:81` | Changes stored bytes in committed documents | Jordan's ruling; one function body either way |
| wl-0027 unresolved | H-02 | Any future section-level key repeats the loss; "change nothing" is a live candidate | A decision pass, not a build task |
| Docs gap is silent | F-05 | Nothing fails when docs omit a feature — no gate covers discoverability | The only detector is a human reading the chapter; treat as a real deliverable with its own acceptance |

## Planning Handoff

- **Preserve**: the renderer reads stored values only (F-03); recompute lives in exactly two places sharing one core (F-03/F-04); `dd build` never writes source; `dd validate` reports and never repairs; no `--fix` flag exists.
- **Change carefully**: `parseShape` and `parseSections` — both allow-lists, both silently lossy (H-01/H-02); any new key needs a negation proof that names its plant. The docs pipeline is generated and drift-guarded (F-06) — edit source, never the emitted module.
- **Likely files/symbols**: **`src/docs/content/how-to-add-a-schema.md`** § 2 + Checklist and **`src/docs/content/deterministic-documents.md`** (F-07/F-08 — sources, NOT the `docs/how/dd/` mirrors); `src/render/renderer.ts` footer labelling (F-10); `src/core/tally.ts` for the empty-row and precision semantics; `src/acts/schema.ts` only if Q1 rules write.
- **Decisions still required**: Q1 (write vs print) · Q2 (float precision) · wl-0027 disposition · whether `rename-col --migrate` is in a v1 verb set (workshop 001 Q3).

## External Research

_Omitted — every material question is answerable from this repo, and the two open ones are rulings, not research._
