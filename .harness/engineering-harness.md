# Engineering harness

> **AGENTS START HERE → `harness instructions`** — the CLI's baked agent
> briefing (envelope contract, role split, discovery loop). Then
> `harness instructions <verb>` per verb.

**What this repo is**: `dd` — a CLI **and** an SDK for deterministic documents. That shapes
everything below: there is **no long-running service**, so "boot" means *the binary builds and
its contract holds*, and "health" means *the shipped bin returns a valid envelope*. Do not look
for a server.

Filled 2026-08-08 from what is **actually runnable**, not aspirationally. Every command here was
run before it was written down.

## Boot command

```bash
harness boot        # wraps: just boot
```

Compiles with `tsc`, then runs `test/smoke.test.ts`, which **spawns the compiled bin** and
asserts its envelope. Roughly half a second. This is the cheap gate — the full gate is below.

## Checks command

```bash
harness checks      # wraps: just checks
```

The mandated quality gate, nine stages in this order — and the order is **asserted**, not
promised, by `test/ci-parity.test.ts`, which reads both this recipe and `.github/workflows/ci.yml`
and fails if a gate exists in one and not the other:

| Stage | Proves |
|---|---|
| `lint` | biome, read-only |
| `build` | tsc emit — prerequisite for anything that spawns the bin |
| `typecheck` | src + test. **Required separately**: vitest strips types, so green tests do not imply a typechecked lane |
| `check-docs` | the baked `ddocs docs` corpus has not drifted from its sources |
| `check-orient` | `government/orient-local.md`'s repo-state block still matches `ddocs --json status` |
| `check-handover` | the handover packet's verbatim guardrail/constraint blocks match their sources |
| `check-exports` | the exports map is **reachable**, not merely declared — with positive controls |
| `self-host` | every repo `.dd.json` still renders byte-for-byte to its committed `.dd.md`, using the **local** bin |
| `test` | vitest + coverage |

Not in `checks`, deliberately (clones and installs from the registry — wrong shape for the inner
loop; **CI runs it**):

```bash
just pack-gate      # scripts/pack-gate.sh — clean clone → npm pack → install the tarball → drive the INSTALLED bin
```

## Health check

```bash
ddocs --json version   # → {"command":"version","status":"ok",...}
ddocs --json status    # → the port ledger; exits 2 while any planned verb is unregistered
```

`ddocs status` is a **self-updating honesty gate**: it diffs registered verbs against the planned
set and cannot report `ok` while the surface is incomplete.

## Interact method

Invoke the CLI. Every verb takes `--json` and returns one envelope:
`{command, status, data, error?, next_action?, timestamp}` · `status ∈ ok | degraded | unconfigured | error` ·
exit **0** ok/degraded · **2** unconfigured · **1** error. `process.exit` is called in exactly one
place (`exitWithEnvelope`), so the contract cannot be bypassed.

**`unconfigured` never means "it worked."** That is the repo's green-but-wrong defence and it is
enforced in code, not prose.

## Observe method

**The envelope is the evidence** — structured, exit-coded, `next_action` mandatory on any non-ok
status. There are no logs to scrape.

```bash
ddocs doctor --json                 # sweep every document at infinite validation radius
ddocs graph --json                  # the whole document graph as mermaid
ddocs links <address> --json        # inbound + outbound edges for one address
harness doctor --json            # harness-layer health, ordered by dependency
harness observe "<what>" --kind <kind>   # capture friction the moment it bites
```

## Deterministic signal inventory

| Dimension | State | Instrument |
|---|---|---|
| Runtime inspectability | **present** | the envelope contract; `ddocs doctor`; `ddocs --json status` |
| Smoke paths | **present** | `test/smoke.test.ts` spawns the compiled bin; `scripts/pack-gate.sh` drives the *installed* bin |
| Checks gate | **present** | `harness checks` → `just checks` (nine stages, CI-parity asserted) |
| Architecture / static | **present** | tsc strict + biome + an SDK-tree external-import gate |
| Packaging | **present** | pack gate + publish dry-run + `scripts/exports-reachability-probe.mjs` (runtime reachability, positive controls) |
| Self-hosting | **present** | `just self-host` — ddocs renders its own documents with the local bin |
| Drift detection | **present** | `check-docs`, `check-orient`, `check-handover` — each a generator plus a `--check` twin |
| Sensors (`harness sensors`) | **absent** | none registered; `harness doctor` correctly reports the watcher as not needed |
| Security / dependency | **partial** | `npm audit` runs advisory-only in CI |

## Evidence paths

| Artifact | Where |
|---|---|
| Coverage | `coverage/lcov.info` (uploaded per Node version in CI) |
| Retro records | `.harness/records/retro/<date>/` |
| Observation buffer | `.harness/temp/` (gitignored, self-protecting) |
| Plan artifacts | `docs/plans/<ord>-<slug>/` — `.dd.json` sources, `.dd.md` renders, `assets/` |
| Governance | `government/` — `orient-local.md`, `standing-constraints.md`, `pending.md` |
| CI | GitHub Actions `CI` workflow; `release.yml` deliberately does **not** fire on `main` |

## Injection map

| Seam event | Fires from | What fires it |
|---|---|---|
| `pre-flight` | per-phase `boot-N` chore on the flight plan | `/eng-harness-flow --hook pre-flight` |
| `pre-coding` | `backpressure` chore, anchored off `plan` | `/eng-harness-flow --hook pre-coding` |
| `coding` | per-phase `observe-N` chore | `harness observe "<what>" --kind <kind>` |
| `post-coding` | per-phase `retro-N` (drain) chore | `/eng-harness-flow --hook post-coding` |
| `post-flight` | `retro-harvest` chore, anchored off `post-flight` | `/eng-harness-flow --hook post-flight` |

Driven by `/builder` guided mode; the flight plan is the single state substrate and the
`harness flow` CLI is its only writer.

## Back-pressure gaps

Named honestly, not scored:

1. **Two guardrails are still pure discipline.** The out-of-diff assertion sweep and measured-at
   stamping have no instrument — nothing fails if a reviewer skips the sweep or a receipt omits
   its SHA. Every guardrail that *was* mechanized held; these two are the ones that kept
   re-firing. Tracked as wishlist `wl-0006`.
2. **No sensors registered.** Everything is gate-shaped (pass/fail at a seam) rather than
   ambient. There is no standing reading of repository health between runs.
3. **Three failure modes no gate here can catch**, documented in `government/orient-local.md`
   § *where mechanism cannot reach*: an overclaim assembled from correct facts (needs an
   adversarial reader), a gate defeated socially or by simple inattention, and a contradiction
   created by *moving* text. The list is explicitly a floor, not a closed set.
4. **Security proof is advisory only** — `npm audit` never fails the build.

## Current maturity snapshot

**L3 — improvement loop active.**

Assessed against the ladder, not asserted: the friction log has entries (two committed retro
records, 21 entries), and **more than one has been encoded into the harness during normal
work** — `check-orient`, `check-handover`, `check-exports`, `just worktree`, and the CI-parity
twin requirement all began as captured friction and became gates. Magic-wand answers have
shipped real harness changes.

**Not yet L4**: the improvements landed because a governing agent chose to encode them, not
because the loop reliably produces them; no sensors run ambiently; and proof-level ceilings are
named (§ Back-pressure gaps) but not tracked over time.
