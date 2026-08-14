# AGENTS.md — dd

## Government lives at `.harness/government/`

This repo is governed by an o-prime whose durable state — doctrine
(`orient-local.md`), standing constraints, rulings, briefs — lives in
**`.harness/government/`** (moved from the repo root `government/` on
2026-08-12, Jordan's instruction). `orient-local.md` there is the mandatory
first read for any new seat. Fleet operating doctrine (how PMs run workers)
is `.harness/government/how-fleets-work.md`.

## npm resolves through a corporate supply-chain proxy — do not route around it

Every dependency in `package-lock.json` resolves through
**`packagefeedproxy.microsoft.io`** — measured 2026-08-14: **166 of 166 resolved entries,
zero from the public registry.** This is a **corporate supply-chain control on a managed
system**, not a mirror chosen for speed. Packages are screened before they become visible
here, which is why the feed lags `registry.npmjs.org` by up to about a week.

**NEVER pass `--registry=https://registry.npmjs.org`, never edit a `resolved` URL to point
at the public registry, and never suggest either as a way to unblock a build.** Doing so
fetches a package that has not been screened and puts the first unproxied entry into a
lockfile that is otherwise uniformly proxied. If a fix is only reachable publicly, the
correct action is to **wait for the feed to screen it, or ask Jordan** — the wait is the
control working, not a tool being slow.

**The consequence agents keep re-discovering, so it is written down once here**: a local
`npm audit` on this machine is **systematically more optimistic than CI's**, because CI
resolves against the public registry and this machine cannot see what CI sees. A green
local audit is evidence about the *screened* dependency set only. When `scripts/audit-gate.mjs`
disagrees between local and CI, **CI is the one telling the truth about the wider world**
and local is telling the truth about what is installable here. Both are right; they are
answering different questions.

*Live instance, 2026-08-14*: CI blocked on `nanoid` with a fix available; `nanoid@3.3.18`
exists publicly, the proxy's latest 3.x is `3.3.17`, and the proxy returns **E404 for
3.3.18 even when asked directly** — so the fix was genuinely unreachable from here. This
is also the standing gap in the audit gate, now with a real instance: the gate cannot
distinguish *"a fix exists somewhere"* from *"a fix is reachable by us"*, and on a proxied
machine those differ by the screening window, by design.

## What this repo is

This is the standalone home of **dd** (deterministic documents) — the tooling that
validates, renders, addresses, and inspects structured documents, published as
`@ai-substrate/dd` with a `dd` bin.

**A port out of `AI-Substrate/harness-engineering` is in progress.** dd still ships
inside that repo as the `harness dd …` verb family
(`harness/cli/src/acts/dd` + `harness/cli/src/services/dd`), which remains the
upstream basis. What lives here today is **the SDK and the CLI**: `src/{core,docs,
links,mutate,plan,render,schema}` is the ported library, `src/acts` holds the ten
verbs on the envelope seam, and `src/{output,adapters}` is the plumbing. Still
ahead: package/release readiness (the exports freeze and the tarball gate) and
self-hosting this repo's own document work on the local bin.

Run `dd status --json` for the honest, self-updating port ledger — it diffs the
verbs registered on the program against the ten planned. It reported
`unconfigured` (exit 2) while verbs were missing and now reports `ok` (exit 0)
with `ported[10]`; because the list is DERIVED from the registered commands, it
flips back on its own if a registration is ever lost. This CLI cannot claim to be
finished while the port is still in flight.

### The contract every command honours

One envelope per command:
`{command, status, data, error?, next_action?, timestamp}`.

- `status` is one of `ok` | `degraded` | `unconfigured` | `error`.
- Exit codes: **0** = ok/degraded · **2** = unconfigured · **1** = error.
- `next_action` is REQUIRED on any non-ok status — the constructors enforce it.
- `--json` / `--no-json` beat `DD_JSON=1`, which beats TTY detection; piped output
  auto-selects JSON. Either flag may be written **before or after** the verb —
  `dd status --json` and `dd --json status` are equivalent, at any subcommand
  depth.
- **Never fake success.** `unconfigured` means "nothing is mapped here yet", not
  "it worked". A ported verb that cannot do its job says so.

When you port a verb, keep it behind this seam: build the envelope with the
constructors in `src/output/envelope.ts` and exit through
`exitWithEnvelope` — that is the one place `process.exit` is called.

### Working on it

```bash
npm ci          # or: just install
just boot       # fast "does it run": build + the spawned-bin smoke test
just checks     # the full gate: lint + build + typecheck + test (what CI runs)
just fix        # apply biome's safe fixes
```

Commits are **conventional commits** — release-please reads them to cut versions
and the CHANGELOG.

## Engineering harness

This repo has an engineering harness. At session start:

1. `harness --version` — ensure the global CLI is installed
   (`npm i -g @ai-substrate/engineering-harness` if missing)
2. `harness instructions` — the agent briefing (AGENTS START HERE)
3. `harness doctor --json` — what's configured + which extensions loaded
4. `harness boot --json` — prove the product runs before changing it
5. `harness checks --json` — the quality gate, before you call work done

Read a verb's briefing before using it: `harness instructions boot`.

If the eng-harness skills are loaded in your CLI, `/eng-harness-flow` routes you
to the right next harness action at any point. They are **not committed** (they
are derived copies of the published package); install them project-local with:

```bash
harness skills install --target github-copilot --target claude-code
```

Capture friction the moment it happens:
`harness observe "<what happened>" --kind difficulty --severity degrading`
Drain at session end: `harness observe --list --json` → `harness record retro` →
`harness observe --clear`.

### Known harness state

`harness doctor` reports **degraded** on one layer: no `post-commit` telemetry
flush hook is installed. That is deliberate — the hook runs
`harness telemetry sync`, which **pushes** to `refs/harness-telemetry/*`, and
publishing from this repo is the maintainer's call. Install it only if you want
telemetry pushed on every commit.

<!-- BEGIN harness:commit-guidance -->
## Committing in this repo

Use `harness commit "<message>" -- <paths>` rather than a chained
`git add … && git commit …`.

A `harness commit` is **verified or named**: it probes the collector ingress,
commits, and then tells you WHICH outcome you got. It never blocks and never
rolls back. The outcomes are:

- **confirmed** — when the collector ingress socket is reachable: harness commits with no trace2 override, waits (bounded) for the `refs/notes/ai` note, and tells you whether it landed. A landed note is the healthy shape, and a miss is reported to you rather than hidden — with the next step named in the command's own output. Nothing was buffered on this path, so there is nothing to drain.
- **buffered and named** — when git's configured trace2 target is a plain FILE, or when the ingress is blocked, absent or unconfigured: the commit is made with its trace2 events going to a buffer file instead of the collector, so attribution is DEFERRED, not lost — and it isn't proven yet either. `harness commit` names the buffer it used; when the configured target is a plain FILE it must be pointed back at the socket first, because while it names a file there is no ingress to replay into. Drain it with `harness doctor telemetry-nudge` from an UNSANDBOXED shell. Recovery is POSIX-ONLY: the drain replays into an af_unix socket, so on a Windows host `harness doctor telemetry-nudge` refuses on platform grounds and drains nothing — the buffered events stay on disk, untouched, until they are drained from a host whose collector ingress is an af_unix socket.
- **NOT VERIFIED on this platform** — when trace2 points at a Windows NAMED PIPE (\\.\pipe\…): the commit is made with no trace2 override (git talks to the pipe as usual), nothing was buffered, nothing was written beside the pipe — and nothing is claimed about attribution, because nothing was measured. Check for yourself with `git notes --ref=ai show HEAD`. Do NOT run `harness doctor telemetry-nudge` — there is no buffer to drain and no replay path for the named-pipe transport, and it will refuse.

A chained or compound `git commit` can **silently lose attribution** — agent
command sandboxes block git-ai's socket, git quietly disables trace2, and the
commit's authorship may later be recorded as human.

Neither shape guarantees delivery. What `harness commit` guarantees is that the
outcome is never silent. Read `harness instructions commit` for the detail.
<!-- END harness:commit-guidance -->
