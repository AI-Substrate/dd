# Execution log — Phase 2: CLI acts + plumbing parity

**Plan**: `docs/plans/001-dd-extraction/plan.dd.json` · **Phase**: `ph-8bda`
**Upstream basis**: `d08f4942d28b7e5181d5845a56a63b0cbb1d3402` (READ-ONLY, unchanged from phase 1)

---

## tk-0001 — Plumbing parity

**Ported** (verbatim, zero path adjustments — `output/` and `adapters/<family>/` sit at
identical depths in both repos, so the phase-1 depth problem does not recur here):

| target | files |
| --- | --- |
| `src/output/style.ts` | 1 |
| `src/adapters/env/` | `env-port`, `node-env`, `fake-env` |
| `src/adapters/exec/` | `exec-port`, `node-exec`, `fake-exec`, `windows-command` |
| `src/adapters/fs/` | `fs-port`, `node-fs`, `fake-fs` |
| `src/adapters/hash/` | `hash-port`, `node-hash`, `fake-hash` |
| `src/adapters/process/` | `process-port`, `node-process`, `fake-process` |
| `src/adapters/loader/` | `module-loader-port`, `jiti-loader`, `fake-loader` |
| `src/adapters/clock/` | `clock-port`, `system-clock`, `fake-clock` (parity — see below) |

**Import audit before copying**: every specifier across the set resolves to a node
builtin, a sibling inside its own adapter family, `../clock/clock-port.js`, `commander`,
or `jiti`. No cross-tree reach, so the copy is byte-verbatim.

### Two scope calls made here

**1. `exec/background-*` excluded (3 files).** A `cp adapters/exec/*.ts` pulls
`background-port`, `node-background`, `fake-background`. Grep across `src/acts/dd/` and
`src/services/dd/` upstream returns **zero** references — they serve `acts/verb.ts` and
the extensions service, neither of which is dd. Copying them would import dead weight and
overstate the port's surface, so they were removed.

**2. The clock family was brought to upstream parity — this was forced, not chosen.**
Phase 1 hand-wrote a minimal `Clock { nowIso() }` stub as a placeholder. Upstream's real
`Clock` also carries `sleep(ms, signal?)`, and the verbatim `fake-exec.ts` calls
`this.clock?.sleep(...)` — so `tsc` failed with TS2339 on the narrower stub.

Two ways out, and only one is legal: editing `fake-exec.ts` to drop the sleep calls is a
behaviour change to ported code (forbidden). Widening the port to upstream's is exactly
what "plumbing parity" names. Ported `clock-port.ts` + `system-clock.ts` verbatim and
added `fake-clock.ts`, which the phase-2 corpus needs anyway — 8 of the ph2 test files
use `FakeClock`.

Consequence: two phase-1 tests built bare `{ nowIso }` object literals and no longer
satisfy the widened interface. Both now use the ported `FakeClock`, which is upstream's
own stated convention ("fakes over mocks — assert on `calls`"). No assertion changed.

### Adapter families the dd acts do NOT need

The ph2 act tests reference `FakeGit` (6 files) and `FakeWatcher` (1), which suggests the
git/watcher families might be in scope. They are not: those tests assemble upstream's
wide `VerbActDeps` container, which carries every harness adapter regardless of what the
verb under test uses. dd's own production path reaches git **through `ExecPort`**
(`trackedPaths()` runs `git ls-files -z` via `exec.run`), never through a `GitPort`. The
six named families plus clock are the complete production need; the fake-container width
is a test-adaptation problem and is handled in tk-0007.

### Evidence (dw-0001)

| assertion | instrument | result |
| --- | --- | --- |
| style.ts + six adapter families present | `ls` | ✅ all present |
| tsc clean | `npm run build` | ✅ exit 0 |
| `dependencies` == `{commander, jiti}` exactly | node over package.json | ✅ `EXACT: true` |
| no other runtime dep | `npm ls --omit=dev --depth=0` | ✅ only `commander@15.0.0`, `jiti@2.7.0` |
| lane still green | `vitest run` | ✅ 32 files / 352 tests |

`jiti` is pinned **exact at `2.7.0`**, matching upstream (not a caret range). It is
installed here but is not PROVEN until tk-0004's custom-type load test.

**Ledger honesty**: this commit registers no verb, so `dd status` stays `unconfigured` /
exit 2 / `ported[0]` — unchanged and truthful.

---

## tk-0002 — Acts infrastructure + slice 1 (validate, schema, docs)

**Ported**: `acts/dd/{shared,schema-fs,validate,schema,docs}.ts` → `src/acts/`.

### Layout: acts flatten, matching phase 1

