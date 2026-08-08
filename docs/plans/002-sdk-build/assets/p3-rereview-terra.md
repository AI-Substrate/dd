APPROVE

Scope: P3 P0 repair `6bbe890` only.

- The pinned delta changes only `src/node/index.ts`, `src/acts/shared.ts`, and
  `scripts/exports-reachability-probe.mjs`. `ActDeps` is no longer re-exported
  from the node barrel; `src/acts/shared.ts` imports it directly from the
  internal deps module. The public alias remains `DdActDeps`.
- Independent census (TypeScript checker, not the probe) after an isolated
  `npm run build --silent`:

  ```text
  dist/node/index.d.ts:
  DD_ISSUE_CODES, DdActDeps, NodeSchemaFs, renderDocument, trackedPaths
  ```

  The root declaration set is also exactly its 13 D-1 names.
- New probe section is green in the isolated fixed archive. Independent
  negative controls:
  - Restoring `ActDeps` in the isolated source barrel, rebuilding, then running
    the probe exits 1. Its only `FAIL` row is
    `FAIL  …/node surplus 1: ActDeps`; every runtime section remains green.
  - Removing `DdActDeps` from the emitted node declaration artifact makes the
    probe exit 1 with `FAIL  …/node missing 1: DdActDeps`.
  - Replacing the type re-export with `export * from './deps.js'`, rebuilding,
    makes the probe exit 1 with
    `REFUSED dist/node/index.d.ts — the barrel uses export *, so its surface is
    no longer enumerable by reading`.
- No runtime behavior changed. The only emitted-JS textual deltas are a source
  comment and TypeScript’s removed trailing import comma; dynamic namespace
  enumeration of both `dist/node/index.js` and `dist/acts/shared.js` is
  identical before (`06fbd88`) and after the repair.
