# Plan 002 — dd SDK build · requirements collection

**Status**: COLLECTING. Not a plan, not a spec — the gathering surface that feeds `1a explore`
and `1b plan`. Nothing here is scheduled or committed.
**Worktree**: `dd-worktrees/s002-sdk-build` · branch `s002/sdk-build`
**Opened**: 2026-08-08, immediately after plan 001 closed (CI green on main, packet with koala).
**Owner**: `pij-mental-dajeil` (o-prime, dd). A `/pij` PM is stood up after the pre-amble.

> **Reading rule for this file.** Rulings are quoted **verbatim** and attributed. Measurements
> carry the command that produced them. Anything that is my inference is labelled as such.
> Plan 001's whole lesson was that a claim which was true when written decays silently, so
> figures here are stamped and re-derivable rather than asserted.

---

## 1. What this plan is

Turn dd from *a CLI with an accidental import surface* into **a designed SDK**.

The current `exports` map was derived from what harness happened to import (plan 001 dossier
F-04). That is a **description of one consumer**, not an API. Plan 002 chooses a surface on
purpose.

---

## 2. Rulings — verbatim, and what each settles

### R-1 · dd ships a library surface (OQ-1)

> **Jordan, 2026-08-08**, answering "is dd to be an SDK lib (not just CLI re-mapping)?":
> *"Yes, what we will do is close out current work then creaet a new builder flow on the SDK.
> we will research best in class SDK design guidlines from perplexity, but lets wind up here
> first."*

**Settles**: dd ships a supported **library** surface, not merely a CLI. The 12 `acts/dd` files
still leave with the port and become the CLI — that half was never in question. The four
surviving harness files consume dd as a library and are **not** rewritten to shell out.

