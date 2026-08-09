APPROVE

Scope: only `24d1255` in `/Users/jordanknight/substrate/dd-worktrees/s002-sdk-build`.
The commit changes exactly the declared fence:

```text
docs/plans/002-sdk-build/assets/mid-suite-rebuild-race.md
test/package-manifest.test.ts
```

`git show --check --format= 24d1255` was clean. No paused micro-packet file is
part of the commit. The target worktree retained only its pre-existing unrelated
`M test/architecture/dd-core-isolation.test.ts`.

## Mechanism and independent green run

I read `packDryRun()` at the pinned commit and confirmed its construction:
`mkdtempSync()` creates a temporary root; `cpSync(repoRoot, tree, ...)` copies
the repository while excluding `node_modules`, `.git`, and `coverage`; it then
removes exactly `prepack` and `prepare` from *the copied* `package.json` before
executing `npm pack --dry-run --json --ignore-scripts` with `cwd: tree`.
The cache means all four artifact assertions consume one copied-tree pack.

Own run from an isolated copy of the pinned target, with its `node_modules`
symlinked read-only from the target:

```text
./node_modules/.bin/vitest run test/package-manifest.test.ts --coverage
Test Files  1 passed (1)
Tests  10 passed (10)
```

I recorded `mtimeMs` for that isolated copy's live `dist/index.js`,
`dist/app.js`, and `dist/output/exit.js` immediately before and after the run:

```text
diff -u before after
# no output
```

This is an independent Node 24/npm 11 green proof that the suite does not write
its live `dist/`. No node 22/npm 10 executable is installed in this review
environment (`node v24.7.0`, `npm 11.10.0`; no `node22`, `npm10`, or `nvm`);
the prescribed old-shape positive control is therefore skipped rather than
claimed.

## Negation

In the isolated review copy only, after the production stripping code, I added:

```ts
copiedManifest.files = [...copiedManifest.files, 'src'];
```

The targeted suite exited 1. Both intended artifact rows failed and named the
leak:

```text
carries the bin, the build output and the licence, and nothing else
expected [ 'src' ] to deeply equal []

leaks no sources, tests, fixtures or repo furniture
expected [ 'src/acts/address.ts', ...(98) ] to deeply equal []
```

This proves the pack is reading the mutated copied manifest and that the
surplus-source guard is live.

## Measurement note

The newly added asset records the measured four-cell npm 10.9.2/npm 11.x
`prepare` behavior table, including that npm 10 runs `prepare` despite
`--ignore-scripts`; it distinguishes the measured fact from the prior false
assumption and explicitly limits the historic PR identity claim.

Evidence:

- `24d1255-green.log`
- `24d1255-src-leak.log`
- `24d1255-dist-mtime-before.txt`
- `24d1255-dist-mtime-after.txt`
