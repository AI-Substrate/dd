# Validation — file-links plan

**Target**: `docs/plans/004-file-links/plan.dd.json` plus linked phase task documents
**Validated**: 2026-08-16
**Verdict**: VALIDATED — implementation-ready; no material issue retained

## Validation contract

- **Purpose**: make `wl-0023` executable without reopening the brief’s rulings or guessing the address grammar.
- **Promise**: typed ordinary-file columns and explicit Markdown references check existence, render and graph truthfully, warn without blocking, and preserve future `file#method` syntax.
- **Proof target**: Implementation contract.
- **Upstream**: `BRIEF-file-links.md`; `docs/plans/wishlist.dd.json#items/wl-0023`; `assets/research-dossier.md`.
- **Consumers**: Phase 1 coder packet, Phase 2 coder packet, independent cross-model code review, PR/CI evidence.
- **Position**: public `parseAddress` grammar plus public link/graph model; build/validate/render/links/graph CLI behavior.
- **Constraints**: existence only; WARN; no new verb; no method resolution/hash/freshness; forbidden paths untouched.

## Fresh proof

| Proof | Result |
|-------|--------|
| `harness plan validate docs/plans/004-file-links/plan.dd.json` | 0 errors, 26 WARNs; every WARN classified `address-target-untracked`, derived from the newly-created untracked plan/task files. No semantic contradiction or orphan. |
| `harness plan validate … --complete` | 0 errors; same 26 untracked-target WARNs only. |
| `harness dd build … --check` for plan + both task docs | All three `ok`, `drift: false`. |
| AC/task set comparison with `jq` | AC `ac-0001..ac-0009`; task references cover exactly the same set; missing `[]`, extra `[]`. |
| Plan/task structure query | Plan `ready`, 2 phases; Phase 1 `ready` with 4 tasks; Phase 2 `ready` with 5 tasks. |
| Live premise probe | `address validate notes.md` → E405 today; `address validate src/foo.ts#parseThing` → `ok`, `classified:false`. |
| LSP reference census | 30 references for public `parseAddress`, including core validation/walk, links, render, acts, plan, and root export. |

The untracked-target warnings are not waived as “expected”: their cause was derived from the issue class and each finding’s target path. They disappear only after the plan artifacts are committed; until then the validator truthfully reports degraded.

## Forward compatibility

- Phase 1 → canonical grammar, path-base and discovery contracts → shape mismatch/test boundary → satisfied by parser/property/negative-population tasks.
- Phase 2 → file-cell contract from Phase 1 → lifecycle ownership/shape mismatch → satisfied by terminal-node and no-traversal tasks.
- Public SDK consumers → no fake dd metadata and explicit declaration review → contract drift → satisfied by LSP migration, `.d.ts` inspection and package gate task.
- Future `file#method` → fragment namespace remains available → encapsulation lockout → satisfied by explicit syntax-preservation AC and non-goal.

## Critical insights applied

| # | Insight | Decision |
|---|---------|----------|
| 1 | Build currently renders without running link validation. | One shared file-reference check must feed build and validation/traversal; no build-only detector. |
| 2 | An edge target absent from `graph.nodes` renders as unresolved even when the file exists. | Existing ordinary files become honest resolved terminal nodes; missing targets alone are dashed. |
| 3 | Repo-relative typed values and literal Markdown hrefs do not share a base. | Carry the base explicitly: repository for structured cells, containing document for Markdown. |
| 4 | The public parser is consumed far beyond the address command. | LSP caller migration and installed declaration review are acceptance evidence, not cleanup. |
| 5 | A missing-only test passes against an implementation that warns on everything. | The same fixture proves present → zero, remove → exactly one named WARN, restore → zero; reviewer independently mutates it. |

## Adjudication

No unresolved product decision remains in the implementation packets. The only pre-dispatch decision is the whole-file spelling; `assets/whole-file-form-proposal.md` selects the bare path with alternatives and compatibility proof, as required by brief ruling 5.
