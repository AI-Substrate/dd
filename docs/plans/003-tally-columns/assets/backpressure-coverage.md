# Backpressure Coverage — tally columns

**Plan**: [plan.dd.md](../plan.dd.md) (source: `plan.dd.json`)
**Basis (plan SHA-256)**: `3ac565598047ecaad76db37ad324b36d194adf37185d3a5ddc5589652d4732a7`
**Generated**: 2026-08-12
**Certainty**: Partial

> Advisory only. Never blocks, never gates, no scores. (Advisory backpressure survey.)
> Selection, not enforcement: nothing here executes at phase end — the proof lines
> below are what the plan's owner folds into each criterion's "done when".

## Existing Sensors (inventory)

Single-root repo — `package.json` declares no workspaces; the only nested root is `test/`. Every probe below ran against the repo root.

| Sensor | Paved command | Dimension | Found in |
|--------|---------------|-----------|----------|
| full quality gate (lint + build + typecheck + test) | `just checks` | maintainability + behaviour | root `justfile` |
| spawned-bin smoke | `just boot` | behaviour | root `justfile` |
| unit/integration suite (69 files) | `just test` · targeted: `npx vitest run <file>` | behaviour | `vitest.config.ts` |
| **doc-content assertions** | `just test` (`test/docs-surface.test.ts`) | behaviour | `test/` |
| docs drift gate (emitted module vs source markdown + manifest) | `just check-docs` | maintainability | `scripts/check-dd-docs.mjs` |
| frozen-surface manifest gate (E-codes ↔ manifest rows) | `just test` (`test/acts/dd-surface.test.ts`) | architecture-fitness | `test/acts/` |
| exports-baseline gate | `just check-exports` | architecture-fitness | `scripts/exports-reachability-probe.mjs` |
| core-isolation architecture gate | `just test` (`test/architecture/dd-core-isolation.test.ts`) | architecture-fitness | `test/architecture/` |
| document drift gate | `dd build --check <doc>` | behaviour | the product itself |
| document/plan validators | `dd validate <doc>` · `harness plan validate <plan>` | behaviour | the product itself |
| CI (the de-facto PR gate) | `.github/workflows/ci.yml` | behaviour | root |

The load-bearing discovery: **`test/docs-surface.test.ts` already asserts documentation CONTENT**, not just drift — it has cases for "covers the four things a standalone reader needs", "states the envelope contract with its exit-code map", and "lists the resolution ladder in precedence order". That moves this plan's documentation criteria off the inferential tier and onto an existing paved command.

## Coverage Matrix

| Criterion / failure mode | Phase | Selected proof | Status | Tier | Probe trail (required if ABSENT) |
|--------------------------|-------|----------------|--------|------|----------------------------------|
| AC-1 — the schema how-to names `tally`, its two values, and the numeric-type restriction | 2 | EXTEND→RUN: add a case to `test/docs-surface.test.ts` asserting the baked `how-to-add-a-schema` body contains `tally`, `"in"`, `"total"`; then `just test` | EXTEND | computational | — |
| AC-2 — the docs state what a stored tally is, why validate recomputes, and that a hand-edited tally passes `build --check` | 2 | EXTEND→RUN: add a case asserting the `deterministic-documents` body carries the recompute/E463 statement; then `just test` | EXTEND | computational | — |
| AC-3 — the docs corpus regenerated cleanly; the emitted module still matches its sources | 2 | RUN: `just check-docs` | EXISTS | computational | — |
| AC-4 — a table whose FIRST column is tally-marked renders a labelled footer | 2 | EXTEND→RUN: add a case to `test/services/dd/core/tally.test.ts` rendering a first-column-marked table; then `npx vitest run test/services/dd/core/tally.test.ts` | EXTEND | computational | — |
| AC-5 — the empty-row semantic (stores `0`, not absent) is stated in the docs | 2 | EXTEND→RUN: doc-content case as AC-1; then `just test` | EXTEND | computational | — |
| AC-6 — the parse-vs-E463 asymmetry is recorded in the manifest note | 2 | EXTEND→RUN: extend `test/acts/dd-surface.test.ts`'s manifest assertions; then `just test` | EXTEND | computational | — |
| AC-7 — a stored tally cannot silently disagree with its rows | 1 | RUN: `npx vitest run test/services/dd/core/tally.test.ts` (21 cases incl. both negation proofs) and `just checks` | EXISTS | computational | — |
| Failure mode — the page contains the words but does not actually *teach*: a reader still can't declare a tally column on the first attempt | 2 | — | ABSENT | human-judgement | Globbed `**/*.spec.*`, `**/*.e2e.*`, `**/playwright.config.*`, `**/cypress.config.*` across root + `test/` — no match; no sensor in this repo simulates a reader following a page. `docs-surface.test.ts` proves presence of strings, which is the closest paved proxy and is already selected for AC-1/2/5 |
| Failure mode — a future shape/section key is eaten by an allow-list (the wl-0027 class) | — | RUN: the existing negation-proof pattern — disable the parse addition and confirm the suite names the plant | EXISTS | computational | — |
| Failure mode — the docs teach a policy the code no longer implements (float precision changes under Q2) | 4 | EXTEND→RUN: the AC-5 doc-content case is the coupling — if the stored precision changes, the asserted sentence must change with it; then `just test` | EXTEND | computational | — |

