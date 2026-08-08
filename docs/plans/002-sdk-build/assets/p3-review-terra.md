FIX_REQUIRED

## Blocking finding

**P0 — unratified reachable type: `ActDeps`.** `src/node/index.ts` exports both
`ActDeps` and `DdActDeps`:

```ts
export type { ActDeps, DdActDeps } from './deps.js';
```

D-2 as amended by A-1 authorizes exactly five symbols at the new `./node`
subpath: `NodeSchemaFs`, `trackedPaths`, `DdActDeps`, `DD_ISSUE_CODES`, and
`renderDocument`. The independent declaration-surface census against `22e207f`
found six:

```text
./node
  added: ActDeps, DD_ISSUE_CODES, DdActDeps, NodeSchemaFs, renderDocument, trackedPaths
```

`ActDeps` is a real consumer-visible type (`dist/node/index.d.ts` exports it),
not a runtime-erasure artifact. It is neither listed in the ratified allowlist
nor needed by the P3 fixture, which imports `DdActDeps`. The node barrel must
not export it (internal act wiring can import it from its implementation module
if required).

## Independent evidence for all remaining checks

- **Full surface enumeration:** I built isolated `22e207f` and `06fbd88`
  archives, dynamically imported every mapped runtime target, and independently
  used the TypeScript checker over each mapped `.d.ts` target. Every existing
  subpath is declaration-identical; the root adds exactly the ratified 9 runtime
  names plus 4 types; `./links` adds only `FsDocLoader`; the sole surplus is
  `ActDeps` at `./node`. Runtime `./node` has its four runtime members, with the
  intended `DdActDeps` and surplus `ActDeps` visible only in declarations.
- **Root purity / CLI:** A consumer-context
  `import('@ai-substrate/dd')` wrote no output before the command's own JSON
  print and yielded the nine ratified runtime names. My recursive source import
  walk from `src/lib.ts` reached only `core/`, `links/`, `schema/`, and
  `shared/`; it did not reach `index.ts`, `app.ts`, `output/`, or `adapters/`.
  `node bin/dd.js --json version` returned the expected version envelope, and
  `bin` is byte-identical across the compared trees.
- **Dim-0, independently mutated:** In the isolated post-P3 archive I removed
  the `./node` exports-map entry, then ran:

  ```sh
  node scripts/exports-reachability-probe.mjs
  ```

  It exited **1** with five explicit failures (`node` forbidden plus the four
  runtime moved-symbol checks). I restored the exact map entry and the same
  command exited **0**. Captured red tail:

  ```text
  FORBIDDEN  node  ERR_PACKAGE_PATH_NOT_EXPORTED
  MISSING    NodeSchemaFs     at …/node
  MISSING    trackedPaths     at …/node
  MISSING    DD_ISSUE_CODES   at …/node
  MISSING    renderDocument   at …/node
  5 FAILURE(S):
    - node is FORBIDDEN but must be reachable
    - NodeSchemaFs is not reachable at …/node
    - trackedPaths is not reachable at …/node
    - DD_ISSUE_CODES is not reachable at …/node
    - renderDocument is not reachable at …/node
  ```
- **Purity boundary:** all four commits leave
  `test/architecture/dd-core-isolation.test.ts` untouched (same blob
  `7728c14...` pre/post); `SDK_DIRS` excludes `node`; the isolated architecture
  test passed 4/4.
- **Moves / skeleton:** reviewed the T1 hunks for all six relocations. Bodies
  are moved and acts re-import them; the sole shape adaptation is the
  A-1-ratified structural port redeclaration for `FsDocLoader`. Focused move
  tests passed 22/22, `npm run typecheck --silent` passed with the pragma gone,
  and no `UNREACHABLE:` marker remains.
- **A-1 reverse check:** `src/core/validate.ts` and `src/render/renderer.ts`
  are byte-identical pre/post. The mapped declaration census exposes neither
  `DD_ISSUE_CODES` nor `renderDocument` from any SDK-tree subpath; both appear
  only at `./node`.
