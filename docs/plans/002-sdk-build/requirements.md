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

**Attached conditions** (Jordan's, not inferred):

1. Close out plan 001 first. **Done.**
2. SDK design is **its own builder flow**.
3. > ⛔ **PRECONDITION — RESEARCH BEFORE DESIGN.** That flow **researches best-in-class SDK
   > design guidelines (via perplexity) BEFORE designing anything.** This is a Jordan ruling,
   > not a suggestion. **The first dispatch of this plan is the research step, not design.**
   > Dispatching design first breaks R-1.

*(Raised to a blocking callout after `pij-certain-crab` found the PM brief had dropped it — a PM
working from the brief alone would have dispatched design first and broken a ruling without ever
seeing it. Brief fixed too; the condition now lives in both places.)*

**Scope of the precondition — ruled by Jordan, 2026-08-08** (in the PM's pane, put as a direct
question with prime's boundary stated). Asked: *"Can the fixture skeleton (imports +
construction shape, derived from harness's four existing files) be drafted in parallel with the
R-1 perplexity research, or does R-1 mean nothing is touched before the research lands?"*
Jordan selected: **"Parallel is fine (prime's reading)"** — skeleton = measurement of what
already exists, runs alongside research; design decisions (Q-4 width, Q-5 root shape, exports
map) still wait for the research.

The boundary that reading carries (o-prime, 2026-08-08, now Jordan-confirmed): **the skeleton
may establish WHAT IS REQUIRED; it may not decide WHAT IS OFFERED.** Import statements and
construction shape derived from the four files is measurement and is permitted. Any judgement
about surface width, root shape, or whether a symbol is promoted or wrapped is Q-4/Q-5 design
and waits for the research. **If drafting the skeleton starts producing opinions about the
exports map, the drafter has crossed from measuring the floor to choosing the ceiling and must
stop and say so.**

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

### R-4 · Integration is an iterative trial WITH koala, not a one-shot handover

> **Jordan, 2026-08-08**, in the PM's pane, after confirming the PM's feature-list reading of
> the SDK ask: *"yep and when its ready to trial we will work with pij-related-koala to iterate
> on integrating it in to the harness."*

**Settles**: the SDK's consume step is not a packet thrown over a wall. When the surface is
**ready to trial** — not finished — we work *with* koala iteratively: integrate, hit friction,
adjust the surface, repeat. Two consequences for this plan:

- **The surface stays movable until the trial says otherwise.** Design decisions (Q-4 width,
  Q-5 root shape) should expect at least one koala-driven revision, so nothing freezes the
  `exports` map before trial feedback exists.
- **"Ready to trial" is a milestone this plan must define** — and it now is: the corrected
  trial bar in §5.1, plus the R-1 research honoured. It lands *before* the plan is done, not at
  its end. The bar was sent to koala before being finalised — the consumer is the only party
  who can judge it — and that consultation caught `fr-0010` before a line of the gate existed.
  *(The first draft of this bullet pointed at the original F-2/F-3 fixture design, since
  superseded — see §5.1 and §10 F-2.)*

**Unchanged by this ruling**: standing 5 (the consume work itself is koala's, we never start
it) and standing 6 (contact is prime-to-prime — the PM prepares, the o-prime sends). Iteration
changes the *cadence* of that channel, not its altitude.

### R-5 · THE GO — fleet spec, autonomy contract, and the exit condition

> **Jordan, 2026-08-08**, in the PM's pane, as `/pij` args: *"copilot agent harness opus 5
> coder high, terr high reviewer pelase. go"*
>
> **Jordan, 2026-08-08**, immediately after, mid-turn: *"iterate until complete unle syo have
> questiosn (ask me on pij telegram) oterhwsie i expect to come back to PR UP and CI green. Use
> your Pidgeboat Dog to make sure that the agents the coder isn't looping on silly things and
> check in on it. But otherwise just go through the coda review a loop for each phase until the
> work is complete unless you have a question."*

**Settles** (PM inference, labelled):

- **The go is given.** Plan 002 dispatch begins as of these words.
- **Fleet spec**: coder `claude-opus-5` at **high** effort, reviewer `gpt-5.6-terra` at
  **high** effort, both in the copilot harness. Cross-model review preserved.
- **Autonomy contract**: iterate phase-by-phase through the code-review loop until the work is
  complete, without waiting for further human input. Questions go to Jordan **via pij
  telegram**, not by pausing in-pane.
- **Exit condition: PR UP and CI GREEN.** For this plan this **supersedes** the 2026-08-07
  landing policy (*push to main, no PR* — orient-local § Repo mechanics). A later ruling by
  the same authority; the orient-local row stays correct for plan-001 history.
- **Supervision duty**: the PM runs the watchdog ("Pidgeboat Dog") on the coder to catch
  looping-on-silly-things, and checks in on it — supervision is the PM's, not delegated.

## 3. Constraints and cautions carried in

| # | Constraint | Source |
|---|---|---|
| C-1 | **First-party repos only** for the git-URL path. The proxy exists to guard packages we do not control; dd is ours. The exception is well-scoped as long as it never generalises to third-party deps. | o-prime caution, accepted framing |
| C-2 | **Pin to a SHA, never a bare branch — SHA-only for agents.** `github:AI-Substrate/dd` means "whatever `main` is right now" — two machines installing an hour apart get different code. Tags are Jordan's to cut (C-4), so no agent may satisfy this constraint with a tag. *Amended per F-6 ruling, §10.* | o-prime caution, amended by F-6 |
| C-3 | Upstream `harness-engineering` stays **read-only reference**. The consume step is koala's. | plan 001 standing constraint 5 |
| C-4 | No publish / tag / release from agents without Jordan. | plan 001 standing constraint 2 |
| C-5 | Worktree-per-writer. This plan works in `s002-sdk-build`, not main. | plan 001 P-2 ruling |
| C-6 | **A transient red is a finding, never a re-run — and the MECHANISM is now known** (o-prime, reproduced deliberately, recorded at `fceaab4` on main): the check-* gates REGENERATE the artifact they diff, so one pass detects drift, reports red, AND repairs it — **the second run cannot fail, and the red erases its own evidence**. The reds were never transient; they were real failures that self-destructed. Three compounding harms: the re-run habit gets trained, the re-run "proves" the red spurious, and nobody learns what drifted. **Operational rule, one command: ON ANY RED, `git status` BEFORE re-running.** Clean tree + red gate = the gate just repaired something and the evidence is already gone — capture the red output, report it, THEN proceed. (Real fix — check-* read-only / gen-* repairing — is a wishlist candidate, deliberately not in flight mid-pipeline.) | o-prime, 2026-08-08 · mechanism proven at `fceaab4` |

---

## 4. Measured starting state — all re-derivable

### 4.1 The SDK is **not** currently rich enough to satisfy R-2

> **RULED (o-prime, 2026-08-08): this census measures the WRONG POPULATION for Q-4, not merely
> an unverified count.** What it measures: the surface a **re-implementation** of `plan/` would
> need — `src/plan/`'s import graph. What it does not measure: the surface **the trial** needs —
> the construction shape of the four adapting harness files, which contains symbols (e.g.
> `FsDocLoader`, fr-0010) that appear in no import graph of `plan/` at all. These are different
> populations, and one was treated as a proxy for the other since the plan opened. **Q-4's
> answer derives from the §5.1 fixture's import list, never from this census.** The census
> stays as historical evidence of how the surface was first estimated — do not delete it, and
> do not cite it as the requirement. Note the symmetry with koala's fr-0010 objection: the bar
> and this census were biased in the same direction (both re-implementation-shaped), which is
> why neither would have caught the other.

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

> **The fix was correct AND it was not cost-free** (o-prime, 2026-08-08): `prepare` runs on
> `npm ci` too, so the pack gate's clean-clone assertion that `dist/` must be ABSENT before
> pack began failing — CI was red from `2fe4079` for three commits before anyone looked.
> The gate was right; the fix invalidated its precondition. Redesigned at `69b9e74` to prove
> **both** hooks in order: after `npm ci`, `dist/` must EXIST (the git-URL path working),
> then cleared so `prepack` is proven independently — strictly stronger, because R-3 made two
> distribution paths load-bearing and the gate only ever proved one. Do not read this section
> as "prepare was a settled, cost-free change."

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

Today's answer is **no** — first estimated as five symbols (§4.1), but that census measures the
re-implementation population, not the trial population (§4.1 header ruling). **The progress bar
is the §5.1 fixture's import list going from unsatisfiable to green.**

**MEASURED at P1** (`assets/p1-import-census.md`, commit `e2b995d`; independently verified by
cross-model review, `assets/p1-review-terra.md`, `44fa439`; PM re-enumerated the population a
third way — three instrument sets, one conclusion). **Two populations, two numbers, both now
exact — never conflate them again**:

- **Trial population** (the four adapting harness files — what THIS plan must satisfy):
  30 symbols consumed; 15 reachable; **floor = 6 unreachable** (`FsDocLoader`, `trackedPaths`,
  `DD_ISSUE_CODES`, `DdActDeps`, `NodeSchemaFs`, `renderDocument`), excluding 9 `src/plan/`
  rows R-2 already rules out.
- **Re-implementation population** (§4.1's — what a from-scratch `plan/` rebuild would need):
  **7 modules absent, 2 barrel-rescued, 7 symbols across 5 modules** — §4.1's five-across-four
  understated it on every axis; its conclusion survives, stronger (F-4 closed,
  `assets/p1-f4-rederivation.md`).

### 5.0 Trial evidence — OQ-1 demonstrated, no longer argued

**koala trial rounds 1–2** (2026-08-08, o-prime-verified, recorded on the o-prime's
instruction as superseding the reasoning previously cited): harness rewired `acts/flow.ts`
and `acts/plan/fence.ts` against the **packaged** SDK — registry-free install,
`tsc --noEmit` exit 0 with zero output, **423 tests across 21 files green** — and passed its
**own `FsPort`** into our **packaged** `ConventionSchemaResolver`, type-checking across the
package boundary with structural typing carrying the injection intact. That is R-1/OQ-1's
library-surface argument demonstrated through the published artifact. The remaining two files
(`acts/plan/index.ts`, `pr-body.ts`) cannot complete trial until OQ-2 is ruled — sequencing
by design, not failure. Trial round 1 also produced A-2 (`design-decision.md`), the first
consumer-driven amendment — R-4's iterate-with-koala loop working as ruled.

### 5.1 The trial bar — corrected by the consumer before it was hit

The first gate design (§10 F-2, as originally ruled) was a fixture **re-implementing**
`plan validate` through public exports. koala corrected it before it was built, and the hole it
found (`fr-0010`, banked at `2fe4079`) is the proof the correction was needed: **a clean-sheet
re-implementation never constructs `FsDocLoader`**, because fresh code reaches for whatever the
SDK offers — but the real integration **adapts four existing files whose construction shape is
already fixed**, and that shape needs `FsDocLoader`, which lives in the CLI half and is not
exported. The re-implementation fixture would have gone green over that hole.

> Re-implementation tests *whether the SDK can do the job*. It does not test *whether **this
> caller** can do its existing job through the SDK*. **Only the second is the trial.**

**The corrected bar** (koala's, accepted in substance; o-prime ruling of 2026-08-08). A fixture
that:

1. runs against the **installed tarball**, not the working tree — riding the pack-gate, because
   *correctly exported* and *present in the tarball* are two different failures;
2. **reproduces the injection, not the feature**: constructs `ConventionSchemaResolver` and
   `MemoizingDocLoader` with a **fixture-owned foreign fs port** — ownership running *inward*
   is the property that cannot be shelled, so it is exactly what the trial must prove;
3. drives a **real plan document** through `validate`;
4. imports **every symbol the four surviving harness files import** — public subpaths only, no
   deep paths, no self-repo relative imports.

This bar **is** the "ready to trial" milestone R-4 requires, and it was sent to the consumer
before being defined as final — which is why the hole was found now, at zero cost, instead of
mid-trial.

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
| Q-3 | `harness init` — stamp the governance doc? Every pre-flight boot across plan 001 returned `UNAVAILABLE` over a healthy substrate. | boot verdicts stay uninformative |
| Q-4 | Which primitives become public — **derived from the §5.1 fixture's import list** (ruled, o-prime 2026-08-08; §4.1's census is the wrong population and is historical evidence only), then widened or not per the R-1 research? | **the central question of this plan** |
| Q-5 | Does the root-export fix (§4.3) change `"."` to a real barrel, or drop the root export entirely? | SDK shape |

---

## 7a. Scoped INTO this plan

### S-1 · Windows drive-letter re-anchoring (backlog 22) — **ruled into plan 002**

> **Jordan, 2026-08-08**, on hotfix-now vs scope-into-002: *"na scope it to new plan"*

Not hotfixed on main. Three sites test absoluteness with `startsWith('/')`, which a
drive-letter path does not satisfy, so an absolute path is treated as relative and re-anchored
under the repo root:

| Site | Function | Surface |
|---|---|---|
| `src/acts/doctor.ts:129` | `resolveScope` | `dd doctor --path` — **shipped CLI** |
| `src/acts/graph.ts:385` | `resolveScope` (identical copy) | `dd graph --path` — **shipped CLI** |
| `src/core/validate.ts:88` | `resolveAddressFile` | address resolution — **library surface** |

Reproduced here before recording: `C:/Users/jordan/docs` → `<repoRoot>/C:/Users/jordan/docs`;
posix absolutes pass through correctly; genuinely relative paths re-anchor correctly. So the
defect is precisely and only the drive-letter case.

**Why it belongs in an SDK plan rather than sitting as a loose bug fix** — and this is the
part that makes the scoping coherent rather than convenient:

- `core/validate.ts:88` is on the **library** surface, and `resolveAddressFile` is one of the
  symbols harness already imports. An SDK cannot ship a public address resolver that mis-resolves
  a whole platform's absolute paths.
- The two act sites are the same defect one layer up, and the fix upstream used `resolveInRepo` /
  `ABSOLUTE_LOGICAL` — **primitives**, which is exactly what §4.1 is about. Deciding how paths
  are represented and resolved *is* SDK surface design, not incidental cleanup.
- `core/validate.ts:88` will **never arrive by forward port** — upstream deliberately deferred
  that fix to a later PR — so waiting inherits it late regardless.

**Carried constraints**: two distinct defect families per upstream's own split (identity-spelling
vs absoluteness-detection) — do not fix as one change. `toPosix` does **not** fix it; it fires on
forward-slash drive-letter paths too. Acceptance tests need a lowercase-drive case, because
`toPosix` upper-cases the drive letter while `normalizeFilePath` does not, so correctness
currently depends on which runs first.

### S-1a · The cfa501a6 F1 residue — SPLIT ruling (o-prime, 2026-08-08), measurement PM's

Upstream's own F1 (identity-spelling) sites, found unfixed in this fork during P4:

- **`src/plan/` sites (`index-plan.ts` itemKey/displayAddress) — DEFERRED.** Measured by
  o-prime: nothing outside `src/plan` imports it in this fork (grep across `src/` excluding
  `src/plan` → empty), so the fix is zero-risk AND zero-value — and it brushes R-2 for no
  gain. The larger question it exposes (does `src/plan` belong in this repo at all) is
  **`wl-0011`**, deliberately not plan 002's to answer.
- **`links/map.ts` `nodeId` (line 352) — SCOPED IN.** Prime ruled the shape (private symbol ≠
  private behavior; if nodeId output reaches public returns, it is surface); PM ran the trace
  (2026-08-08, against pinned `f9b7b03`): `nodeId` output feeds (a) `linkIssue(...)` addresses
  in the `issues` array returned by `mapAddress` — re-exported by `links/index.ts:51` — and
  (b) the `keyFor(arm, nodeId(...))` strings that become `DdMapNode.key`/`parent` in returned
  nodes. **A consumer observes the spelling in returned data → same argument that put
  `core/validate.ts:88` into S-1.** Fix dispatches as a P4 addendum (`p4b`), same F1 family
  discipline, after P3 completes.

### S-2 · Move `FsDocLoader` into the SDK half — **ruled, from `fr-0010`**

> **o-prime, 2026-08-08**, adopting koala's recommendation after verifying it: *"Ruled: move
> `FsDocLoader` into the SDK half — its deps are already public."*

The hole (`fr-0010` at `2fe4079`, re-derived here before recording): harness's injection is
`new MemoizingDocLoader(new FsDocLoader(deps.fs, new NodeHash(), null))`. `MemoizingDocLoader`
is public (`links/index.ts:33`); **`FsDocLoader` is not** — it sits at `src/acts/shared.ts:108`,
in the CLI half that leaves with the port, and the exports map has no `./acts` or `./shared`.
The consumer can construct the memoizer but not the loader it memoizes — the injection pattern
that made library consumption *forced* (OQ-1) is broken at its load-bearing joint.

The move is small: `FsDocLoader`'s deps are `Pick<FsPort,'readText'>`, `HashPort`,
`ReadonlySet<string> | null`, and it implements `DocLoader` (`core/walk.ts:17`, already public).
Nothing about it is CLI except its current address. **Rejected alternatives** (koala's analysis,
o-prime concurring): exporting `./acts/shared` publishes CLI internals; harness re-implementing
against the `DocLoader` interface creates a second answer to "what is a readable dd document",
and two would drift — rejected *by the party it would have spared work*.

**Scope of the ruling — DESTINATION RULED, LANDING DESIGNED** (o-prime, 2026-08-08, confirming
the PM's reconciliation after a loose wire restatement): the ruling settles that `FsDocLoader`
**belongs to the SDK half** and that alternatives (a) and (c) stay rejected — none of that
reopens with Q-4. What waits for Q-4 is **where it lands**: subpath, promoted or wrapped,
public name and form — that is offered-surface design under the R-1 boundary. A dispatcher
must not dispatch the landing as settled work the moment design opens; the destination is the
settled part.

---

## 8. Inputs already in hand

- `scripts/exports-reachability-probe.mjs` — runtime reachability, positive controls, CI-gated.
- Plan 001 `lg-000b` — the five-symbol measurement (historical estimate only — wrong population
  for Q-4 per the §4.1 header ruling).
- `docs/plans/wishlist.dd.json` — `wl-0001` (this plan), `wl-0005`, `wl-0010`.
- koala's consumer census and its patch for `cfa501a6`.
- `government/orient-local.md` — the repo contract, and § *where mechanism cannot reach*.
- **Not yet gathered**: best-in-class SDK design guidelines (Jordan's required research step, R-1).

---

## 9. Consumer frictions bearing on this plan

Jordan routes dd frictions from other fleets to the o-prime. Banked in
`docs/plans/frictions.dd.json` on `main` (six at `1ddde99`; `fr-0010` added at `2fe4079`).
Three are **design inputs to this plan**, not bugs to fix later:

**`fr-0001` — the schemas do not travel.** The `builder/*` schema packages exist only in
`harness-engineering`, so dd-native `/builder` works in exactly one repo. **An SDK that cannot
resolve its own first-party schemas in a consuming repo is not consumable**, whichever
distribution method ships it. This plan has to answer it, not inherit it.

> **Ruled (o-prime, 2026-08-08)**: fr-0001 is **not a friction — it is the adoption story**,
> and it is OQ-2's fault line on **data** rather than code: one definition or two. **It gets
> ruled together with OQ-2, never separately** — ruling them apart would be the two-vocabularies
> hazard already rejected in fr-0010's option (c).

**`fr-0010` — `FsDocLoader` is load-bearing, lives in the half that leaves, and is not
exported.** The injection joint that made library consumption mandatory is the one place the
surface is broken — see S-2 (§7a) for the ruling and the corrected trial bar (§5.1) it forced.
Found by the consumer *before* the trial, because the trial bar was sent to koala before being
finalised.

**`fr-0006` — the graph exists while the consumer still scrapes.** dd-rendered plans break every
downstream consumer that extracts by per-phase heading, and it fails **silently**: a delegation
packet compiles with the plan section missing and logs it as an exclusion, so the worker gets less
context than the orchestrator believes it sent. `pij-disturbing-ox`'s framing is the design brief
for this whole plan in one line: **`plan.dd.json#phases/ph-0001` is exact, stable and typed; a
heading match is a guess about layout.** Every consumer still scraping is one nobody has given a
reason to stop — **and giving them that reason is what the SDK is for.**

Three of the six share one family — **reports-success-while-broken**: `fr-0003` returns `status:
ok` on zero schemas, `fr-0005` refuses the right answer only after the analysis is done, `fr-0006`
degrades in silence. dd's own headline rule is *`unconfigured` never means "it worked"*, and the
SDK surface should make that rule hard to break rather than merely stated.

## 10. Intake findings — `pij-certain-crab`, and the rulings on them

The PM's first act was to **refuse the line-1 text the brief pre-wrote for it**, which is what the
brief asked it to be willing to do. Eight findings; these are the rulings.

| # | Finding | Ruling |
|---|---|---|
| **F-1** | Worktree forked at `1dbd233`, missing the `prepare` fix, the AGENTS.md commit block, and the corrected doctor baseline — so `requirements.md` §4.4 called something FIXED that was absent where the work happens | **FIXED.** Rebased onto `465d490`; `prepare` and the commit block verified present. Its diagnosis is kept: *the decay axis reproduced **structurally** rather than over time* — nothing wrong on main, everything wrong in the copy the work reads |
| **F-2** | The acceptance test is not attestable by this subtree — "harness re-implements `plan validate`" is an event in koala's fleet, and standing 5 forbids the work while standing 6 forbids the channel | **ACCEPTED — and the fixture design as first ruled here is SUPERSEDED by §5.1** (o-prime, 2026-08-08, from `fr-0010`). The original ruling — *a fixture re-implementing `plan validate` through public entry points, wired into `just checks`* — kept the right insight (a gate this subtree owns) but aimed at the wrong target: a re-implementation tests whether the SDK *can* do the job, not whether **this caller** can do its *existing* job through it, and it would have gone green over the `FsDocLoader` hole. The corrected bar (§5.1) reproduces **the injection against the installed tarball** with a fixture-owned foreign fs port. Gate ownership, `just checks` wiring, and koala-as-confirmation all survive |
| **F-3** | The progress bar has no gate — `check-exports` measures **subpaths** (11/12) while the progress bar is **symbols** (5), so the five-symbol figure is stamped prose with no owner | **ACCEPTED.** Same artifact as F-2 fixes it — now the §5.1 fixture, which imports every symbol the four surviving files import, so it fails while any needed symbol is unreachable and the number becomes a gate reading rather than a claim. This is guardrail 9 applied to our own headline metric; the correction to F-2's design strengthens this row rather than changing it |
| **F-4** | §4.1 says six modules minus one reachable = five, but the table names four — an unaccounted module inside the number we call the progress bar | **RECLASSIFIED (o-prime, 2026-08-08) — the original ruling was too generous.** UNVERIFIED framed it as a counting problem; the PM's Q-4 observation showed it is a **measurement-target problem**: the census measures the re-implementation population, not the trial population, so *re-deriving it carefully would have produced a carefully wrong answer that looked like diligence*. **CLOSED at P1** (coder T3 re-derivation `e2b995d`, review-verified `44fa439`): true numbers are **7 modules absent, 2 barrel-rescued (both mechanisms — `export *` AND named re-export lists), 7 symbols across 5 modules**. §4.1's prose compared symbols to table-modules — two different units — and missed `shared/posix-path`, the `links/map` named-list rescue, and the `isWithin`/`resolveInRepo` pair. Wrong in the safe direction on all three axes; conclusion survives, stronger. And per the reclassification: this number is historical only — Q-4 derived from the trial population (§5), where the floor is SIX |
| **F-5** | The brief dropped R-1's research precondition, so a PM working from the brief alone dispatches design first and breaks a ruling | **FIXED in both places** — §2 R-1 now carries a blocking callout, and the brief was corrected. **First dispatch is the research step** |
| **F-6** | C-2 says "tag or SHA", but standing 2 forbids agents tagging | **ACCEPTED — C-2 is SHA-only for any agent.** A tag is Jordan's to cut |
| **F-7** | Brief §6 says "two failure modes" over three bullets | **FIXED in the brief** |
| **F-8** | R-1 wants its own builder flow, but standing 3 makes flow files forbidden to read *and* write, with builder guided mode the sole writer | **CONFIRMED: plan 002 runs through `/builder` guided**, so the flight plan has a lawful writer. No seat hand-writes or reads `the-flow.*`; the CLI is its only writer |

**F-2 and F-3 together are the most valuable thing in the intake.** They caught that this plan's
headline metric was unowned prose — the exact defect plan 001 spent four phases cataloguing,
sitting in the first paragraph of its successor.