## Proof Plan (selected)

### Phase 1: Substrate — stored, rendered, validated tally
| Proves | Mode | Proof line |
|--------|------|------------|
| AC-7 | RUN | `npx vitest run test/services/dd/core/tally.test.ts` |
| whole gate | RUN | `just checks` |

### Phase 2: Docs and review polish
| Proves | Mode | Proof line |
|--------|------|------------|
| AC-3 | RUN | `just check-docs` |
| AC-1, AC-2, AC-5 | EXTEND→RUN | add doc-content cases to `test/docs-surface.test.ts`; then `just test` |
| AC-4 | EXTEND→RUN | add a first-column-marked render case to `test/services/dd/core/tally.test.ts`; then `npx vitest run test/services/dd/core/tally.test.ts` |
| AC-6 | EXTEND→RUN | extend the manifest assertions in `test/acts/dd-surface.test.ts`; then `just test` |

### Phase 3: Schema editing verbs — _gated on Q1; no proofs selected until the ruling_
### Phase 4: Float precision policy
| Proves | Mode | Proof line |
|--------|------|------------|
| policy ↔ docs stay coupled | EXTEND→RUN | the AC-5 doc-content case; then `just test` |

## Certainty: Partial

Counts (behaviour/architecture rows): 3 RUN · 6 EXTEND · 0 BUILD · 1 ABSENT
Recommended next move (per-task lookup, advisory): **propose the extension(s) first — the cheapest move, landing in a proven home.**

Every gap on this plan is an `EXTEND`, not a `BUILD`: the repo already owns a doc-content sensor, a tally test file, and a manifest gate, and each missing proof is a case added to one of them behind a command the team already runs. Nothing here needs a new sensor built, which is why this rates Partial rather than Weak despite six gaps.

## Recommended Phase 0: Establish Backpressure (build or extend)

The routing trigger fires (six `EXTEND` rows), but **no separate Phase 0 is warranted** — every extension belongs inside Phase 2 alongside the change it proves, and splitting them out would mint ceremony for work that is one case per file. Recorded here as the ordered list Phase 2 should carry, extensions ranked first:

| Sensor to build/extend | Proves | Suggested form | Paved command it strengthens/exposes |
|------------------------|--------|----------------|--------------------------------------|
| extend `test/docs-surface.test.ts` | AC-1, AC-2, AC-5 — the docs actually name `tally` and state its semantics | extension: doc-content cases against the baked bodies | `just test` (same command, stronger) |
| extend `test/services/dd/core/tally.test.ts` | AC-4 — first-column-marked footer stays labelled | extension: one render case | `npx vitest run test/services/dd/core/tally.test.ts` |
| extend `test/acts/dd-surface.test.ts` | AC-6 — the E463 manifest note records the parse-vs-mismatch asymmetry | extension: manifest assertion | `just test` |

## Closing Verdict

Here's how we'll know this work is actually done.

Most of what's left is documentation, and documentation is the one thing this repo has historically had no way to prove. That turned out to be wrong in a useful way: there is already a test in here that reads the shipped documentation pages and asserts what they say — it checks that the overview covers the four things a standalone reader needs, that the envelope contract is stated with its exit codes, that the schema ladder is listed in precedence order. That test is the home for every documentation promise in this plan. We don't need to build anything new; we teach a checker that already exists three more sentences to look for.

**One thing I already did, automatically:** I wrote the how-to-prove-it commands into the coverage artifact beside the plan, one line per promise, naming the exact command whose green output shows that promise is kept. That lives where the work lives, so whoever picks this up later sees it even after this conversation is gone.

**One thing I'd like your OK on:** folding those proof lines into the plan's criteria, so each one carries its own "done when this command is green" instead of someone deciding by eye at the end. Commands, not opinions — when they pass, those promises are kept, with no judgement call in the middle. And if the checks ever pass while a human says it still isn't done, then the checks are wrong and we fix them first, then the code — so that particular mistake can never slip through twice.

There is one thing no command here will settle. A test can prove the page contains the word `tally` and states the rule; it cannot prove the page actually *teaches* — that someone who has never seen this feature reads it once and declares a tally column correctly. That is your eyes, or a reader's, and no sensor in this repo will replace it.

**In summary:** the commands will prove that the documentation says the right things, that the docs corpus has not drifted, that the footer renders labelled on a first-column-marked table, that the manifest records the E463 asymmetry, and that a stored tally can never silently disagree with its rows. The human judgement that remains is whether the page genuinely teaches a newcomer, which stays a reading, not a check. The recommended next move for this task is to propose the extensions first — three cases in three files that already exist, behind commands the team already runs. The approval I'm asking for is to fold the per-criterion proof lines into the plan, not to build anything new.
