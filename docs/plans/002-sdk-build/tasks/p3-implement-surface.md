# P3 — Implement the ratified surface delta (D-1..D-6)

**Phase**: P3 of `dispatch-plan.md`. **Authority**: `design-decision.md` — RATIFIED, o-prime,
2026-08-08, as a set. Implement **exactly the delta** in its final section. Any deviation you
find necessary mid-build: STOP on that item, report it to the PM (amendment path), continue
other items. A surface change without an amendment is a finding against us both.

## Tasks

### T1 — Code moves (library half gains, CLI half re-imports; behavior identical)
- `FsDocLoader` → `src/links/` (implementation joins its decorator; update `links/index.ts`
  named exports; keep class name).
- `NodeSchemaFs`, `trackedPaths`, `DdActDeps` → new `src/node/` module (`src/node/index.ts`).
  `DdActDeps` gets TSDoc `@experimental` with one line saying a koala-trial reshape is
  anticipated (D-5).
- `DD_ISSUE_CODES` → `src/core/validate.ts` (or a sibling the validate module re-exports).
- `renderDocument` → `src/render/` (join the renderer family).
- `src/acts/*` re-import every moved symbol from its new home — the CLI behaves identically;
  `./acts/*` stays unexported. No import cycles (acts → lib only, never lib → acts).

### T2 — Root barrel + bin separation (D-1)
- New `src/lib.ts`: curated pure barrel per D-1's allowlist (parse, validateWalk,
  collectLinkCells, resolveAddressFile, DdIssue, parseAddress, isAddressFailure, DocLoader,
  SchemaResolver, MemoizingDocLoader, FsDocLoader, ConventionSchemaResolver, DdDoc). Comment
  header: "every addition is an API review".
- Importing lib.ts must have ZERO side effects — no CLI, no stdout, no process handlers.
- `bin` stays `dist/index.js` (unchanged file, still shebang+main). `exports["."]` retargets
  to `dist/lib.js`. `main`/`types`, if present, follow the lib.

### T3 — Exports map delta (exactly, nothing more)
```jsonc
".":                { "types": "./dist/lib.d.ts", "import": "./dist/lib.js" }
"./node":           { "types": "./dist/node/index.d.ts", "import": "./dist/node/index.js" }
// ./links, ./core/validate, ./render/renderer targets unchanged — they gain symbols via T1
```
Existing 11 subpaths and their targets: UNTOUCHED.

### T4 — Probe + tests
- Update `scripts/exports-reachability-probe.mjs` for the new surface (root barrel = named
  exports + NO CLI execution + no stdout; `./node` reachable; moved symbols reachable at new
  homes). The root no-side-effect assertion is the §4.3 regression gate — make it explicit.
- Remove `@ts-nocheck` from `test/trial-fixture/skeleton.ts` and delete the now-false
  `// UNREACHABLE:` markers for symbols the delta makes reachable (it should now typecheck as
  imports; it still need not RUN — P5 makes it a real fixture against the tarball).
- Unit tests for the moved symbols' new homes (import-path level; behavior is unchanged and
  already covered).

## Gates
`just checks` green, exit code read (C-6 discipline — report any transient red, never absorb).
Commits: one per T-block minimum, `harness commit "<msg>" -- <named files>`, message from
`git diff --cached`. NO publish, NO tags.

## Allowed paths
`src/**` (except `src/plan/` — R-2 forbids touching its public status; internal refactors of
plan/ imports only if a move forces it), `package.json` (exports/main/types ONLY),
`scripts/exports-reachability-probe.mjs`, `test/**`, `docs/plans/002-sdk-build/assets/`.

## Forbidden
`./acts/*` or `./plan` in the exports map · any symbol beyond the ratified delta · version
field changes · `.the-flow-state.json`, `the-flow.json`, `the-flow.md` · writes outside the
worktree.
