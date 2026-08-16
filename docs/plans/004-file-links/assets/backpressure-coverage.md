# Backpressure Coverage — dd file links

**Plan**: [`plan.dd.json`](../plan.dd.json)
**Basis (plan SHA-256)**: `9f1c3d37781cd607ed13c899dc56736ec965e2cd7fd27e5769f97d9de02966a5`
**Generated**: 2026-08-16
**Certainty**: Partial

> Advisory only. Selection, not enforcement: the proof lines below are the commands the implementation and review packets must run and read.

## Existing Sensors

| Sensor | Paved command | Dimension | Found in |
|--------|---------------|-----------|----------|
| Fast compiled-bin smoke | `harness boot --json` | behaviour / envelope | `.harness/extensions/boot`, `just boot` |
| Targeted Vitest through package script | `npm test -- <test-files>` | behaviour | `package.json#scripts.test`, `vitest.config.ts` |
| Source + test typecheck | `just typecheck` | maintainability / public shapes | `justfile` |
| SDK export reachability | `just check-exports` | public contract | `justfile`, `scripts/exports-reachability-probe.mjs` |
| Architecture tests | `npm test -- test/architecture` | architecture-fitness | `test/architecture/**` |
| Self-hosted dd corpus | `just self-host` | integration / render drift | `justfile`, `scripts/self-host-check.sh` |
| Full local/CI parity gate | `just checks` | integration / regression | `justfile`, `.github/workflows/ci.yml` |
| Packed consumer gate | `just pack-gate` | published integration | `justfile`, `.github/workflows/ci.yml#package-smoke` |

## Coverage Matrix

| Criterion / failure mode | Phase | Selected proof | Status | Tier | Probe trail |
|--------------------------|-------|----------------|--------|------|-------------|
| Bare-path grammar, old forms unchanged, future fragment retained (`ac-0001`) | 1 | EXTEND→RUN: add whole-file/property/compatibility cases to core address tests; then `npm test -- test/services/dd/core/address.test.ts` | EXTEND | computational | — |
| Removed-`#` dd typo in targeted and untargeted link fields (`ac-000a`) | 1 | EXTEND→RUN: add the two discriminator fixtures before broader code; then `npm test -- test/services/dd/core/address.test.ts test/services/dd/core/validate.test.ts` | EXTEND | computational | — |
| Structured `target: file` edges (`ac-0002`) | 1 | EXTEND→RUN: add schema/collector cases; then `npm test -- test/services/dd/core/validate.test.ts test/services/dd/schema/declarations.test.ts` | EXTEND | computational | — |
| Narrow Markdown population and negatives (`ac-0003`) | 1 | EXTEND→RUN: add inline/local + URL/bare/fragment/image controls; then `npm test -- test/services/dd/core/validate.test.ts` | EXTEND | computational | — |
| Existing zero / missing exactly-one WARN / existence only (`ac-0004`) | 1 | EXTEND→RUN: add an injected existence recorder and remove/restore target control; then `npm test -- test/services/dd/core/walk.test.ts test/services/dd/core/validate.test.ts` | EXTEND | computational | — |
| Build ok/degraded/drift precedence (`ac-0005`) | 2 | EXTEND→RUN: add real nested file-link build fixtures; then `npm test -- test/acts/dd-build.test.ts` | EXTEND | computational | — |
| Working sibling-relative structured hrefs; literal Markdown preserved (`ac-0006`) | 2 | EXTEND→RUN: add renderer fixture from a nested dd path; then `npm test -- test/services/dd/render/renderer.test.ts test/services/dd/render/fixture-corpus.test.ts` | EXTEND | computational | — |
| Links/graph resolved leaf vs missing dashed node; no traversal (`ac-0007`) | 2 | EXTEND→RUN: add traverse/report/Mermaid/CLI cases; then `npm test -- test/services/dd/links/traverse.test.ts test/services/dd/links/graph.test.ts test/acts/dd-links-live.test.ts test/acts/dd-graph-human.test.ts` | EXTEND | computational | — |
| Honest public unions and migrated consumers (`ac-0008`) | 2 | RUN: `just typecheck`; RUN: `just check-exports`; EXTEND→RUN: assert exported target/node declarations in consumer tests; then `npm test -- test/consumer-surface.test.ts test/package-manifest.test.ts` | EXTEND | computational | — |
| Port ledger, forbidden-path fence, mutation proof, full gate (`ac-0009`) | 2 | RUN: `node bin/ddocs.js --json status`; RUN: `just checks`; RUN: `just pack-gate`; reviewer performs independent mutation before approval | EXISTS | computational + independent review | — |
| SDK-tree purity survives new existence seam | 1–2 | RUN: `npm test -- test/architecture`; RUN: `just typecheck` | EXISTS | computational | — |

