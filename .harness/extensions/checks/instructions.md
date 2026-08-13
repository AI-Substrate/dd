# `harness checks` — agent briefing

The quality gate. Run this before you call work done. CI runs the same lane, in
the same order, so a green `checks` here means a green CI.

## What this verb computes (the deterministic part)

It wraps `just checks` and runs four gates in order, each a prerequisite of the
next:

1. `biome check .` — lint + format, read-only. `just fix` applies the safe fixes.
2. `npm run build` — `tsc` emit to `dist/`.
3. `npm run typecheck` — `tsc --noEmit` over `src` *and* `test`.
4. `vitest run --coverage` — unit tests plus the spawned-bin smoke test.

Envelope `data` carries `{command, gates, stdout}` on success. On failure the
error `details` carry the tails of both stdout and stderr.

Statuses: `ok` (exit 0) all gates passed · `unconfigured` (exit 2) `node_modules`
missing, so the gate never ran — run `npm ci` · `error` (exit 1) a gate failed.

## Your role (the inference part)

- **Fix, don't route around.** A lint or typecheck failure in your diff is yours.
  Do not add ignores or loosen `tsconfig` to get to green — that moves the
  failure into someone else's session.
- **Read which gate failed.** Build and typecheck failures are compiler-truth. A
  *smoke-test* failure is different in kind: it means the CLI's wire contract —
  envelope shape, status, or exit code — moved. Confirm that was intended, and
  treat it as a breaking change if the package has been published.
- **Green is necessary, not sufficient.** The gate proves nothing regressed; it
  does not prove you built the right thing.

## How this differs from `harness boot`

`boot` is the fast "does it run" lane (build + smoke) for BEFORE you change
anything. `checks` is the full gate for AFTER. They overlap deliberately — boot
is a strict subset, so a green `checks` implies a green `boot`.

## Watch out for

- **Coverage is report-only and looks low.** The smoke test drives a subprocess,
  so its work is not attributed to the in-process coverage report. Do not read the
  percentage as a quality signal and do not add thresholds to chase it.
- **`ok` is narrower than "dd works".** The dd verbs are still being ported out of
  harness-engineering; this gate covers the CLI seam that exists today. Run
  `ddocs status --json` for the honest port ledger.
- **The lane needs `just` and `npm` on PATH.** A missing tool surfaces as `error`,
  not `unconfigured` — read `error.details` before assuming the code is at fault.
