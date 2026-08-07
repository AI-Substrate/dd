# Research Dossier: dd standalone extraction — what ports, what stays, what must survive

**Generated**: 2026-08-07T03:45:00Z
**Query**: "set up a new plan, get builder spine in and perform explore step based on our pre-amble."
**Effort**: Standard (lead-only — every material question fell to targeted greps + direct reads; no independent uncertainty remained to justify a worker)
**Evidence**: 10 current sources · 3 historical sources

## The Ask

This repo (`AI-Substrate/dd`) is the standalone home-to-be of **dd (deterministic
documents)**, which today ships inside `AI-Substrate/harness-engineering` as the
`harness dd …` verb family. Jordan's mission (relayed in `pij-related-koala`'s brief):
extract dd into this repo as a dual-surface **CLI + typed SDK** package
(`@ai-substrate/dd`), releasable via release-please, with the harness later consuming
this package instead of its in-tree copy (that consume step is koala's, not ours).
This dossier answers: **what exactly is the source surface, how coupled is it to
harness internals, which tests prove the port, and what constraints bound the plan.**
The plan it feeds will be handed to a PM; phases must group logically, not by sequence.

## Answer

1. **The SDK core is nearly self-contained.** All 45 files under `services/dd/` import
   exactly ONE thing from outside their own tree — `services/shared/posix-path.js` —
   plus `node:` builtins. The port of the SDK is a copy plus a one-file shim.
2. **All harness coupling lives in the 13 CLI acts.** `acts/dd/` depends on the output
   family (envelope, error-codes, exit, output-port, style) and seven adapter families
   (clock, env, exec, fs, hash, process, jiti-loader) — and this repo's stub already
   mirrors most of that seam by design (envelope contract, exit codes, output-port,
   clock adapter). The remaining gap is a bounded, enumerable list.
3. **The public SDK surface is measurable, not speculative** — real imports in five
   harness consumer files name it exactly (F-04). Consumers import both barrel paths
   (`links/index.js`) and deep paths (`core/address.js`), so subpath exports mirroring
   the subdirectory structure is the shape that keeps koala's consume step easy.
4. **Runtime deps land at exactly two**: `commander` (already in package.json) and
   `jiti` @2.7.0 (custom-type adapter loading in build/doctor/validate/shared).
   `picomatch` — used elsewhere in harness — is NOT used by either dd tree.
5. **~51 of the 60 tests port; ~9 stay** (the `flow-dd-*`, `builder-dd-teaching`, and
   `dd-flow-gate` integration tests exercise harness-consuming-dd, which is koala's
   half). Four fixture directories ride with the portable tests.
6. Ten verbs to port (`validate schema docs build address link links graph doctor
   write`), tracked by the stub's self-updating `dd status` ledger, which exits 2
   until the last one lands — the port cannot silently claim completion.

## Evidence

| ID | Finding | Evidence | Planning implication | Confidence |
|----|---------|----------|----------------------|------------|
| F-01 | `services/dd/` (45 files, 7 subdirs: core, docs, links, mutate, plan, render, schema; ~10.6k LOC with acts) imports only `../../shared/posix-path.js` externally | grep over `harness/cli/src/services/dd` — single external hit | SDK ports as a near-verbatim copy + one `posix-path` shim; no de-tangling phase needed | High |
| F-02 | `acts/dd/` (13 files) deps: output×5 (envelope, error-codes, exit, output-port, style), adapters×7 (clock, env, exec, fs, hash, process, jiti-loader), commander, posix-path | import census over `harness/cli/src/acts/dd` | The acts port is a plumbing-mapping exercise; the seam is already the stub's design (`AGENTS.md` envelope contract) | High |
| F-03 | The dd stub already carries `src/output/{envelope,error-codes,exit,output-port}.ts` + `src/adapters/clock/`; missing vs need: `output/style.ts`, adapters env/exec/fs/hash/process/loader | `find src -name '*.ts'` in this repo vs F-02 | Gap list is bounded and mechanical — a natural early phase ("plumbing parity") | High |
| F-04 | Real consumed SDK surface: `core/address` (parseAddress, isAddressFailure) · `core/model` (DdDoc) · `core/parse` · `core/validate` (DdIssue, collectLinkCells) · `core/walk` (validateWalk) · `links` (MemoizingDocLoader, resolveMapSeed, traverseCorpus) · `plan` (buildPlanIndex, itemKey, PlanEdge, PlanIndex, PlanItem) · `schema/model` (SchemaIssue) · `schema/resolve` + `schema/index` (ConventionSchemaResolver) · `render/renderer` (escapeCell, headingSlug) | imports in `app.ts`, `acts/flow.ts`, `acts/plan/{index,fence,pr-body}.ts` | This is the minimum public export map; matches koala's brief §SDK with barrel-vs-deep detail added | High |
| F-05 | Schema resolution convention is dd-owned and portable: `<gitroot>/.dd` → `.harness/.dd` → `~/.dd` | `services/dd/schema/resolve.ts:78,188-191` | No harness coupling in the convention; the `.harness/.dd` middle rung keeps back-compat for harness-resident corpora | High |
| F-06 | Runtime deps: `commander` ^15 (present), `jiti` 2.7.0 (via `adapters/loader/jiti-loader.ts`, used by build/doctor/validate/shared for custom-type adapters); picomatch unused in dd | harness root `package.json`; grep both dd trees | Add `jiti` to dependencies; tarball-installs-standalone gate must exercise a jiti-loading path | High |
| F-07 | Tests: 60 total in a mirrored `test/` tree (zero co-located); ~9 are harness-consumer tests (6× `test/services/flow/flow-dd-*`, `test/acts/flow-dd-gate`, `test/acts/builder-dd-teaching`, `test/integration/dd-flow-gate.int`); 4 fixture dirs (36+ files under `test/services/dd/fixtures` alone) | `find`/`grep` over `harness/cli/test` | Port ~51 tests + fixtures; the ~9 stay as koala's consume-step proof; this repo already uses the same `test/`-beside-`src/` layout | Medium (exact split is a tasks-time audit) |
| F-08 | The stub's `--json` is program-level and position-sensitive: `dd status --json` → exit 1 `E002`; `dd --json status` → exit 2; harness accepts postfix; `AGENTS.md` documents the failing form | measured in this repo; `src/app.ts` | Port-time fix (koala concurs): ported verbs must accept postfix `--json`; also fix the AGENTS.md example | High |
| F-09 | Envelope contract + exit mapping (0 ok/degraded · 2 unconfigured · 1 error) and the `dd status` port ledger are live and verified in the stub | measured: exits 0/2/1; `dd status` → `ported:[] remaining:10` | The honesty gate exists before any port work; keep every ported verb behind `exitWithEnvelope` | High |
| F-10 | Two architecture tests likely encode the port seam: `test/architecture/dd-core-isolation.test.ts`, `dd-plan-semantics-frozen.test.ts` | file existence; names | Read both at plan time — they may already BE the boundary the extraction must honour (isolation ratchet + frozen plan semantics) | Medium (not yet opened) |

## Historical Evidence

| ID | Prior friction / decision | Source | Applicability now | Implication |
|----|---------------------------|--------|-------------------|-------------|
| H-01 | 17-item open backlog with status/ownership annotations: envelope/remedy cluster (#1–6, dispatchable), `dd new` document-birth verb (#7), backpressure vocabulary collisions (#8–12, **ordered — running #11 first turns the gate green over undetermined values**), plan `outcomes` section (#13), doc/tooling papercuts (#14–17). #8, #13 are OPEN-on-Jordan | `harness-engineering-worktrees/s065-…/scratch/dd-next.md` (107 lines, verified against main `d08f4942`) | Direct | Migrate into this repo's tracker with annotations intact; do NOT resolve OPEN items; preserve the #8→#11 ordering constraint |
| H-02 | Standing constraints: no push/PR/tag/release from agents; harness-engineering checkout read-only; no npm publish/provenance; npm proxy ~1wk behind registry → consume step uses a registry-free local dep, so **"tarball installs standalone" is a checked gate** | koala's brief (`brief-dd-prime-dajeil.md` §§ constraints, npm) | Direct | The pack gate is a phase deliverable with a real test (`npm pack` from clean clone → install → run), not a release-time hope |
| H-03 | The dd-native builder plan — authored AS dd documents — is the richest worked example of dd in production use; concept docs at `docs/how/dd/`; 2 baked doc entries ship in `services/dd/docs/content/` | `harness-engineering: docs/plans/archive/071-dd-native-builder/`, `docs/how/dd/` | Partial (archive — verify against live code before carrying claims) | Reference material for the plan's spec half; the baked docs port with the `docs` verb |

## Risks and Unknowns

| Item | Evidence | Why it matters | Resolution / next evidence |
|------|----------|----------------|----------------------------|
| SDK-as-library vs CLI-shelled consumption | koala brief §SDK: Jordan leaned CLI-first, but `acts/plan` consumes dd as a library today (F-04) | Decides how much of F-04 must be public API vs internal — shapes the exports map and semver surface | Price both, put to Jordan before locking exports (flagged in flight plan) |
| `services/dd/plan/` semantics: move or stay | F-04 (`plan/index` consumed by `acts/plan`); F-10 (`dd-plan-semantics-frozen` test) | `harness plan validate`'s dd-semantic layer sits partly INSIDE dd already — not a clean either/or | Read the frozen-semantics test at plan time; put the split to Jordan |
| jiti in the tarball | F-06 | If the pack gate never exercises a custom-type load, a broken jiti dep ships silently | Pack-gate test includes a custom-type fixture load |
| Backpressure vocabulary order constraint | H-01 (#8–11) | If the port touches `.dd/schemas` exemplars while #8–10 are unruled, the wrong `Partial` propagates by imitation | Port schemas verbatim; leave #8–12 annotated, unresolved |
| Exact test split (~51/~9) | F-07 | A consumer test accidentally ported would import harness flow internals that don't exist here | Tasks-time audit: classify all 60 by import direction before moving any |

## Planning Handoff

- **Preserve**: the envelope contract + exit mapping (F-09); the F-04 surface exactly (koala's consume step depends on it); the `.dd` resolution ladder incl. `.harness/.dd` (F-05); the `dd status` ledger's honesty (a verb registers only when it actually works); conventional commits (release-please reads them).
- **Change carefully**: `src/app.ts` verb registry (the single convergence point — every phase lands here; with a PM running parallel workers this is the merge hot-spot); `--json` handling (fix to postfix-tolerant while porting, F-08); anything under `.dd/schemas` exemplars (H-01 ordering).
- **Likely files/symbols**: copy `services/dd/**` → `src/` (7 subdirs) + `posix-path` shim; port `acts/dd/**` → `src/acts/` against the stub's output family; add missing plumbing (F-03 gap list); add `jiti` dep; port ~51 tests + 4 fixture dirs into `test/`; exports map in `package.json` (subpath exports mirroring subdirs).
- **Decisions still required**: SDK-vs-CLI consumption (Jordan); plan-semantics split (Jordan); whether `harness dd docs`' 2 baked entries port verbatim or get rewritten for the standalone context; backlog items #8 and #13 (Jordan, inherited annotations).

## External Research

_None material — the repo pair answers every question raised; npm packaging patterns (subpath exports, `prepack`) are settled practice._