Upstream keeps dd acts at `src/acts/dd/**` because they nest under a `harness dd`
sub-command. Phase 1 already established this repo's flattening — `services/dd/core` became
`src/core` — because everything here IS dd. Acts follow the same rule: `acts/dd/validate.ts`
→ `src/acts/validate.ts`, sitting beside the existing `acts/status.ts` and `acts/version.ts`.
The alternative (an `acts/dd/` island next to `acts/status.ts`) would have split the verbs of
one binary across two directories for no gain.

Path rewrite is mechanical and total — four rules, zero hand-edits:

| from | to |
| --- | --- |
| `../../output/` | `../output/` |
| `../../adapters/` | `../adapters/` |
| `../../services/dd/` | `../` |
| `../../services/shared/` | `../shared/` |

`grep "'\.\./\.\./"` over `src/acts/*.ts` returns nothing, so no rewrite was missed.

### Registration: top level, not a sub-command

Upstream's `acts/dd/index.ts` exists only to create the `dd` sub-command and hang the verbs
off it. Here the binary IS `dd`, so that file is **not ported**; each registrar is called with
`program` directly in `src/app.ts`. The registrar signatures take a `Command`, so they are
used unchanged. This is also what makes the ledger work: `buildStatusEnvelope` reads
`program.commands`, so a verb is "ported" precisely when it is registered.

### `shared.ts` — the one real collision

`src/acts/shared.ts` already existed (phase 1, defining `ActDeps { clock }`). Upstream's
`acts/dd/shared.ts` defines `DdActDeps { clock }` — the same interface under another name —
plus `DD_ISSUE_CODES`, `FsDocLoader`, `trackedPaths` and `createLinkContext`. Merged into one
module: `ActDeps` stays the declared name, and `DdActDeps` is exported as an alias of it. That
is what lets every ported act body stay byte-verbatim while `status`/`version`/`app` keep
compiling untouched.

`exitDdStub` + `DdOwningPhase` were **not** ported: they are upstream's own phased-rollout
stub mechanism and have **zero callers** upstream (verified by grep). Their removal is
self-proving — the only imports biome then flagged as unused were `formatUnconfigured` and
`exitWithEnvelope`, precisely the two that function used.

### Two plumbing gaps the acts exposed (both phase-1 stubs, same shape as the Clock)

**1. `error-codes.ts` carried 3 codes; dd needs 63.** The acts reference 45 codes, but the
ported `test/services/dd/error-codes.test.ts` (ph2) freezes **E400–E449 as exactly 50 codes in
a fixed order** — so the used-only subset would fail the freeze. Ported the entire dd
allocation verbatim, **E400–E462** (63 codes, comments included), plus `INVALID_ARGS: 'E108'`
which the act bodies use. Porting the full block rather than the used subset keeps the code
space enumerable and stops a future code from colliding with a skipped allocation.

`E108` (INVALID_ARGS, raised inside a verb body) and `E002` (INVALID_USAGE, raised by
commander's parser) now coexist — exactly as they do upstream.

**2. `exit.ts` lacked `emitRawAndExit`**, which `dd docs get` uses to stream raw markdown.
Ported verbatim. It sets `process.exitCode` and returns rather than calling `process.exit`
(so a large piped payload is not truncated by a flush race), which keeps the repo's
"`exitWithEnvelope` is the one place `process.exit` is called" contract exactly true.
Upstream's `setBannerDecorator`/`BannerDecorator` is harness update-banner machinery with no
dd caller and was not ported.

### Verbs proven working IN THIS COMMIT (ledger honesty)

Driven against real documents, not stubs:

| command | result |
| --- | --- |
| `dd validate <this phase's tasks.dd.json>` | `ok`, exit 0, 0 errors / 0 warns |
| `dd schema list` | `ok`, exit 0, real roots + resolved schemas |
| `dd docs list` | `ok`, exit 0, both baked entries |
| `dd docs get dd-overview` | `ok`, exit 0, full baked markdown |
| `dd status` | `unconfigured`, exit 2, `ported[validate,schema,docs]` |

### Evidence (dw-0002)

New `test/acts/envelope-contract.test.ts` — one table over every ported verb, driven through
the **shipped bin** (the exit code is half the contract, and only a real process has one).
Each row asserts envelope shape, the status→exit map, `next_action` required on non-ok, and
the error code where applicable. Live-confirmed codes this slice: **E400** (missing document),
**E108** (non-integer `--depth`), **E410** (unknown schema), **E419** (unknown docs entry).
New helper `test/support/run-cli.ts` is shared by the later slices.

`just checks` inputs all green: build ✅ · typecheck ✅ · biome ✅ · **378 tests / 33 files**.
The table grows with slices 2 and 3 rather than being rewritten.
