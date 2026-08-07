# Import-direction audit — all 60 upstream dd test files

**Task**: tk-0003 (plan 001, phase 1) · **ac-0006**
**Upstream**: `AI-Substrate/harness-engineering` @ `d08f4942d28b7e5181d5845a56a63b0cbb1d3402` (READ-ONLY)
**Committed BEFORE any test file moved** — that ordering is load-bearing (see § Why first).

## The set

60 files, enumerated mechanically:

```bash
{ find test/services/dd -name '*.test.ts';                       # 36
  find test -name '*dd*.test.ts' -not -path 'test/services/dd/*'; # 24
} | sort   # => 60
```

## Rule

Classification is by **import direction**, then by subject-of-test where imports alone
under-determine it (5 files, each flagged in the table with its reasoning):

| Class | Test |
|---|---|
| **stay** | reaches into `src/services/flow/**`, `src/services/builder/**`, or `src/services/telemetry/**` — harness-side internals dd will never own — **or** its subject is a harness-side consumer contract (the flow↔dd gate, the flow→dd SDK seam). These are consumers OF dd, not tests OF dd. |
| **port** | its subject is dd itself, and it reaches only into dd trees, fixtures, node builtins, or the CLI shell this repo is building. |

`lands` sub-classifies the port set by what the file needs to exist before it can run:

| lands | Needs | Count |
|---|---|---|
| `ph1` | dd SDK only — **moves now** | **31** |
| `ph2` | `src/acts/dd/**`, `src/output/**`, `src/adapters/**`, or `test/support/run-cli` (the compiled CLI) | 17 |
| `ph3` | the `docs/how/dd/` corpus | 1 |
| — (stay) | never ports | 11 |

**49 port · 11 stay · 60 total.**

## Why first

A consumer test ported by accident imports flow internals that do not exist in this repo.
Vitest then reds on a module-resolution error, and the cause reads as "the SDK port is
broken" when the truth is "this file was never a dd test". The fence goes up before the
move, not after the confusion.

## Findings