## Proof Plan (selected)

### Phase 1: Address and discovery contract

| Proves | Mode | Proof line |
|--------|------|------------|
| Grammar + typo discriminator | EXTEND→RUN | Add address/validation cases, including both target contexts; then `npm test -- test/services/dd/core/address.test.ts test/services/dd/core/validate.test.ts`. If the untargeted typo is WARN-only, stop and report before later tasks. |
| Structured/Markdown populations + existence | EXTEND→RUN | Add positive/negative collector and remove/restore fixtures; then `npm test -- test/services/dd/core/validate.test.ts test/services/dd/core/walk.test.ts test/services/dd/schema/declarations.test.ts`. |
| Public/pure foundation | RUN | `just typecheck` and `npm test -- test/architecture`. |

### Phase 2: Product surfaces and end-to-end proof

| Proves | Mode | Proof line |
|--------|------|------------|
| Render/build behavior | EXTEND→RUN | Add nested href and build status cases; then `npm test -- test/services/dd/render/renderer.test.ts test/acts/dd-build.test.ts`. |
| Links/graph truthfulness | EXTEND→RUN | Add resolved leaf, missing dashed and no-traversal cases; then `npm test -- test/services/dd/links/traverse.test.ts test/services/dd/links/graph.test.ts test/acts/dd-links-live.test.ts test/acts/dd-graph-human.test.ts`. |
| Public and repository completion | RUN | `just typecheck`, `just check-exports`, `node bin/ddocs.js --json status`, `just checks`, then `just pack-gate`. |
| Non-vacuity | EXTEND→RUN | Reviewer independently breaks the world (target/remove or classification), proves named RED, restores, and proves GREEN with the targeted command. |

## Certainty: Partial

Counts (behaviour/architecture rows): 3 RUN · 10 EXTEND · 0 BUILD · 0 ABSENT.

Recommended next move: land the named extensions before or with the corresponding implementation task; no new checker or Phase 0 is needed because every gap extends an existing test/architecture/CLI lane.

## Recommended Phase 0: Establish Backpressure (extend)

| Sensor to extend | Proves | Suggested form | Paved command strengthened |
|------------------|--------|----------------|---------------------------|
| Core address + validation tests | Grammar broadening does not soften malformed dd links silently | Two explicit target-context fixtures plus parser property cases | `npm test -- test/services/dd/core/address.test.ts test/services/dd/core/validate.test.ts` |
| Existing render/build/link/graph suites | Every public face reads the same ordinary-file edge truthfully | Nested real-file corpus with present/remove/restore arms | Targeted `npm test -- …` commands above |

## Closing Verdict

One thing I already did automatically: selected the exact existing commands and test homes that can prove every machine-checkable promise, so “done” is a list of outputs rather than an opinion. One thing I need the fleet to do before feature code runs ahead: extend the address and validation tests with the removed-`#` discriminator, because the approved grammar can otherwise soften a typo from an error into a warning without any happy path noticing.

If a test later passes while an independent reviewer still demonstrates the behavior is wrong, the checker is the first defect: fix it before the code so the same escape cannot recur.

In summary: the repository already has the necessary deterministic lanes; this work strengthens ten of them and uses three existing gates unchanged. No human-only product judgement remains after the o-prime’s bare-path approval, but the untargeted typo outcome is a deliberate decision pause if it measures WARN-only. Approval requested: dispatch Phase 1 with that stop condition verbatim in the packet.
