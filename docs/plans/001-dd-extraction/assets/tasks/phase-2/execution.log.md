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
