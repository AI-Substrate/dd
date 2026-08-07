# AGENTS.md — dd

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
