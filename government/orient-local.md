# Orient — local (lever 2)
**Scope**: THIS REPO (`AI-Substrate/dd`) · generated fresh 2026-08-07 · o-prime single writer
**Writer**: `pij-mental-dajeil` (o-prime) · **Governance surface**: store-native (`pij project` / `pij spine`) — this repo has no prose spine by design.

## What this project is

**dd — deterministic documents**: the tooling that validates, renders, addresses and
inspects structured documents, published as `@ai-substrate/dd` with a `dd` bin.

> ⚠️ **NOT YET HUMAN-CONFIRMED.** Derived from `AGENTS.md` + `package.json`, not from a
> PRD (there is no PRD or README in this repo). The o-prime does not invent product
> pillars — this line is provisional until Jordan confirms it.

**The repo's actual state: scaffold, not port.** dd ships today *inside*
`AI-Substrate/harness-engineering` as the `harness dd …` verb family
(`harness/cli/src/acts/dd` + `harness/cli/src/services/dd`). What exists here is the
package, the build/test lane, CI, release plumbing, and a stub CLI wired to the envelope
contract. **Zero dd logic has moved.** Measured: `dd status` reports `ported: []`,
`remaining: 10`, exit 2.

## Mandatory orient reads

- `AGENTS.md` — repository rules, the envelope contract, harness route (**read first**)
- `src/output/envelope.ts` — the one seam every ported verb goes through
- `src/app.ts` — the program/verb registry (the convergence hot spot; see Batons)
- `justfile` — the real command surface; `harness boot`/`checks` wrap these
- Upstream source of the port: `AI-Substrate/harness-engineering` → `harness/cli/src/acts/dd`, `harness/cli/src/services/dd`

## What matters here

- **The envelope contract is the product's determinism guarantee.** One envelope per
  command: `{command, status, data, error?, next_action?, timestamp}`; `status ∈ ok |
  degraded | unconfigured | error`; exit **0** ok/degraded · **2** unconfigured · **1**
  error; `next_action` REQUIRED on any non-ok status. `process.exit` is called in exactly
  one place — `exitWithEnvelope`.
- **Never fake success.** `unconfigured` means "nothing is mapped here yet", never "it
  worked". This is the repo's green-but-wrong defence and it is enforced in code, not prose.
- **`dd status` is the self-updating port ledger.** It diffs registered verbs against the
  ten planned and exits 2 until none remain — so this CLI cannot claim to be finished while
  the port is in flight. **Any stream porting a verb inherits a moving honesty gate.**
- Conventional commits are load-bearing: release-please reads them to cut versions and the
  CHANGELOG.

## Harness surface

| Need | Command | Evidence |
|---|---|---|
| Discover | `harness instructions` · `harness doctor --json` | 2 extensions loaded (`boot`, `checks`) |
| Boot / cheap proof | `harness boot` (wraps `just boot`) | build + `test/smoke.test.ts` spawns the compiled bin |
| Full proof | `harness checks` (wraps `just checks`) | lint → build → typecheck → test+coverage |
| Capture friction | `harness observe "<what>" --kind difficulty --severity <sev>` | observe buffer |
| Drain | `harness observe --list --json` → `harness record retro` → `harness observe --clear` | `.harness/records/` |
| Encode | new `.harness/extensions/<verb>/` or a `justfile` recipe | committed substrate |

**Known harness state (verified 2026-08-07)**: `harness doctor` = **degraded** on exactly
one layer — `telemetry-flush-hook` (no `post-commit` hook installed). AGENTS.md records
this as deliberate. Every other layer is green. **A stream must not "fix" this without a
ruling** — treat `degraded` here as the expected baseline, not a defect.

## Repo mechanics — derived, not copied

