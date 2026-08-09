# P1 · Trial import census — what the four adapting harness files actually consume

**Phase**: P1 (`dispatch-plan.md`), task T1. **MEASUREMENT ONLY.**
**Derived at**: dd worktree `s002-sdk-build`, HEAD `7146803` · upstream read-only reference
`/Users/jordanknight/substrate/harness-engineering` (never written).
**Population**: the FOUR SURVIVING harness files — the ones that adapt rather than depart.
This is the trial population (`requirements.md` §4.1 header ruling, §5.1), **not** the
`src/plan/` re-implementation census that §4.1 measures. Those are different populations and
this document is the one Q-4's floor derives from.

> **R-1 boundary.** Every row below records WHAT IS REQUIRED — a symbol some existing file
> already imports, and whether today's `exports` map lets it through. No row argues for a
> subpath, a name, a promotion, or a wrapper. Where a symbol is unreachable this document says
> only *unreachable*, never *should be exported*. That judgement is Q-4/Q-5 and belongs to P2.

---

## Method — every verdict is derived, not asserted

**Consumer files read** (upstream, read-only):

```
harness/cli/src/acts/flow.ts            1762 lines
harness/cli/src/acts/plan/index.ts      1041 lines
harness/cli/src/acts/plan/pr-body.ts     257 lines
harness/cli/src/acts/plan/fence.ts       218 lines
```

**Import extraction**:

```bash
cd /Users/jordanknight/substrate/harness-engineering
grep -n "dd" harness/cli/src/acts/flow.ts harness/cli/src/acts/plan/{index,pr-body,fence}.ts \
  | grep -i "import\|from ['\"]"
```

**Reachability** was probed by RUNNING the imports through the package's own `exports` map
(Node self-reference from inside the package — the same technique
`test/consumer-surface.test.ts` uses, because a relative-path import would prove nothing about
what a consumer can write):

```bash
cd /Users/jordanknight/substrate/dd-worktrees/s002-sdk-build
npm ci && npm run build          # exports point at dist/, so the probe needs a build
node ./p1-probe.tmp.mjs          # await import(specifier) per row; temp file, removed after
```

Verdicts below are that probe's output verbatim: `REACHABLE`,
`UNREACHABLE · ERR_PACKAGE_PATH_NOT_EXPORTED` (the map **forbids** the subpath — §4.2), or
`RESOLVED` for the root.

---

## Row group A — reachable today (11 table rows, 12 runtime symbols)

Probed against the current map in `package.json`. Every one of these already resolves, so the
trial fixture can import it unchanged.

| Symbol | Kind | dd module (this repo) | Public subpath used | Verdict |
|---|---|---|---|---|
| `MemoizingDocLoader` | class | `src/links/loader.ts` | `@ai-substrate/dd/links` | REACHABLE |
| `resolveMapSeed` | fn | `src/links/map.ts` | `@ai-substrate/dd/links` | REACHABLE |
| `traverseCorpus` | fn | `src/links/traverse.ts` | `@ai-substrate/dd/links` | REACHABLE |
| `ConventionSchemaResolver` | class | `src/schema/resolve.ts` | `@ai-substrate/dd/schema` **and** `/schema/resolve` | REACHABLE via both |
| `parseAddress` | fn | `src/core/address.ts` | `@ai-substrate/dd/core/address` | REACHABLE |
| `isAddressFailure` | fn | `src/core/address.ts` | `@ai-substrate/dd/core/address` | REACHABLE |
| `parse` | fn | `src/core/parse.ts` | `@ai-substrate/dd/core/parse` | REACHABLE |
| `collectLinkCells` | fn | `src/core/validate.ts` | `@ai-substrate/dd/core/validate` | REACHABLE |
| `resolveAddressFile` | fn | `src/core/validate.ts` | `@ai-substrate/dd/core/validate` | REACHABLE |
| `validateWalk` | fn | `src/core/walk.ts` | `@ai-substrate/dd/core/walk` | REACHABLE |
| `escapeCell`, `headingSlug` | fn | `src/render/renderer.ts` | `@ai-substrate/dd/render/renderer` | REACHABLE |

**Type-only rows, also reachable** (resolution is the claim; the symbols carry no runtime
binding, so the probe asserts the subpath rather than the name):

| Type | dd module | Public subpath | Consumer |
|---|---|---|---|
| `DdDoc` | `src/core/model.ts` | `@ai-substrate/dd/core/model` | `plan/index.ts:21`, `fence.ts:1` |
| `DdIssue` | `src/core/validate.ts` | `@ai-substrate/dd/core/validate` | `plan/index.ts:24` |
| `SchemaIssue` | `src/schema/model.ts` | `@ai-substrate/dd/schema/model` | `plan/index.ts:38` |

## Row group B — consumed but NOT reachable (measured `ERR_PACKAGE_PATH_NOT_EXPORTED`)