1. **The stay set is 11, not the 9 the plan predicted (KF-6's "~9").** dw-0003's named
   floor — the 6 `flow-dd-*`, `builder-dd-teaching`, `acts/flow-dd-gate`,
   `integration/dd-flow-gate.int` — is fully contained. The audit found **two more**:
   - `test/services/dd/plan/ready.test.ts` — **lives inside the dd tree** but imports
     `src/services/flow/chores-read.js`. This is precisely the file the audit exists to
     catch: location says dd, imports say flow. (`src/plan/ready.ts` itself is clean — the
     ac-0001 gate proves the SDK has no flow import; only the *test* is a consumer.)
   - `test/acts/dd-native-dryrun.int.test.ts` — imports `src/services/telemetry/…` and its
     subject is the harness journey (template → scaffolder → gate → depart), not dd.
2. **`flow-dd-sdk-seam.test.ts` is the one stay file that imports *only* dd.** It imports
   dd's barrels solely to enumerate them, then scans `src/services/flow/**` for imports
   that reach past them. The subject is the flow side of the seam, so it stays — and
   dw-0003 names it in the floor.
3. **6 of the 36 files under `test/services/dd/` are act-level**, importing
   `src/acts/dd/schema-fs.js` or `src/acts/dd/build.js`. They are dd tests and they port —
   in phase 2, with the acts they exercise.
4. `test/services/dd/error-codes.test.ts` imports `src/output/error-codes.js`, which *does*
   exist in this repo's stub — but it asserts dd's own `E4xx` codes, which phase 2 adds.
   Classified `ph2` on the codes, not on the module path.

## Fixture directories (4, all move with the ph1 set)

| Upstream | Here |
|---|---|
| `test/services/dd/fixtures/` | `test/services/dd/fixtures/` |
| `test/services/dd/links/fixtures/` | `test/services/dd/links/fixtures/` |
| `test/services/dd/render/fixtures/` | `test/services/dd/render/fixtures/` |
| `test/services/dd/schema/fixtures/` | `test/services/dd/schema/fixtures/` |

## The table

| upstream file | class | lands | deciding import line |
| --- | --- | --- | --- |
| `test/acts/builder-dd-teaching.test.ts` | **stay** | — | import { ddLinkOf, type FlowNode } from '../../src/services/flow/flow-events.js'; |
| `test/acts/dd-native-dryrun.int.test.ts` | **stay** | — | import { outcomeEvents } from '../../src/services/telemetry/outcome-events.js'; — subject is the harness journey (template→gate→depart) |
| `test/acts/flow-dd-gate.test.ts` | **stay** | — | import { buildProgram } from '../../src/app.js'; — drives `flow nav set --now` / `orient`; the FLOW gate is the subject |
| `test/integration/dd-flow-gate.int.test.ts` | **stay** | — | execFileSync(harness, ['flow','nav','set','--now','review']) — spawns the real CLI against a scaffolded FLOW |
| `test/services/dd/plan/ready.test.ts` | **stay** | — | import { readBackpressureSurvey } from '../../../../src/services/flow/chores-read.js'; |
| `test/services/flow/flow-dd-check-gate.test.ts` | **stay** | — | import { type GateEvaluator, setNow } from '../../../src/services/flow/flow-mutations.js'; |
| `test/services/flow/flow-dd-gate-surface.test.ts` | **stay** | — | import { ddGateDrift, evaluateDdGate } from '../../../src/services/flow/flow-dd-gate.js'; |
| `test/services/flow/flow-dd-gate.test.ts` | **stay** | — | import { evaluateDdGate } from '../../../src/services/flow/flow-dd-gate.js'; |
| `test/services/flow/flow-dd-link-optin.test.ts` | **stay** | — | import type { FlowDoc } from '../../../src/services/flow/flow-events.js'; |
| `test/services/flow/flow-dd-sdk-seam.test.ts` | **stay** | — | scans src/services/flow/** for imports past dd's barrels — a FLOW-side guard (its dd imports only enumerate the barrels) |
| `test/services/flow/flow-dd-untrusted-reading.test.ts` | **stay** | — | import { applyBatch, setNode, setNow } from '../../../src/services/flow/flow-mutations.js'; |
| `test/architecture/dd-core-isolation.test.ts` | **port** | ph1 | (no src imports — walks the tree) — PORTED in tk-0001, adapted to src/ layout |
| `test/architecture/dd-plan-semantics-frozen.test.ts` | **port** | ph1 | (no src imports — digests src/plan/semantics.ts) — PORTED in tk-0001, re-pinned |
| `test/services/dd/core/address.test.ts` | **port** | ph1 | (node builtins + local fixtures only) |
| `test/services/dd/core/bucket.test.ts` | **port** | ph1 | import { hasLinksBucket, readLinksBucket } from '../../../../src/services/dd/core/bucket.js'; |
| `test/services/dd/core/constants.test.ts` | **port** | ph1 | (node builtins + local fixtures only) |
| `test/services/dd/core/derive.test.ts` | **port** | ph1 | import { deriveRollup, deriveState } from '../../../../src/services/dd/core/derive.js'; |
| `test/services/dd/core/parse.test.ts` | **port** | ph1 | import type { DdDoc, DdFailure } from '../../../../src/services/dd/core/model.js'; |
| `test/services/dd/core/rel.test.ts` | **port** | ph1 | import { BUILTIN_RELS, DEFAULT_REL } from '../../../../src/services/dd/core/constants.js'; |
| `test/services/dd/core/validate.test.ts` | **port** | ph1 | import type { DdDoc } from '../../../../src/services/dd/core/model.js'; |
| `test/services/dd/core/values-shape.test.ts` | **port** | ph1 | import type { DdDoc, ResolvedDdSchema } from '../../../../src/services/dd/core/model.js'; |
| `test/services/dd/core/walk.test.ts` | **port** | ph1 | import type { DdDoc } from '../../../../src/services/dd/core/model.js'; |
| `test/services/dd/docs/dd-docs-drift.test.ts` | **port** | ph1 | (node builtins + local fixtures only) |
| `test/services/dd/docs/dd-docs.test.ts` | **port** | ph1 | import type { DdDocRecord } from '../../../../src/services/dd/docs/contract.js'; |
| `test/services/dd/fixture-corpus.test.ts` | **port** | ph1 | (node builtins + local fixtures only) |
| `test/services/dd/links/basis.test.ts` | **port** | ph1 | import { updateLedgerEntry, verifyBasis } from '../../../../src/services/dd/links/basis.js'; |
| `test/services/dd/links/doctor.test.ts` | **port** | ph1 | import { runDoctor } from '../../../../src/services/dd/links/doctor.js'; |
| `test/services/dd/links/graph.test.ts` | **port** | ph1 | import { toMermaid } from '../../../../src/services/dd/links/graph.js'; |
| `test/services/dd/links/isolation.test.ts` | **port** | ph1 | (node builtins + local fixtures only) |
| `test/services/dd/links/map-exemplar.test.ts` | **port** | ph1 | import { parse } from '../../../../src/services/dd/core/parse.js'; |
| `test/services/dd/links/map.test.ts` | **port** | ph1 | import type { DdDoc, ResolvedDdSchema } from '../../../../src/services/dd/core/model.js'; |
| `test/services/dd/links/rel-graph.test.ts` | **port** | ph1 | import type { DdDoc, ResolvedDdSchema } from '../../../../src/services/dd/core/model.js'; |
| `test/services/dd/links/resolver.test.ts` | **port** | ph1 | import { resolveLink } from '../../../../src/services/dd/links/resolver.js'; |
| `test/services/dd/links/scan.test.ts` | **port** | ph1 | import { DD_SUFFIX, scanCorpus } from '../../../../src/services/dd/links/scan.js'; |
| `test/services/dd/links/traverse.test.ts` | **port** | ph1 | import type { DdLinkEdge } from '../../../../src/services/dd/links/model.js'; |
| `test/services/dd/mutate/mutate.test.ts` | **port** | ph1 | import type { DdDoc } from '../../../../src/services/dd/core/model.js'; |
| `test/services/dd/render/renderer-purity.test.ts` | **port** | ph1 | (node builtins + local fixtures only) |
| `test/services/dd/render/renderer.test.ts` | **port** | ph1 | import { deriveState } from '../../../../src/services/dd/core/derive.js'; |
| `test/services/dd/schema/corpus.test.ts` | **port** | ph1 | (node builtins + local fixtures only) |
| `test/services/dd/schema/declarations.test.ts` | **port** | ph1 | import { parseSchemaDeclaration } from '../../../../src/services/dd/schema/declarations.js'; |
| `test/services/dd/schema/exemplar.test.ts` | **port** | ph1 | import { deriveState } from '../../../../src/services/dd/core/derive.js'; |
| `test/services/dd/schema/resolve.test.ts` | **port** | ph1 | import { validateDocument } from '../../../../src/services/dd/core/validate.js'; |
| `test/acts/dd-build.test.ts` | **port** | ph2 | import { autoRegenerateSibling, siblingPath } from '../../src/acts/dd/build.js'; |
| `test/acts/dd-graph-human.test.ts` | **port** | ph2 | import type { VerbActDeps } from '../../src/acts/verb.js'; |
| `test/acts/dd-graph-map-live.test.ts` | **port** | ph2 | import type { VerbActDeps } from '../../src/acts/verb.js'; |
| `test/acts/dd-issue-codes.test.ts` | **port** | ph2 | import { DD_ISSUE_CODES } from '../../src/acts/dd/shared.js'; |
| `test/acts/dd-links-live.test.ts` | **port** | ph2 | import type { VerbActDeps } from '../../src/acts/verb.js'; |
| `test/acts/dd-live.test.ts` | **port** | ph2 | import type { VerbActDeps } from '../../src/acts/verb.js'; |
| `test/acts/dd-schema-fs.test.ts` | **port** | ph2 | import { NodeSchemaFs } from '../../src/acts/dd/schema-fs.js'; |
| `test/acts/dd-surface.test.ts` | **port** | ph2 | import { ErrorCodes } from '../../src/output/error-codes.js'; |
| `test/acts/dd-validate-mechanical.test.ts` | **port** | ph2 | import { createSyntheticPlan, type SyntheticCorpus } from '../support/dd-corpus.js';  — drives the compiled CLI |
| `test/acts/dd-write-live.test.ts` | **port** | ph2 | import { createSyntheticPlan, type SyntheticCorpus } from '../support/dd-corpus.js';  — drives the compiled CLI |
| `test/acts/dd.test.ts` | **port** | ph2 | import type { VerbActDeps } from '../../src/acts/verb.js'; |
| `test/services/dd/error-codes.test.ts` | **port** | ph2 | import { ErrorCodes } from '../../../src/output/error-codes.js'; |
| `test/services/dd/render/adapters.test.ts` | **port** | ph2 | import { NodeSchemaFs } from '../../../../src/acts/dd/schema-fs.js'; |
| `test/services/dd/render/fixture-corpus.test.ts` | **port** | ph2 | import { registerBuildCommand } from '../../../../src/acts/dd/build.js'; |
| `test/services/dd/render/gaps.test.ts` | **port** | ph2 | import { NodeSchemaFs } from '../../../../src/acts/dd/schema-fs.js'; |
| `test/services/dd/render/refresh.test.ts` | **port** | ph2 | import { autoRegenerateSibling } from '../../../../src/acts/dd/build.js'; |
| `test/services/dd/schema/builder-rels.test.ts` | **port** | ph2 | import { NodeSchemaFs } from '../../../../src/acts/dd/schema-fs.js'; |
| `test/acts/dd-command-coverage.test.ts` | **port** | ph3 | readFileSync(`${ROOT}docs/how/dd/10-command-reference.md`) — needs the docs/how corpus phase 3 ports |