| Question | This repo's answer |
|---|---|
| Cheap quality gate | `harness boot` → `just boot` (build + spawned-bin smoke) |
| Full pre-ship gate | `harness checks` → `just checks` (lint · build · typecheck · test) — same lane CI runs |
| Notify-only worktree actions | ordinary isolated reads/edits/`just` gates/commits/sole-owner branch push |
| Non-hermetic commands (write outside the worktree) | `npm ci` (global cache) · `harness skills install` (writes `.claude/skills/`, `.agents/`, `/skills-lock.json`) · `harness telemetry sync` (**pushes** `refs/harness-telemetry/*`) · `git push` · anything touching `~/.pij` |
| Batons — what breaks under two concurrent users or converging histories? | **(1) `src/app.ts` verb registry** — all 10 ported verbs register in one file; two streams porting verbs converge here every time. **(2) `main`** — convergence/merge. **(3) npm publish + release-please** — one release train, `.release-please-manifest.json` + `package.json` version. **(4) `refs/harness-telemetry/*`** — a real remote ref. **Free probe**: worktree-local `just lint/build/typecheck/test` and reads of `dist/` — grant-free, notify-only. |
| Never-stage list | `dist/` · `coverage/` · `node_modules/` · `.harness/temp/` · `.harness/skills.lock.json` · `/skills-lock.json` · `.claude/skills/` · `.agents/` (all already ignored — installed skills are DERIVED artifacts of the published package, never source) |
| Flow-state rule | `.the-flow-state.json`, `the-flow.json`, `the-flow.md` — **builder guided mode is the sole writer**. None exist here yet; the first `/builder` run creates them. No agent writes them by hand. |
| Worktree root | `/Users/jordanknight/substrate/dd-worktrees/` (sibling of the repo — keeps trees out of the package and off every ignore rule) |
| Worktree naming | `dd-worktrees/s<ord>-<slug>` · branch `s<ord>/<slug>` |
| Base branch | `main` — remote `https://github.com/AI-Substrate/dd.git`. Resolve the SHA at allocation: `git rev-parse main` (at bootstrap: `489b7aab`) |
| Landing policy | `/builder 8 ship` → PR → CI (`.github/workflows/ci.yml`: lint, build, typecheck, test on push+PR) → confirmed merge. `release.yml` + release-please cut the version from conventional commits. |
| Shared-tree fallback | o-prime rules it explicitly, per-occasion, under a baton. **Not the construction default** — one worktree + branch per stream is. |
| Fleet defaults | copilot `gpt-5.6-sol` coders · cross-model reviewer (`claude-opus-5` or `gpt-5.6-terra`) · ceremony/PA tier `gemini-3.6-flash` |
| Human digest channel | Jordan, in-pane, self-identified as `pij-mental-dajeil (o-prime, dd)`; plus the durable status card (`pij report now`) |
| Ceremony tier | `gemini-3.6-flash` copilot peer for add/commit/push |

## Current portfolio context

- **Governance is store-native**: portfolio lives in `pij project` + `pij spine`, not in a
  `prime-flow.json`. Read it with `pij project list` / `pij spine events --project <slug>`.
- **No portfolio items yet.** The o-prime does not invent work; items enter only when
  Jordan names them. The obvious candidate — *port the ten `dd` verbs out of
  harness-engineering* — is **proposed, not accepted**.
- **Open finding (recorded at bootstrap, not yet routed to a stream)**: `AGENTS.md`
  documents `dd status --json`, but `--json` is a **program-level** option in `src/app.ts`,
  so it must precede the subcommand. Measured: `dd status --json` → exit **1** (`E002
  unknown option '--json'`); `dd --json status` → exit **2** (correct). The documented
  invocation is the one that fails.
- **Sequencing watch**: the verb registry in `src/app.ts` is the single convergence point
  for all ten verbs. Parallel porting streams will collide there and nowhere else — plan
  the merge order before allocating a second stream.

## Authoring checklist

- [ ] Product one-liner and pillars confirmed by human — **OPEN, no PRD exists**
- [x] Mandatory non-auto-loaded reads named
- [x] Commands mechanically discovered (`harness doctor --json`, `justfile`, `dd --help`), not guessed
- [x] Notify-only worktree actions explicit; fences are not grants; batons cover only proven shared resources and convergence, with a "free" probe
- [x] Non-hermetic commands named — derived from what they write, not from their names
- [x] Never-stage and flow-writer rules explicit
- [x] Worktree root/naming/base and landing policy mechanically derived
- [x] Shared-tree fallback explicit, not the default
- [ ] Portfolio section reflects the live store — **empty by design until Jordan names work**
- [x] Portable lessons proposed upstream rather than copied in
