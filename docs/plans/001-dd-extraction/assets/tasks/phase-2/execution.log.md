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

---

## tk-0003 — Slice 2 (address, link, links, graph)

Same four mechanical rewrite rules as slice 1; `grep "'\.\./\.\./"` over `src/acts/*.ts`
is empty. Registered on `program` in `src/app.ts`, one slice, one commit.

### DISCOVERY — a cross-slice dependency in o-prime's slicing (`link` → `build`)

`src/acts/link.ts` imports `writeDocumentWithSibling` from `./build.js` — because
`dd link verify-basis --update` regenerates the sibling markdown. But `build` is
**slice 3** (tk-0004). Slice 2 therefore cannot compile without a slice-3 module.

Resolved WITHOUT touching the ledger's honesty, and without re-cutting o-prime's slices:

- `src/acts/build.ts` is **ported in this commit** (the module), because `link` genuinely
  cannot work without it.
- the `build` **verb is NOT registered** here. Registration is the only thing
  `buildStatusEnvelope` reads, so the ledger is unmoved by a module's mere existence.

Verified rather than asserted — with `build.ts` present and compiling, `dd status` reports
`ported[validate,schema,docs,address,link,links,graph]` and `remaining[build,doctor,write]`,
exit 2. The ledger claims exactly the seven verbs that answer, and `build` stays unclaimed
until it is registered and proven in tk-0004.

This is a genuine finding about the slice boundaries, not a scope change: dw-0003 asks for
address/link/links/graph registered, and that is exactly what landed. **Reported to the PM.**

### A third phase-1 plumbing stub: `CliIo.useColor`