These are the symbols the trial cannot import today. Two distinct causes, kept apart because
they are different measurements — one is "lives in the CLI half", the other is "deliberately
unlisted pending a ruling".

### B1 · Lives in `src/acts/` — the CLI half, no `./acts/*` subpath exists

| Symbol | Kind | dd module | Consumer site | Verdict |
|---|---|---|---|---|
| `FsDocLoader` | class | `src/acts/shared.ts:108` | `flow.ts:80`, `plan/index.ts:50` | UNREACHABLE · `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| `trackedPaths` | async fn | `src/acts/shared.ts:139` | `plan/index.ts:50` | UNREACHABLE · `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| `DD_ISSUE_CODES` | const | `src/acts/shared.ts:59` | `plan/index.ts:50` | UNREACHABLE · `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| `DdActDeps` | type | `src/acts/shared.ts` | `plan/index.ts:50` | UNREACHABLE · `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| `NodeSchemaFs` | class | `src/acts/schema-fs.ts:32` | `plan/index.ts:49` | UNREACHABLE · `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| `renderDocument` | fn | `src/acts/build.ts` | `plan/index.ts:48` | UNREACHABLE · `ERR_PACKAGE_PATH_NOT_EXPORTED` |

`FsDocLoader` is the fr-0010 symbol — the one koala predicted a re-implementation fixture would
never construct. **Measurement confirms it**: it appears in the trial population twice and in
`src/plan/`'s import graph zero times. It is the concrete proof that the §4.1 census measured
the wrong population.

**S-2 note (recording only, not deciding)**: `FsDocLoader`'s landing — subpath, name, form — is
P2's call per the §7a S-2 rider. This document records that it is consumed and unreachable; it
takes no position on where it should live.

### B2 · `src/plan/` — the map deliberately omits `./plan` (§4.2, OQ-2/R-2)

| Symbol | Kind | dd module | Consumer site |
|---|---|---|---|
| `buildPlanIndex` | fn | `src/plan/index-plan.ts` | `plan/index.ts:31` |
| `itemKey` | fn | `src/plan/index-plan.ts` | `plan/index.ts:32` |
| `readPlanCheck` | fn | `src/plan/check.ts` | `plan/index.ts:35` |
| `readPlanReadiness` | fn | `src/plan/ready.ts` | `plan/index.ts:36` |
| `PlanDocument` | type | `src/plan/index-plan.ts` | `plan/index.ts:33` |
| `ReadyReading` | type | `src/plan/ready.ts` | `plan/index.ts:34` |
| `PlanEdge`, `PlanIndex`, `PlanItem` | types | `src/plan/model.ts` | `pr-body.ts:1` |

**R-2 already rules on this population**: `plan/` does not ship; harness re-implements on
primitives. These rows are recorded so the trial fixture's shape is honest about what the
adapting files import TODAY — not as a request that they be exported.

### B3 · The root export — measured, and it is not a listing gap

```
*root*   @ai-substrate/dd   RESOLVED · keys=[]
```

Importing the package root **executed the dd CLI** during the probe: it printed the full
`dd [options] [command]` help block to stdout and yielded **zero named exports**. This
re-confirms §4.3 at HEAD `7146803` (the claim was true when written and is still true — the
kind of thing plan 001's lesson says to re-derive rather than inherit). Q-5 decides what the
root becomes; this row only records what it does.

## Row group C — harness-side symbols the fixture must supply itself

These appear in the construction shape but are **not dd exports and are not asked to be**.
Recorded because the §5.1 fixture has to stand something in their place, and that stand-in is
fixture-owned by design (the packet's "fixture-owned foreign fs port").

| Symbol | Owner today | dd's structural counterpart | Fixture obligation |
|---|---|---|---|
| `deps.fs` (`FsPort`) | harness `adapters/fs/fs-port.ts` | `SchemaFs` (`src/schema/model.ts:9`) — `readdir`/`exists`/`readText`; `FsDocLoader` needs only `Pick<FsPort,'readText'>` | fixture-owned stub, structurally satisfying both |
| `NodeHash` (`HashPort`) | harness `adapters/hash/node-hash.ts` | `src/adapters/hash/node-hash.ts` (unexported) | fixture-owned `sha256Hex` |
| `NodeExec` (`ExecPort`) | harness `adapters/exec/node-exec.ts` | `src/adapters/exec/node-exec.ts` (unexported) | only needed to feed `trackedPaths`; `null` avoids it |
| `toPosix`, `resolveInRepo`, `isWithin` | harness `services/shared/posix-path.ts` | `src/shared/posix-path.ts` (unexported) | harness keeps its own copy today |

The key measured fact: **`FsPort` satisfies dd's `SchemaFs` structurally** — `flow.ts:98-118`
says so in prose and the type shapes agree. So the foreign-port substitution the fixture needs
is already proven to work in production code, not a fixture-only trick.

---

## Construction shape — the exact expressions the §5.1 fixture must reproduce

Verbatim from the consumers. These are the shapes that are **already fixed** in the adapting
files, which is precisely why the trial is an adaptation test and not a re-implementation test.

### C1 · `flow.ts:118-129` — the nested loader, and the foreign port

```ts
function ddGateDeps(repoRoot: string, deps: FlowActDeps): DdGateDeps {
  const home = deps.env.home();
  return {
    schemaResolver: new ConventionSchemaResolver({
      fs: deps.fs,                                   // FOREIGN FsPort, structurally SchemaFs
      repoRoot,
      ...(home !== undefined && { home: toPosix(home) }),
    }),
    docLoader: new MemoizingDocLoader(new FsDocLoader(deps.fs, new NodeHash(), null)),
  };
}
```

Three measured properties the fixture must preserve:

1. **The nesting is `MemoizingDocLoader(FsDocLoader(...))`** — decorator over concrete, one
   expression. A fixture that constructs only `MemoizingDocLoader` proves nothing, because the
   inner one is the unreachable symbol.
2. **`fs` is the injected foreign port**, not a dd-built adapter — dd never constructs it.
3. **`tracked` is `null` deliberately** (documented at `flow.ts:114-117`), which is what lets
   this path avoid `trackedPaths`/`ExecPort` entirely.

### C2 · `plan/index.ts:141-147` — the same resolver, four roots including `home`

```ts
function planResolver(ctx: PlanContext): ConventionSchemaResolver {
  return new ConventionSchemaResolver({
    fs: ctx.fs,                                       // NodeSchemaFs here, FsPort in flow.ts
    repoRoot: ctx.repoRoot,
    ...(ctx.home !== undefined && { home: ctx.home }),
  });
}
```

Measured: the **same options object shape** is built from two different fs implementations
(`FsPort` in `flow.ts`, `NodeSchemaFs` in `plan/index.ts`). The `home` spread is conditional in
both — an `exactOptionalPropertyTypes`-shaped idiom the fixture must copy, not simplify.

### C3 · `plan/index.ts` — four `FsDocLoader` sites, two tracked-set modes

```ts
// :327  (loadPlanDocuments) — tracked null
const loader = new FsDocLoader(ctx.fs, new NodeHash(), null);