**Attached conditions** (Jordan's, not inferred): close out plan 001 first (done); SDK design
is **its own builder flow**; that flow **researches best-in-class SDK design guidelines via
perplexity BEFORE designing**.

### R-2 · `plan/` is not shipped; harness re-implements on top (OQ-2, superseded)

> **Jordan, 2026-08-08**: *"I think it should be re-impl in Harness TBH. I assume SDK will be
> rich enough for harnes to do this? we can commmunicate withthe harness pij agent when the
> time comes"* … *"We should design the SDK aroudn the plan usecase. SDK shoudl be super
> rich."*

**Settles**: `services/dd/plan` does **not** ship as a public module. Harness re-implements plan
semantics using dd's public primitives. This is a **fourth option** — none of the three the
original question offered — and it dissolves the question rather than answering it.

**Design driver**: the **plan use case** is the driving design case for the whole SDK, because
it is the hardest known consumer — it exercises typed links, cardinality, cross-document
traversal, derived state and gate semantics simultaneously. A surface that expresses plan
semantics expresses almost anything simpler.

**Coordination**: koala (`pij-related-koala`) is the harness-side prime and is available when
the time comes. It has not started consume work and is sequenced behind its own prime.

### R-3 · Distribution is BOTH npm publish and git-URL

> **Jordan, 2026-08-08**: *"we would do both, npm and npx. Its just that on my work machines
> npm is fored via a proxy to guard against supply chain attackes (7 day delay). this is a
> problem for fast portabiltiy between the projects."*

**Settles**: ship via npm **and** support git-URL consumption. npm is the durable/external
path; git-URL is the **fast inner loop** between first-party projects, because a corporate
registry proxy imposes a 7-day quarantine on new versions.

**Mechanically confirmed** (o-prime, measured): a git install fetches dd **over git, not through
the registry**, so the quarantine does not apply to dd itself. Only its two runtime deps
(`commander`, `jiti`) resolve from the registry, and both are long-published and already past
any aging window. Evidence: `npm install github:AI-Substrate/dd` reported *"added 3 packages"* —
dd from git, two from the registry.

---

## 3. Constraints and cautions carried in

| # | Constraint | Source |
|---|---|---|
| C-1 | **First-party repos only** for the git-URL path. The proxy exists to guard packages we do not control; dd is ours. The exception is well-scoped as long as it never generalises to third-party deps. | o-prime caution, accepted framing |
| C-2 | **Pin to a tag or SHA, never a bare branch.** `github:AI-Substrate/dd` means "whatever `main` is right now" — two machines installing an hour apart get different code. | o-prime caution |
| C-3 | Upstream `harness-engineering` stays **read-only reference**. The consume step is koala's. | plan 001 standing constraint 5 |
| C-4 | No publish / tag / release from agents without Jordan. | plan 001 standing constraint 2 |
| C-5 | Worktree-per-writer. This plan works in `s002-sdk-build`, not main. | plan 001 P-2 ruling |

---

## 4. Measured starting state — all re-derivable

### 4.1 The SDK is **not** currently rich enough to satisfy R-2

Harness cannot re-implement plan semantics on today's public surface. `src/plan/` imports six
modules absent from the `exports` map; one (`links/model`) is reachable because `links/index`
re-exports it wholesale. **Five symbols across four modules are unreachable from any public
entry point:**

| Symbol | Module |
|---|---|
| `DEFAULT_GATE_TERMINAL_STATES` | `core/constants` |
| `deriveItems` | `core/derive` |
| `effectiveRel`, `collectDeclaredRels` | `core/rel` |
| `isRecord` | `core/value` |

Recorded as plan-001 `lg-000b`. **Consequence**: R-2 *exchanges* a public commitment rather than
removing one — nine plan-level helpers for five-plus lower-level primitives. That trade is
likely the better one (primitives are more stable and less coupled to a single consumer than
plan-shaped exports, which would lock dd to *harness's* plan semantics indefinitely) but it is
not free, and it is the central design question of this plan.

### 4.2 `./plan` is a hard error today, not a listing gap

An `exports` map does not merely fail to list a subpath — it **forbids** it. Runtime probe with
positive controls: **11 of 12 consumed subpaths reachable; `./plan` → `ERR_PACKAGE_PATH_NOT_EXPORTED`**.
Gated in CI as `just check-exports` (`scripts/exports-reachability-probe.mjs`).

### 4.3 The root export executes the CLI

`"."` resolves to `dist/index.js`, which **is the bin entry** — it carries the node shebang and
calls `main()`. So `import '@ai-substrate/dd'` **runs the CLI**, prints help to stdout, and
yields **zero named exports**. Harmless to harness today (it imports subpaths only) but wrong
for an SDK, and **freezing the map would freeze it**.

### 4.4 A git-URL install was broken — FIXED at `114b2c1`

`npm install github:AI-Substrate/dd` **reports success** and installs a broken package: no
`dist/`, bin throws `ERR_MODULE_NOT_FOUND`. Cause: the package has `prepack` but **npm runs
`prepare` on git installs**, and `dist/` is gitignored.

**Fixed on main at `114b2c1`** (Jordan, 2026-08-08) — one line, `"prepare": "npm run build"`.
**Proven against a real GitHub install after the push**, not against a local simulation:
`npm install github:AI-Substrate/dd` into a clean scratch project now yields `dist/index.js`
and a working bin (`dd --json version` → `status: ok`). R-3's fast path is live.

### 4.5 The consumer census (koala's, verified twice)

After the port, harness needs dd in **exactly four files**: `acts/flow.ts` and
`acts/plan/{index,pr-body,fence}.ts`. The 12 `acts/dd` files leave with the port. Verified at
two different upstream SHAs; the census is stable across that drift.

Forward-port debt on the consumed surface was zero at plan-001 close, but ~199 uncommitted lines
exist in an upstream worktree touching two of the three consumed files (four symbols, not seven).
koala holds a `dd-fork-divergence` detector that fires when debt reaches main.

---

## 5. The acceptance test this plan inherits

Set by R-2, and deliberately **measurable rather than a taste question**:

> **Harness re-implements `plan validate` using public exports only.**

Today's answer is **no, by exactly five symbols** (§4.1). That number is the plan's progress bar.

---

## 6. Known future direction — shapes the surface, not built here

**`wl-0010` custom validation** (Jordan, 2026-08-08):

> *"i want the rules that we usein pln to be expressable via a portable and customisable
> validation concept somehow so anyone can implement semantic validation across the top (plans
> must have acs, acs mst link to tasks in this file) etc. This will rely heavily on the typing
> system (ac must have at least one link to typeof tasks.dd/tasklist or what ever)."*

Semantic rules become **declarable data** rather than dd code. This is the end state that makes
`plan/` permanently unnecessary rather than merely unshipped, so **the SDK surface should be
designed with it in mind** even though it is not built in this plan.

Encouragingly, it leans on machinery dd **already has**: links are rel-typed *and* target-typed,
and `E406 link-type-mismatch` already fires. Jordan's example is a **cardinality constraint over
an existing typed edge**, not a new concept — which suggests the rule vocabulary can be small.

---

## 7. Open questions

| # | Question | Blocks |
|---|---|---|
| Q-2 | Windows drive-letter defect (backlog 22, three sites, live in the shipped CLI): hotfix now, or scope into this plan? | a shipped user-facing defect |
| Q-3 | `harness init` — stamp the governance doc? Every pre-flight boot across plan 001 returned `UNAVAILABLE` over a healthy substrate. | boot verdicts stay uninformative |
| Q-4 | Which primitives become public (§4.1) — the minimum five, or a deliberately wider designed surface? | **the central question of this plan** |
| Q-5 | Does the root-export fix (§4.3) change `"."` to a real barrel, or drop the root export entirely? | SDK shape |

---

## 8. Inputs already in hand

- `scripts/exports-reachability-probe.mjs` — runtime reachability, positive controls, CI-gated.
- Plan 001 `lg-000b` — the five-symbol measurement.
- `docs/plans/wishlist.dd.json` — `wl-0001` (this plan), `wl-0005`, `wl-0010`.
- koala's consumer census and its patch for `cfa501a6`.
- `government/orient-local.md` — the repo contract, and § *where mechanism cannot reach*.
- **Not yet gathered**: best-in-class SDK design guidelines (Jordan's required research step, R-1).
