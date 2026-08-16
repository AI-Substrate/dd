# Immutable implementation packet — wl-0023 Phase 1

**Role**: coder (`pij-molecular-flyingfish`, OMP, `github-copilot/claude-opus-5:xhigh`)
**PM**: `pij-yabbering-cod`
**Plan**: `docs/plans/004-file-links/plan.dd.json`
**Phase task source**: `docs/plans/004-file-links/assets/tasks/phase-1/tasks.dd.json`
**Proposal/ruling**: `docs/plans/004-file-links/assets/whole-file-form-proposal.md`
**Research**: `docs/plans/004-file-links/assets/research-dossier.md`
**Backpressure selection**: `docs/plans/004-file-links/assets/backpressure-coverage.md`
**Worktree**: `/Users/jordanknight/substrate/dd-worktrees/file-links`
**Branch**: `feat/file-links`
**Parent SHA**: `13f03f38acfde68ff11da0c32209c0815e7e9213`

## Whole-phase assignment

Implement every Phase 1 task (`tk-0001` through `tk-0004`) in one run. Do not hand back between tasks unless the approval-condition hold fires. This phase establishes the public grammar and the one file-reference discovery/existence contract; it does not integrate build/render/graph product surfaces yet.

## Mandatory first reads

1. `BRIEF-file-links.md`
2. `.harness/government/orient-local.md`
3. `docs/plans/004-file-links/assets/whole-file-form-proposal.md`
4. `docs/plans/004-file-links/assets/tasks/phase-1/tasks.dd.json`
5. `docs/plans/004-file-links/assets/research-dossier.md`

Then run LSP references for exported `parseAddress` before editing. Reuse current patterns; do not create a second parser, resolver, edge type, or validation convention.

## Approved contract

- Whole file canonical syntax is the bare path: `src/search/index.ts`.
- `parseAddress` returns `{ file: "src/search/index.ts", segments: [] }`; `formatAddress` returns the same bare path.
- Empty input and a trailing `#` remain invalid.
- Existing `#interior` and `file#interior` behavior remains unchanged.
- `src/foo.ts#parseThing` remains syntax-valid and unclassified; method resolution is out of scope.
- Structured file references require schema `target: "file"`, store plain repository-relative paths, use the schema relation, and resolve from repository root.
- Incidental references are only explicit inline Markdown `[label](destination)` inside schema-declared `text`; they use `ref` and resolve from the containing/generated document directory.
- Exclude URI-schemed destinations (including HTTP(S)), fragment-only links, images, reference-style links, malformed syntax, non-`text` fields, and bare prose paths.
- Existence only. No content read, parse, hash, VCS tracking, schema resolution, extension allowlist, glob, freshness, or `verify-basis` integration.
- Missing file is exactly one WARN naming authored path/location/owner; existing file is zero findings.

## Approval-condition hold — run before broader work

This condition came from `pij-mental-dajeil` and is binding.

After the bare-path parser change compiles, mechanically exercise the same removed-`#` typo in two link shapes:

```text
intended: plan.dd.json#tasks
mistyped: plan.dd.jsontasks
(a) shape: { type: "link", target: "<a dd section target>" }
(b) shape: { type: "link" }
```

Required discriminator:

1. The dd-targeted shape must reject on type before any existence probe.
2. Record the exact issue class/severity and whether the existence probe ran for the untargeted shape.
3. **If (b) becomes only a missing-file WARN, STOP.** Do not start `tk-0003`, do not touch Phase 2, do not choose a remedy. Send the exact targeted command/output to `pij-yabbering-cod`; the PM returns it to the o-prime for ruling.
4. If (b) remains a hard error, pin the outcome as an asserted tripwire and continue.

No argument substitutes for this experiment. Prove both fields; absence of a finding is not proof unless the control arm fires.

## Allowed paths

- `src/core/address.ts`
- `src/core/model.ts`
- `src/core/validate.ts`
- `src/core/walk.ts`
- `src/schema/declarations.ts` only if `target: "file"` parsing needs a strict contract change
- `src/links/model.ts`
- `src/links/resolver.ts`
- `src/links/loader.ts` only if the existing structural fs seam must expose existence
- `src/links/index.ts` only for a deliberate Phase 1 public type/export change
- `src/lib.ts` only if the already-curated root must expose a type required by an existing root symbol
- Targeted existing tests/helpers/fixtures under:
  - `test/services/dd/core/**`
  - `test/services/dd/schema/**`
  - `test/services/dd/links/{resolver,loader}.test.ts`
  - `test/services/dd/links/helpers.ts`
  - `test/consumer-surface.test.ts`

Ask the PM before touching any other path. Do not silently widen.

## Forbidden paths

- Phase 2 surfaces: `src/links/{traverse,graph,map,report,doctor,scan}.ts`, `src/render/**`, `src/node/render-document.ts`, `src/acts/**`, and their product-surface tests
- `src/acts/status.ts` and its `PLANNED_VERBS`
- `.harness/government/**`
- baked docs: `src/docs/content/**`, `src/docs/docs-content.ts`, `docs/how/dd/**`
- `.the-flow-state.json`, `the-flow.json`, `the-flow.md`
- `.flow-pair/**`, `.harness/temp/**`, `dist/**`, `coverage/**`, `node_modules/**`
- Any `.dd.md` by hand

## Implementation constraints

- Fix at the shared source; no special-case in an act.
- Keep core/links host-free. Inject the smallest existence seam; Node wiring belongs in Phase 2.
- Prefer discriminated public unions to fake/null dd metadata where a file target genuinely has a different shape.
- Avoid new dependencies; the narrow Markdown population does not justify a parser package.
- Do not infer all bare strings as file links. Grammar acceptance does not authorize path guessing.
- Clean cutover: update every in-scope caller/test; no deprecated alias or fallback parser.

## Required proof before COMPLETE

Run and read these targeted lanes, not the project-wide suite:

```bash
npm test -- test/services/dd/core/address.test.ts test/services/dd/core/validate.test.ts
npm test -- test/services/dd/core/walk.test.ts test/services/dd/schema/declarations.test.ts
npm test -- test/services/dd/links/resolver.test.ts test/services/dd/links/loader.test.ts
just typecheck
npm test -- test/architecture
```

Non-vacuity:

- Existing target → zero file-link findings.
- Remove/rename the target → exactly one WARN naming the path.
- Restore target → zero findings.
- Break one grammar/discovery guard, observe the targeted test RED naming the planted defect, restore, observe GREEN.
- Prove the existence seam was not called for the typed typo rejection and that ordinary target content was never read/hashed.

Do not run `just checks`, formatter, pack gate, or project-wide validation; the PM runs those once after review.

## Done report

Do not commit yet. Send the PM one C10 message through `pij send pij-yabbering-cod`:

1. First line: `COMPLETE Phase 1` or `BLOCKED approval condition`.
2. Changed paths.
3. Approval-condition command + exact typed/untargeted outcomes.
4. Targeted proof commands with pass/fail counts.
5. Mutation RED→GREEN evidence.
6. Any public `.d.ts` shape change and why it is honest.

Then stop editing and wait for review/fix routing.