// :372, :796 — depth-conditional tracked set
const loader = new FsDocLoader(
  ctx.fs,
  new NodeHash(),
  depth === 0 ? null : await trackedPaths(new NodeExec(), ctx.repoRoot),
);

// :517 — always tracked
const loader = new FsDocLoader(
  ctx.fs,
  new NodeHash(),
  await trackedPaths(new NodeExec(), ctx.repoRoot),
);
```

Measured: `FsDocLoader`'s third argument is `ReadonlySet<string> | null`
(`src/acts/shared.ts:108-113`), and `trackedPaths(exec, repoRoot)` is **async** returning
`Promise<ReadonlySet<string> | null>` (`:139-142`). Any fixture reproducing the `:517` shape is
therefore an `async` call site and needs an `ExecPort`-shaped stand-in.

### C4 · The consumed seam objects

```ts
// flow.ts  — the gate's deps
{ schemaResolver: ConventionSchemaResolver, docLoader: MemoizingDocLoader }

// plan/index.ts:526, :805 — readPlanCheck's deps
{ schemaResolver: planResolver(ctx), docLoader: loader }
```

Measured: both consumers assemble the **same two-field seam** — a `SchemaResolver` and a
`DocLoader`. `src/links/index.ts` already re-exports both TYPES by name
(`export type { SchemaResolver } from '../core/validate.js'`,
`export type { DocLoader } from '../core/walk.js'`) with a comment saying it exists so an
external consumer can name them without reaching into a module path. So the seam's **types**
are reachable today while one of its two **implementations** is not.

---

## Tally (counts only — no recommendation attached)

| Population | Count |
|---|---|
| Distinct dd symbols consumed by the four files | **30** |
| Reachable today | **15** (12 runtime + 3 type-only) |
| Unreachable — `src/acts/` half (B1) | **6** |
| Unreachable — `src/plan/` (B2, R-2 already ruled) | **9** |
| Root export named symbols | **0** (executes the CLI) |
| Fixture-owned foreign stand-ins required (C) | **4 port shapes** |

**The floor, stated as measurement**: excluding the B2 rows that R-2 has already ruled out of
the public surface, the trial's import list needs **6 symbols that no public subpath reaches
today** — `FsDocLoader`, `trackedPaths`, `DD_ISSUE_CODES`, `DdActDeps`, `NodeSchemaFs`,
`renderDocument`. That is the floor Q-4 starts from. **What is offered — width, subpath names,
whether any of these is promoted, wrapped, re-shaped or refused — is P2's decision and is not
touched here.**
