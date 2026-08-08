# P5 — The §5.1 trial fixture: installed tarball, foreign port, real document

**Phase**: P5 of `dispatch-plan.md`. **Authority**: `requirements.md` §5.1 (the corrected
trial bar — koala's, ruled) + design-decision.md D-6. This is the plan's acceptance gate:
green here = ready-to-trial (R-4 milestone).

## The bar, restated as tasks (§5.1's four clauses, in order)

### T1 — Pack-and-install harness
A script (`scripts/trial-fixture-run.mjs` or a justfile recipe `check-trial`) that:
1. `npm pack` into a temp dir (respecting the existing pack gate's clean-clone discipline —
   coordinate with `just check-pack` rather than duplicating it; extend that lane if cleaner);
2. installs the tarball into a scratch consumer project (temp dir, real `npm install <tgz>`,
   NOT file:.. link, NOT workspace);
3. runs the fixture (T2) inside that scratch project with `@ai-substrate/dd` resolving from
   `node_modules`;
4. exits non-zero on any failure, with the failing clause named (C-6: a gate must attribute).

### T2 — The fixture itself (evolves test/trial-fixture/skeleton.ts into a RUNNING consumer)
In the scratch project, a script that:
1. constructs `ConventionSchemaResolver` and `MemoizingDocLoader(new FsDocLoader(...))` with
   a **fixture-owned foreign fs port** (the census C-group stand-ins: readText/readdir/exists
   over an in-memory or scratch-dir corpus; own sha256Hex hash port) — reproducing the
   census construction shapes C1–C4 including the conditional-home options object and the
   tracked-set modes (null + a supplied ReadonlySet; the async trackedPaths path needs an
   ExecPort stand-in or the null mode — use what the shapes require, per skeleton);
2. drives a **real plan document** through `validateWalk`/`resolveAddressFile`/link
   traversal — use a copy of a genuine dd plan doc (e.g. this plan's own requirements.md
   corpus or a committed fixture corpus under test/trial-fixture/corpus/);
3. imports **every P1-census trial symbol** via public subpaths only — the import list IS
   the acceptance measurement (§5 progress bar): no deep paths, no relative imports into
   the package, no `./acts/*`, no `./plan`;
4. asserts real outputs (issues found/absent, map nodes, rendered output present) — not just
   "didn't throw".

### T3 — publint + attw on the tarball (D-6, ratified)
Add `publint --strict` and `@arethetypeswrong/cli --pack` to the same lane, running against
the packed tarball. Pin both as devDependencies (SHA-pinned per C-2 is for git deps; these
are registry devDeps — exact-version pin). Failures gate.

### T4 — Wire into `just checks`
`just checks` gains the trial lane (or extends check-pack). Order it AFTER build. The gate
must NAME its failing clause on red (attributability — the C-6 lesson encoded in a new gate).

## Constraints
- No changes to src/ or the exports map — the surface is FROZEN as reviewed; if the fixture
  reveals a surface gap, that is a FINDING for the PM (amendment path), not a fix you make.
- The §5.1 population rider applies: the fixture proves the TRIAL population. Do not import
  plan-shaped symbols to make anything easier.
- Temp dirs under the repo's .harness/temp or OS tmp — never committed; the corpus IS
  committed (small, deterministic).
- `harness commit` per T-block, staged set re-derived from git status first.

## Forbidden
Surface changes · src/ edits (except nothing) · package.json edits beyond devDependencies +
scripts/justfile wiring · flow-state files · publish/tags.