`graph.ts` reads `io.useColor` for its human-mode map palette; the phase-1 `CliIo` had only
`{mode, writers}`. Added the optional `useColor` field (upstream's own shape) and wired it in
`main()` through the **already-ported** `resolveUseColor` from `output/style.ts` — which is
what style.ts was ported for in tk-0001. Resolved ONCE by the entrypoint (human + TTY, minus
`NO_COLOR`/`FORCE_COLOR`), never re-derived by an act. Optional, so existing test call sites
that omit it still get plain text.

That is the third phase-1 stub the port has widened to parity (after `Clock` and
`ErrorCodes`). The pattern is consistent: phase 1 stubbed the seam, phase 2 lands the real
contract behind it.

### Verbs proven working IN THIS COMMIT

| command | result |
| --- | --- |
| `dd address generate tasks/tk-0001 --path <doc>` | `ok`, qualified address emitted |
| `dd address validate <addr>` | `ok`, parsed + classified |
| `dd link resolve <doc>#tasks/tk-0001` | `ok`, resolved to its instance target |
| `dd link resolve no/such.dd.json#…` | `error` **E430**, exit 1 |
| `dd links <doc>` | `ok`, outbound + inbound |
| `dd graph` | `ok`, real mermaid graph of THIS repo |

### Evidence (dw-0003)

Envelope table extended to 13 cases; **47 assertions** in that file, **399** repo-wide.

Two new mechanical ledger guards land with this slice (ac-0003):

1. **every verb `dd status` calls ported is exercised by the table** — so registering a verb
   without proving it fails in the same commit, which is precisely the per-commit honesty
   clause. Future slices cannot register quietly.
2. **every ported verb answers `--help` with exit 0 on the shipped bin** — registration is
   proven against the real process, not the in-memory program object.

---

## tk-0004 — Slice 3 (build, write, doctor) — **the ledger flips green**

`write.ts` and `doctor.ts` ported with the same four rules; `build.ts` was already ported in
slice 2 (for `link`) and is **registered here**, which is the commit where it is proven.

### DISCOVERY — the writer family is four commands, not a verb called `write`

`acts/dd/write.ts` registers `get`, `set`, `add` and `rm`. It registers **nothing named
`write`**. `PLANNED_VERBS` (phase 1) lists `write` as one of the ten, and the old ledger
matched a verb by `registered.includes(verb)` — so `write` could never be satisfied and
`dd status` could never reach `ported[10]`, no matter how complete the port was.

The plan requires ten entries and `ported[10]` (ac-0003, dw-0004), so the list is unchanged.
What changed is how a verb is PROVEN: a new `PROVING_COMMANDS` map says which command names
demonstrate each verb. Nine map to their own name; `write` maps to **all four** writer
commands. A partially-registered family stays unported, which is the honest answer — and
`test/status.test.ts` now pins exactly that (drop `rm`, and `remaining` is `['write']`).

This was a latent defect in phase-1's ledger, surfaced by the first verb whose family name is
not a command name. **Reported to the PM.**

### The flip, and what it invalidated

`dd status` → `ok`, **exit 0**, `ported[10]`, `remaining[]`, in the commit that registers the
last verb.

That flip **broke two phase-1 smoke tests** — both asserted `dd status` answers `unconfigured`
with exit 2. They were correct while the port was in flight and are false the moment it lands,
which is the ledger doing its job rather than a regression. Both were rewritten against the
post-port reality: the human renderer case now expects `status: ok` / exit 0, and the second
asserts the complete port (`remaining: []`, `ported` length 10, no `next_action`). Because
`data.ported` is derived from the registered commands, losing a registration flips both back
automatically.

### Verbs proven working IN THIS COMMIT

| command | result |
| --- | --- |
| `dd build <doc> --check` | `ok`, exit 0, no drift |
| `dd build /etc/hosts` | `error` **E429**, outside the repository root |
| `dd doctor` | `ok`, exit 0 — **99 discovered, 6 swept, 0 findings** on this repo |
| `dd get <doc>#tasks/tk-0001/state` | `ok`, exit 0 |
| `dd get <doc>#tasks/tk-9999/state` | `error` **E450** |

### Evidence (dw-0004) — jiti PROVEN, not merely installed

`jiti` landed in tk-0001 as a dependency; nothing proved it until now. It is a runtime dep for
exactly one reason: a schema registers a custom render type by **presence** of a TypeScript
file at `<schema folder>/adapters/<type>.ts`, and the shipped CLI must load and execute that
untranspiled module.

`test/acts/jiti-custom-type.test.ts` builds a throwaway repo whose adapter is real TypeScript
(annotated params, an `interface`, `export default`) that this package's build never compiles,
then drives the **shipped bin** and asserts the rendered markdown contains `**43h 30m**` —
output only that adapter can produce from `2610`.

**Mutation-proven non-vacuous**: a second case builds the same document with the adapter file
absent and asserts the cell renders `2610` verbatim. Without it, the first assertion could
pass for the wrong reason.

Two fixture facts worth keeping (both cost a red run):

1. Schema resolution requires the `schemas/` level — `<root>/schemas/<pkg>/<schema>/schema.json`.
   The last two segments ARE the qualified name; omitting `schemas/` resolves nothing.
2. **macOS temp-path trap** — `mkdtemp` returns `/var/…`, `process.cwd()` reports the resolved
   `/private/var/…`, so an ABSOLUTE temp path is judged outside the repository root and the
   build refuses with **E429**. Temp-repo CLI tests must address documents RELATIVE to `cwd`
   (which is how a user invokes them anyway). Captured via `harness observe` (DL-007).

Envelope table now covers **all ten verbs** — 64 assertions in that file, **419** repo-wide.

---

## tk-0005 — Postfix `--json`

**The repro, before**: `dd status --json` → `error: unknown option '--json'`, **E002**, exit 1.
`dd --json status` → fine.

**Root cause**: `--json` is declared on the *program*, and `enablePositionalOptions()` hands
every option written after the verb to the verb — which never declared it. Nothing was wrong
with mode selection: `jsonFlag()` reads the RAW argv, so it already saw the flag wherever it
sat. The only thing missing was commander's permission to write it there.

**Fix**: one recursive pass, `acceptOutputFlagsEverywhere(program)`, declaring `--json` /
`--no-json` as accepted no-ops on every command at every depth (skipping any command that
already declares them). Called once in `buildProgram`, so **no ported act is edited** and any
verb added later inherits the behaviour for free.

| invocation | before | after |
| --- | --- | --- |
| `dd status --json` | E002, exit 1 | `ok`, exit 0 |
| `dd --json status` | `ok`, exit 0 | unchanged |
| `dd schema list --json` (nested) | E002 | `ok`, exit 0 |
| `dd link resolve <addr> --json` (nested) | E002 | `ok`, exit 0 |
| `dd status --no-json` | E002 | human `status: ok` |
| `dd get <missing part> --json` | E002 | `error`, exit **1** preserved |

### Evidence (dw-0005)

`test/acts/postfix-json.test.ts` — **16 assertions**, bound to **ac-0005 only** (the envelope
contract is ac-0004's file; the coverage map is not re-crossed).

The claim is *sameness*, so each of the 12 ported-verb invocations runs **twice** — postfix and
prefix — and compares the whole envelope (timestamp excluded, as it legitimately differs) plus
the exit code. It re-proves nothing about the verbs themselves.

Three guards beyond the table: the plan's exact E002 repro now exits per status; postfix
`--no-json` still selects the human renderer (and the output is NOT parseable JSON); and a
final case asserts **every verb the ledger reports as ported is covered here**, so a future
verb cannot quietly skip the postfix contract.

**AGENTS.md corrected in this same commit.** The `dd status --json` example was already the
right thing to write — the CLI was what was wrong — so the correction is the surrounding
prose, which claimed "the **scaffold**, not the port … No dd logic has moved yet". That is
false as of phases 1–2: the SDK and all ten verbs are here. It now states what is present,
what remains (package/release readiness, self-hosting), that the ledger reads `ok`/`ported[10]`
and flips back on its own if a registration is lost, and that either flag may be written
before or after the verb at any depth.

---

## tk-0006 — Docs pipeline (the phase-1 gap, closed)

This is the scope gap **escalated from phase 1** and ruled into this phase by o-prime. Until
now, editing `src/docs/content/*.md` changed nothing the CLI ships: `docs-content.ts` inlines
the markdown at build time, and no generator or gate had been ported — so the prose an agent
reads via `dd docs get` could silently diverge from the prose in the repo.

**Ported**: `scripts/gen-dd-docs.mjs` + `scripts/check-dd-docs.mjs`. Zero dependencies, pure
Node. Only the two paths changed (manifest and output now at `src/docs/`), plus the
`harness dd docs` → `dd docs` wording in their own header comments.

**Wired**: `npm run gen:dd-docs` / `npm run check:dd-docs`, and `just gen-docs` /
`just check-docs`. `check-docs` is **inside `just checks`**, between typecheck and test — the
gate is worthless if it is not on the lane CI runs.

### The gate found a real defect on its very first run

Before any deliberate test, `check:dd-docs` reported **drift** against the committed module:

```
- // Source of truth: harness/cli/src/services/dd/docs/dd-docs-manifest.json + the .md files it names.
+ // Source of truth: src/docs/dd-docs-manifest.json + the .md files it names.
```

Phase 1 copied `docs-content.ts` verbatim, so its `@generated` header still pointed at the
UPSTREAM manifest path — a file that does not exist in this repo. Cosmetic in effect, but it
is exactly the class of staleness the gate exists to catch, and it was caught the first time
the gate was ever run here. The baked *content* was unchanged; only the header line moved.

### Evidence (dw-0006) — red proven, then reverted

| step | command | result |
| --- | --- | --- |
| baseline | `npm run check:dd-docs` | `OK — no drift`, exit 0 |
| **RED** | append a scratch paragraph to `src/docs/content/dd-overview.md`, re-run | **`FAIL — baked dd docs drifted from their sources`, exit 1** |
| revert | restore the file, re-run | detects the now-stale baked module, exit 1 |
| settle | re-run | `OK — no drift`, exit 0 |

The middle step is worth keeping: after reverting the source, the gate still failed once,
because the RED run had already written the scratch paragraph INTO `docs-content.ts`. That is
the gate being symmetric — it fails on a stale baked module just as it fails on an unbaked
source edit — not a flake. `git diff` confirms the source file is byte-identical to committed.

**Ported test**: `test/services/dd/docs/dd-docs-drift.test.ts` (4 tests, green). It stages a
hermetic copy of the tree in a temp dir and runs the REAL generator, so it proves the shipped
script rather than a re-description of it, and never perturbs the working repository. It
asserts drift is detected from BOTH directions — an edited source, and a hand-edited baked
module — plus a clean run against the real repository. Only two constants changed
(`REPO_ROOT` depth 6→4, `DOCS_DIR` → `src/docs`).
