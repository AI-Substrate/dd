# `harness boot` — agent briefing

Run this BEFORE you change anything in this repo. It is the fast proof that dd is
in a working state, so you can tell "I broke it" apart from "it was already
broken".

## What this verb computes (the deterministic part)

It wraps `just boot`, which runs two steps:

1. `npm run build` — `tsc` emit to `dist/`.
2. `npx vitest run test/smoke.test.ts` — spawns `bin/ddocs.js` as a real subprocess
   and asserts the wire contract end to end: an `ok` envelope exits 0,
   `unconfigured` exits 2 and carries a `next_action`, an unknown command exits 1
   with error code `E001`, piped stdout auto-selects JSON, and `--no-json` still
   forces the human renderer.

That is the whole product surface today, so a green `boot` means the CLI seam the
ported dd verbs will slot into is intact.

Envelope `data` carries `{command, stdout}` with the tail of the lane on success.
On failure the error `details` carry the tails of both stdout and stderr.

Statuses you can get back:

- `ok` (exit 0) — dd compiles and the envelope contract holds.
- `unconfigured` (exit 2) — `node_modules` is missing, so the lane never ran.
  This is not a product failure. Run `npm ci` and re-run.
- `error` (exit 1) — the build or the smoke test failed; see `error.details`.

## Your role (the inference part)

The verb reports; it does not judge. You decide:

- **Was it already broken?** If `boot` fails on a tree you have not touched, that
  is a pre-existing failure. Report it — do not quietly absorb it into your own
  change, and do not "fix" it as a side effect of unrelated work.
- **A smoke failure is a contract failure.** It means the envelope shape, a
  status, or an exit code moved. Be sure that was intended before proceeding.
- **Re-run after fixing**, and run `harness checks` (the full gate: lint + build +
  typecheck + test) before you call the work done. `boot` is a strict subset, so
  a green `checks` implies a green `boot`, but not the reverse.

## Watch out for

- **`ok` is narrower than "dd works".** This repo is a scaffold: the dd verbs are
  still being ported out of harness-engineering (`harness/cli/src/acts/dd`). A
  green lane proves the CLI seam and the envelope contract hold — it says nothing
  about dd behaviour that has not landed yet. Run `ddocs status --json` for the
  honest port ledger; it reports `unconfigured` until every planned verb exists.
- **`boot` does not lint or typecheck.** That is deliberate — it is the fast lane.
  Use `harness checks` for the full gate.
- **A stale `dist/`.** The smoke test runs whatever was last compiled. `boot`
  always builds first, so trust `boot` over a bare `vitest` run.
- **The lane needs `just` and `npm` on PATH.** A missing tool surfaces as an
  `error`, not as `unconfigured` — read `error.details` before assuming the code
  is at fault.
