# dd — open fixes & enhancements

**Migrated** from `scratch/dd-next.md` in the harness-engineering `s065-deterministic-documents`
worktree (107 lines, verified against `main` `d08f4942`) into this repo by plan 001
phase 4 `tk-0004`. **Kept by**: `pij-related-koala` · **Opened**: 2026-08-06.

**Nothing here is resolved by the migration.** Every status, owner and ordering
constraint below is carried across as written. Items marked **OPEN** are still open —
an OPEN item that arrived here answered would have been decided by a file move, which
is the one thing this migration must not do. Four rows are **added** (18–21), each
marked `ADDED` and traceable to the ruling that produced it; nothing upstream is edited.

**Status of the whole list: nobody is working on any of it.** Prime has allocated
ordinals for 1–3 and 7 — that means a reserved number and a spine entry, not a coder.
The only active work in the fleet is plan 073 (`pij-generous-chipmunk` under
`pij-respectable-clam`), which *consumes* dd and does not fix it.

Legend — **ALLOC** ordinal reserved, no owner · **AGREED** shape settled, unallocated ·
**OPEN** needs a decision before it can be built · **UNASSIGNED** nobody has picked it up ·
**CANDIDATE** proposed here, not ruled work.

---

## The envelope / remedy cluster — one packet, dispatchable, undispatched

| # | Item | Status |
|---|---|---|
| 1 | `flow nav show` emits position at `data.now` alongside its existing `nav` object, matching every other verb in its family. | **ALLOC** FX012 |
| 2 | Thread the existing remedy mapper into `validate` so a bad address in an authored document gets the advice `link`/`address`/`graph` already give. | **ALLOC** FX013 |
| 3 | The "target is not tracked" error says the word *git* and names `git add`. | **ALLOC** FX014 — merges into 2 |
| 4 | Mapper reads its key via `issue.reason ?? issue.class` so it spans both failure types without regressing the three acts that work. | **AGREED** |
| 5 | Declare the merged key space's irregularities — one shared token (`schema-unresolvable`), two twins (`malformed`/`address-malformed`, `path-escape`/`address-path-escape`) — so the next collision fails the build. | **AGREED** |
| 6 | Control asserting one shared fact lives at one envelope address; canonical **presence** not exclusivity; a comment in the test file saying it is a ratchet, not a detector. | **AGREED** |

Fix shape for 2+3 is one class-keyed change, not two. Cost is **not** "one import" — an
earlier estimate said so and was withdrawn.

## Document birth

| # | Item | Status |
|---|---|---|
| 7 | `harness dd new <schema> --path <file>` — `builder/backpressure` has a registered schema and no sanctioned way to instantiate it; the only workaround is the hand-editing `20-plan.md` forbids. | **ALLOC** |

## The backpressure cluster — ORDER MATTERS

The producer (`eng-harness-flow/references/stages/backpressure.md`) emits hand-written
markdown while a `builder/backpressure` schema exists. Three vocabulary divergences:

| axis | producer prose | schema enum | shape |
|---|---|---|---|
| certainty | Strong / **Partial** / Weak | **Partial** / Confident / Proven | collision |
| tier | computational / **inferential** / human-judgement | computational / human-judgement | missing member |
| status | EXISTS / EXTEND / **BUILDABLE** / ABSENT | EXISTS / EXTEND / **BUILD** / ABSENT | twin |

Only the collision fails **silently** — `Strong`, `Weak`, `inferential` get refused at
the write. `Partial` is a *declared middle* in the prose (defined at `:136`) and an
*inferred floor* in the schema (name order only — the schema declares no ranking, no
descriptions). There is no authority in the schema to migrate against.

**These four run in this order. Running 11 first turns the gate green over three
documents holding undetermined values, and the green then argues the vocabulary is
consistent.**

### The vocabulary lives in THREE places with THREE roles, and no two agree

| where | role |
|---|---|
| `skills/eng-harness-flow/references/stages/backpressure.md:136-138` | **DEFINES** the rungs, each tied to sensor modes |
| `skills/builder/references/coach.md:273`, `00-routing.md:146`, `:149` | **USES** the tokens as a narration template — defines nothing |
| `.dd/schemas/builder/backpressure/schema.json` | **CONSTRAINS** to three *different* tokens — defines nothing |

**A generator pointed at one tree leaves the other two.** (Found because two of us cited
"the" prose source and neither pointer was wrong — different trees, both real. There is
no `skills/builder/references/stages/backpressure.md`.)

| # | Item | Status |
|---|---|---|
| 8 | **Confirm the three schema rungs map onto the coverage distribution the prose already uses.** *Not* "invent what these words mean" — the prose defines Strong/Partial/Weak as functions of `coverage_mode` (EXISTS / EXTEND→RUN / BUILD→RUN / ABSENT), so the schema's three can be defined mechanically against the same criteria rather than from taste. 073's distribution: 19 paved / 2 extend / 1 build / 2 absent. | **OPEN — Jordan** (small call, unblocks 9–11) |
| 9 | Rename the clashing member. Generation cannot fix a token valid on both sides meaning different things. | **OPEN** — blocked on 8 |
| 10 | Re-rate the three documents carrying `meta.certainty: "Partial"` — `docs/how/dd/exemplar/backpressure.dd.json`, `docs/plans/archive/071-dd-native-builder/`, and 073. **The exemplar is the document new authors copy, so the wrong value propagates by imitation.** | **OPEN** — blocked on 8/9 |
| 11 | Generate the vocabulary lists from the schema enums (the `gen-*.mjs` + `check:*` pattern this repo already uses), so twin and missing-member cannot drift again. **Must cover all three locations above — a generator aimed at one tree leaves the other two.** Add per-member descriptions **in the schema**, not only in generated prose, or the generated docs become the only definition. | **AGREED** — blocked on 8–10 |
| 12 | Migrate the backpressure producer to author a real `builder/backpressure` document. Shape undecided: migrate the verb, or rule the artifact deliberately prose and drop `pressure`'s mandatory framing. | **OPEN** |

### The `done_when` consequence — two findings, state them separately

`builder/plan`'s `done_when` has `pressure` in `required` and its target is
`builder/backpressure/section/rows`, so a markdown producer cannot satisfy it **by
construction**. Separately, an empty `done_when` validates clean at default depth —
which is **correct schema semantics** (per-row requirement, zero rows, `done_when` not
itself a required section), *not* a validator bug.

> Keep these apart in any packet, or someone "fixes" the validator and breaks per-row
> requirements everywhere.

## Elsewhere

| # | Item | Status |
|---|---|---|
| 13 | Add an `outcomes` section to the plan schema — authored not derived, `outcomes` as the id with "What you get" as the rendered heading, WARN if an item contains a dd id or address syntax, no `plan ready` gating. Schema and `20-plan.md` **must land together** or every new plan validates as missing a section the builder cannot author. | **OPEN — Jordan** |
| 14 | `dd set` takes the declared type, `dd add` takes JSON always — deliberate and declared in the signature, but it cost a field author 12 silent writes. Doc line, not a change. | **UNASSIGNED** (prime ruled it not a defect) |
| 15 | Detector for deployed-skill-vs-source drift. Caused plan 072 to be authored in the format it was deprecating; eleven `harness checks` runs reported parity because that gate guards mirrored doctrine, not deploy freshness. | **UNASSIGNED** — DL-007 |
| 16 | `plan-ordinal.py` scans `docs/plans/` but not `docs/plans/archive/`, so it hands out numbers already used. One glob. | **UNASSIGNED** — DL-002 |
| 17 | `dd add`'s help text reads "…or create an addressed map entry" — the word *create* on the wrong verb, exactly where someone scanning for a document creator will find it. It produced one false read tonight. | **UNASSIGNED** |

## Added during the extraction (plan 001)

Four rows opened by plan 001 and carried here rather than resolved in flight. Each is
annotated with who it is routed to and why it is not being decided by the coder who
found it.

| # | Item | Status |
|---|---|---|
| 18 | **Port the dd exemplar corpus (`docs/how/dd/exemplar/`) into this repo, or rule that it stays upstream.** It was deliberately NOT ported: `backpressure.dd.json` carries `meta.certainty: "Partial"` — the exact contested value item 10 exists to re-rate — and the exemplar is the document new authors copy, so porting would propagate an unruled value into a second repo by imitation. `docs/how/dd/README.md` records the refusal and `src/docs/content/dd-overview.md` points at the three runnable equivalents that do ship. **Rule 8 and 10 first**; this is downstream of both. | **OPEN — Jordan** (routed alongside 8/10, per the phase-3 esc-4 ruling) |
| 19 | **Mechanize the two unmechanized guardrails.** Of the three plan guardrails covering the claim-outran-implementation class, only one is fully mechanized: the schema refuses a `blocked`/`na` state whose reason exists solely in the author's head (`src/core/validate.ts`, class `state-note-required`), and a mutation reds a vacuous guard. **OUT-OF-DIFF SWEEP** remains pure discipline — nothing fails today if a reviewer skips it. Known shape: a gate over assertions naming behaviour changed outside the diff. **MEASURED-AT STAMPING is now mechanized in exactly one file, so its shape is demonstrated rather than hypothetical**: `government/orient-local.md` — the mandatory first read for a new seat — carried a paragraph beginning *"Measured:"* that was inherited rather than derived and was wrong on all four values (escalated during phase 4, fixed at `0fafbf2`). The fix derives the block from the shipped bin in the operation that writes it (`scripts/gen-orient-state.mjs`, `just gen-orient`, `just check-orient`), and re-reading the whole file rather than patching the one line surfaced two further stale claims in it. That covers one file; every execution log, receipt, commit message and flow comment is still unmechanized. Known shape: a linter requiring every count-claim to carry a resolvable SHA. **The diagnosis that makes this tractable is about tense, not value**: contract claims (asserting a rule) and past-tense stamped records do not rot — only a *present-tense measurement inside a document meant to stay current* does, because it has no expiry and no owner, so nobody is wrong when it rots and nobody fixes it. The rule: assert contracts, stamp states, and derive anything that must read as current. *A rule not yet mechanized is a rule we are still paying for in attention every review.* | **CANDIDATE** — dd repo · proposed by o-prime (SUGG-001), not ruled work |
| 20 | **Re-enable npm provenance on the release path.** `.github/workflows/release.yml` sets `NPM_CONFIG_PROVENANCE=false` because sigstore provenance rejects private source repos (npm E422). That premise is now stale — the repo is PUBLIC (`gh repo view AI-Substrate/dd --json visibility`, measured at `045f958`). Deliberately not flipped by the phase-4 CI sweep: it changes what the release path *emits*, and publishing is out of scope for plan 001 (standing constraint 2). Pairs naturally with release enablement (constraint 4). | **OPEN — Jordan** — dd repo · found by the `tk-0001` CI sweep |
| 21 | **Derive every figure in the operation that prints the evidence, never retype a count from a table you just wrote.** A structural hazard in POINTER DELIVERY itself: the body behind a pointer is lossless, but the summary line carrying it is unverified prose — and the recipient reads the summary. koala diagnosed it on itself: it computed the evidence, then wrote the headline by *reading* it, and the wrong figure travelled in the summary while the correct table sat in the file behind the pointer. Second instance in this fleet: the PM's "34+ commits" figure, retyped into summary lines until a fast-forward measurement corrected it to 46. **Two halves, and the second is the one that failed in both instances.** SENDER: derive a figure in the same call that produces its evidence, or leave it out of the summary line — this makes bad numbers rarer. RECIPIENT: never put a figure into a durable artifact (commit message, flow comment, guardrail, handover packet) on someone else's headline alone, whoever supplied it and however reliable they have been — re-derive it. The "34+" cost nothing while it was a loose figure in chat; it became a defect when it was written into a commit message and a flow comment without being derived. The propagation path runs THROUGH the recipient, which is where it is stoppable. Worked instance: the o-prime re-ran koala's census at a different upstream SHA rather than accept it, which is the only reason a six-versus-nine slip surfaced. No exception for a peer prime. Every message in this fleet has that shape. Deliberately NOT a new guardrail row — it refines the measured-at and claim-outran-implementation rows, and a fourth row describing the same class is the rot we keep deleting. | **CANDIDATE** — fleet practice · from koala (INS-001), corrected by o-prime, not ruled work |

---

## Where each item lands

An annotation added by the migration, not a decision: which tree the work touches. It is
**assessed only where the item text makes it unambiguous** — a guess here would be worse
than a blank, because it would look like routing.

| items | tree |
|---|---|
| 1, 15, 16 | harness-engineering (flow CLI, skill-deploy drift, plan-ordinal script) |
| 2, 3, 4, 5, 6, 7, 14, 17 | dd — envelope/remedy mapper, `dd new`, `dd set`/`dd add` surface and help text |
| 8, 9, 10, 11, 12 | **both** — the schema is dd's (`.dd/schemas/builder/backpressure/`), the producer prose and the narration templates are harness skills. Item 11 says so explicitly: a generator aimed at one tree leaves the other two. |
| 13 | **both** — schema in dd, `20-plan.md` in harness; the item requires they land together |
| 18, 19, 20 | dd (added by plan 001) |
| 21 | neither — fleet delivery practice, encodable as a habit rather than a code change |

## Provenance

Items 1–6 and 14 came from `pij-respectable-clam`'s first real run of the dd builder
flow; 7–12 and 17 from their second. Each was verified against source before entering
this list — one reported cause (a missing references-ledger writer) did **not** hold and
is not listed; the real cause was git-untracked targets, and the surviving finding is
item 3.

The recurring shape across 1, 2, 7, 12 and 17: **an existing capability present on the
siblings and absent from one member**, invisible when reading any single member.

Items 18–21 were opened during the extraction itself: 18 by the phase-3 exemplar-corpus
escalation, 19 by the o-prime's review of the guardrail set, 20 by the phase-4 CI sweep,
and 21 by koala's diagnosis of a wrong figure in its own pointer summary.

---

## 22 — Windows drive-letter paths are re-anchored under the repo root · **LIVE ON `main`** · **FIXED AT `5b6ad12` ON `s002/sdk-build`** · **PENDING MERGE VIA PR #1**

> **STATUS IS HEAD-QUALIFIED AND THE DESCRIPTION BELOW IS NOT.** The prose is present-tense
> and **TRUE on `main`** — `git show main:src/core/validate.ts` still carries `startsWith('/')`
> at the resolve site, and `5b6ad12` is not an ancestor of main. **Do not "fix" it again.**
> It is fixed on the branch, unmerged, and re-fixing it collides with PR #1 in the same file.
>
> This header previously read `**LIVE PRODUCT DEFECT** · UNASSIGNED`. The description was
> accurate; **the status was false on every head** — it is assigned, it is fixed, and a reader
> on `main` saw an unowned live defect in a shipped CLI, whose correct response is to go and
> fix it. Caught by `pij-certain-crab`, which also derived the repair: a status must name its
> ref, because *"fixed" with no ref is the same ambiguity as the present tense it replaces.*
>
> **THREE SEATS HIT THIS INSIDE ONE HOUR** — koala grepped a bare checkout of `main` and filed
> the defect; the o-prime grepped `main` and nearly sent a correction; the PM measured the
> branch and nearly attributed koala's report to a stale record of ours. **Every measurement
> was right about the tree it read.** The trap is structural, not individual, and **it stays
> armed until PR #1 merges.**

**Added** 2026-08-07 after plan 001 delivery. **Found by** `pij-related-koala` reading this
fork read-only during handover; **reproduced here before recording**, not accepted.

Three sites test absoluteness with `startsWith('/')`, which a Windows drive-letter path
does not satisfy — so an absolute path is treated as relative and re-anchored:

| Site | Function | Surface |
|---|---|---|
| `src/acts/doctor.ts:129` | `resolveScope` | `dd doctor --path` — **shipped CLI** |
| `src/acts/graph.ts:385` | `resolveScope` (identical copy) | `dd graph --path` — **shipped CLI** |
| `src/core/validate.ts:88` | `resolveAddressFile` | address resolution — **library surface** |

Demonstrated, not reasoned:

```
in : C:/Users/jordan/docs
out: /Users/jordanknight/substrate/dd/C:/Users/jordan/docs     <- re-anchored
in : /abs/posix/path
out: /abs/posix/path                                            <- correct
```

**This is NOT a separator bug and `toPosix` does not fix it** — it fires on forward-slash
drive-letter paths too. Upstream's fix (`cfa501a6`, PR #116) uses `resolveInRepo` /
`ABSOLUTE_LOGICAL`, which already exist next door.

**The two act sites are a product defect**, not an internal one: `dd` is the shipped
surface here, so this reaches users directly rather than via a consumer.

**`core/validate.ts:88` will NEVER arrive by forward port.** That file is byte-identical to
upstream and upstream deliberately ruled its fix into a *later* PR, so waiting for the
port inherits this defect late. The line is known; fix it here.

**Do not fix as one change** — two distinct families, per upstream's own split:
*identity-spelling* (a path used as a KEY, normalised at both the `buildPlanIndex`
boundary and inside `itemKey`) versus *absoluteness-detection* (the three sites above).

**Acceptance-test note carried from upstream:** `toPosix` upper-cases the drive letter and
`normalizeFilePath` does not, so correctness depends on **which runs first** — a
two-producer identity disagreement. Any fix needs a lowercase-drive case, and the
"a moved file must ERROR rather than resolve to something plausible" assertion needs a
drive-letter sibling.

## 23 — Forward-port `cfa501a6` onto the consumed surface · UNASSIGNED · **blocked on OQ-1/OQ-2**

First non-zero forward-port debt since the fork. Detected by koala's `dd-fork-divergence`
chore firing, which is the instrument working rather than a surprise.

- Commit `cfa501a6`, base `16360949`; patch prepared by koala (path in the plan-001 log).
- **2 of 3 consumed files move**: `plan/index-plan.ts` (+89/−13 with `links/map.ts`) and
  `links/map.ts`. `core/validate.ts` is **untouched** — verified by `git diff --quiet`, not
  by reading a file list — so `DdIssue`, `resolveAddressFile` and `collectLinkCells` stay
  byte-identical. Four symbols move, not seven.
- Sequencing: item 22's act-site fix does **not** depend on this port and should not wait
  for it.

## 24 — `npm install -g git+<url>` FAILS at `prepare` — the GLOBAL staging path ONLY · UNASSIGNED · **ADDED 2026-08-09** · needs a decision

**The route Jordan specifically needs is the one that is broken.** His work machines force npm
through a supply-chain proxy that imposes a **seven-day delay**, which is why the git route exists
at all — and the git route's most useful shape is the one that does not work.

**Measured, not reasoned** — matrix run by `pij-handsome-shrew` from the merged head, and the
`-g`-from-main leg independently reproduced by `pij-mental-dajeil` into a sandboxed `--prefix` (so
the real global tree was never touched):

| command | result |
|---|---|
| `npm install -g git+file://…/dd` (main) | **FAILS** — TS2688 during `prepare`'s `tsc` |
| `npm install -g git+file://…/s002-sdk-build` | **FAILS** — same |
| `npm install -g git+https://github.com/AI-Substrate/dd.git` | **FAILS** — same |
| `npm install git+file://…/dd` (local dep) | ok, `dist/` built, envelope answers |
| `npm install git+https://github.com/AI-Substrate/dd.git` (local dep) | ok |
| `git clone` → `npm install` → `npm install -g .` | ok — the working route to a git-fresh global binary |

**NARROWED 2026-08-09 by `pij-certain-crab`, and the narrowing matters more than the defect.**
A SHA-pinned `github:` PROJECT install **WORKS TODAY, from the unmerged branch**:

```
npm install github:AI-Substrate/dd#a28f2595022fa2899f7903be2362c20c98324ff0
-> added 3 packages in 12s | dist/lib.js PRESENT | root import = 9 runtime exports, no CLI execution | ./node resolves
```

Three measurements now bracket it: a local `git+file://` install works, a SHA-pinned
`github:` project install works, and only `npm install -g git+<url>` fails. **So this row is
NOT "git installs fail" — it is specifically the GLOBAL staging path**, and saying otherwise
would push the next reader off the git route entirely, which is the route the distribution
ruling made load-bearing in the first place. The o-prime predicted the `github:` route would
fail the same way; **it does not**, and that prediction is recorded here rather than quietly
dropped.

**The SHA-pinned `github:` route also closes a gap koala named independently**: a `file:`
tarball dependency carries no provenance — the lockfile records a path and a version, no sha —
whereas `github:…#<full-sha>` **is self-describing**. Two seats arrived at the same problem from
opposite ends within the hour.

So **local git installs work and global git installs fail, from any source.** Environment:
npm **11.10.0**, node **v24.7.0**; `typescript ^6.0.3` and `@types/node ^26` are both devDeps;
`prepare` and `prepack` both run `npm run build`.

The exact error:

```
error TS2688: Cannot find type definition file for 'node'.
  tsconfig.json:9:15   "types": ["node"],
```

**Proven vs unproven, kept separate deliberately.** PROVEN: under `-g`, `tsc` itself resolves
(from this machine's global typescript), which is why the failure is `TS2688` and not
`tsc: not found` — on a machine with no global typescript the same route fails as
command-not-found instead. **NOT PROVEN**: *why* the staged clone lacks `@types/node` under `-g`.
pacote's inner install advertises `--include=dev` on its own command line and the types are absent
at build time anyway; whether `npm_config_global` leaks into the inner install and redirects it is
**unpinned**, and is not asserted anywhere in the README.

**Our gate does not exercise this.** `scripts/pack-gate.sh` proves `prepare` under `npm ci` in a
clone and `prepack` under pack — both real, neither is the `-g` staging path. That is the same
shape as `wl-0012`: a guard that is genuinely green about something adjacent to the thing that
broke.

**Candidate fixes, none ruled — this needs a decision, not an implementation:**

1. **Commit `dist/`.** Makes every git route work immediately, including `-g`, and removes
   `prepare` from the critical path. Cost: a generated artifact in the tree, which needs a drift
   gate to stay honest. **We already run exactly this pattern** — a generated `.dd.md` committed
   beside its source with `dd build --check` proving it fresh — so the machinery and the doctrine
   both exist. The symmetry is not an argument that it is right, but it is an argument that it is
   cheap.
2. **Pin the mechanism first and fix the real cause**, if it turns out to be a leaked
   `npm_config_global`. Correct, and unbounded until the diagnosis lands.
3. **Report upstream to npm** if the inner install genuinely ignores its own `--include=dev`.
   Right thing to do regardless; useless as a fix on Jordan's timeline.

**Do NOT "fix" it by weakening `prepare`.** A `|| true` or a swallowed build error turns a loud
install failure into a package that installs clean and is broken at first use — the
reports-success-while-broken family, bought deliberately.

**Documented, not hidden**: the README states the observable failure in one sentence and documents
the clone route as the way to a git-fresh global binary. Anyone hitting it finds it named rather
than discovering it themselves.

## 25 — `envelope-contract` asserts a status that depends on the RUNNER'S HOME · UNASSIGNED · **ADDED 2026-08-12** · **recorded, not fixed, on Jordan's instruction**

**A test in this repo passes or fails on state that does not live in this repo.**

`test/acts/envelope-contract.test.ts` asserts that `dd schema list` answers `ok`. It answers
`degraded` on any machine that has home-level schemas installed, because shadowing is a real
degraded condition and dd reports it correctly with a next_action naming the chain.

**Measured, with a control arm, both at `9d2812e`:**

| HOME | result |
|---|---|
| real (`~/.dd/schemas` present, 5 `builder/*` schemas) | **1 failed / 63 passed** |
| empty temp dir | **64 passed / 64** |

Same commit, same code, same command. **The only variable is the runner's home directory.**

**dd is not wrong here — the test is.** `dd schema list` returning `degraded` with
*"5 schema(s) shadow a lower-precedence copy"* is the correct answer to a real condition. The
defect is that a test asserts the unshadowed answer as if it were the only one.

**Why CI never caught it, and this is the part that matters.** CI runs with a clean HOME, so it
answers `ok` every time. **CI's green means "passes on a machine with no home schemas", not
"passes"** — an instrument whose output cannot distinguish those two states is not evidence for
either. The five home schemas appeared at `~/.dd/schemas` on **11 Aug 07:51**, roughly ten hours
**after** the three PRs merged at 21:38 on the 10th. **This is not fallout from that work** — the
control arm proves the merged code is sound.

**Who this hits.** The five shadowing schemas are `builder/{plan,backpressure,execution-log,fence,
review}` — the harness builder's own home install. So **anyone who has run the builder on their
machine will see this repo's suite go red**, and will reasonably assume they broke something.

**Not ruled — needs a decision, not an implementation:**

1. **Make the test hermetic** — pin HOME to a temp dir for the suite. Cheapest, and it stops the
   test lying. Cost: the suite then *never* exercises the home rung of the resolution ladder.
2. **Assert the shadow behaviour explicitly** — two cases, `ok` with a clean HOME and `degraded`
   with a planted home schema. More expensive, and it turns an environment accident into the
   coverage we do not currently have.
3. **Both.** Option 1 is the bug fix; option 2 is the missing test.

**Do NOT fix it by relaxing the assertion to accept `degraded`** — that makes the test pass in
both worlds while distinguishing neither, which is the failure it already has.

## 26 — CI runs on every PR push and is burning build minutes · UNASSIGNED · **ADDED 2026-08-12** · **Jordan's instruction, recorded not actioned**

**Jordan, verbatim, 2026-08-12:** *"also we have been usign way too many build minutes, need to
make sure pushing to PR is not auto CI build. CI to be required, but manual"* — followed
immediately by *"remember that for next work, dont fix now"*.

**The shape of what he asked for, and the tension in it, stated plainly so whoever picks this up
does not resolve it by accident:** CI must remain a **required** check for merge, but must not
**auto-trigger** on every push to a PR. Those two pull against each other on GitHub — a required
check that never runs blocks the PR forever. **The mechanism has to be chosen deliberately**
(`workflow_dispatch`, a label or comment trigger, `paths-ignore`, merge-queue-only, or a required
job that is satisfiable without a full run). **Whoever takes this must not simply drop the
required status to make the red go away** — that trades build minutes for the gate itself, and
this repository has already ruled that a gate defeated by nobody at all is the worst outcome.

**Measured context, so the saving is sized before the change is designed:** the three merges of
10 Aug ran ~2 minutes each across five jobs (`build-test` ×2, `package-smoke`, `static-gates`,
`ci-required`), and the two open dependabot PRs have each burned a full run on a **stale** nanoid
red that no longer exists. **Nobody has yet counted the actual minutes** — that number should
open the work, not close it.

## 27 — Two test names assert less than they claim, and both misled a fleet · UNASSIGNED · **ADDED 2026-08-13**

**A test's name is read a hundred times and its body once.** These two were read as guarantees
by two separate agents on the same afternoon, and neither guarantee exists.

| File | Name says | Body asserts |
|---|---|---|
| `test/acts/binary-name.test.ts` — `describe('the binary is named dd, and says so')` | the binary's name is pinned wherever it appears | **three** positive assertions naming `dd` (`:77`, `:81`, `:127`); everything else is a negative guard against **`harness dd`** — the *previous* rename's target |
| `test/docs-surface.test.ts:84` — `it('shows the binary’s own name in every command example')` | every command example shows the binary's own name | `expect(README).not.toContain('harness dd')` — one file, one negative |

**Measured consequence**: renaming the binary leaves ~634 doc spellings unguarded. Rename all of
them or none of them and the suite stays green. The o-prime briefed a fleet that "completeness is
PROVEN, not hoped" on the strength of the first name alone; the PM then built a gate on that claim
without opening a file it had already had open twice.

**These are not bad tests.** Both are correct, load-bearing ratchets **for the rename they were
built for** (`harness dd` → `dd`). The defect is purely that their names describe a general
property while their bodies pin a specific historical one — so they read as coverage of the next
rename, which they cannot provide.

**The fix is renaming, not rewriting** (the coverage gap itself is being closed by the `feat/binary-rename`
work, which adds a bin-derived, word-boundary-anchored guard):

- `the binary is named dd, and says so` → *"no user-facing surface still says `harness dd`"*
- `shows the binary’s own name in every command example` → *"README does not teach the upstream `harness dd` form"*

**Do NOT resolve this by deleting either test** — both catch a real regression class, and the
negative guard against `harness dd` stays valuable after the `ddocs` rename lands.

**The general rule is already doctrine** (`9966b60`, `.harness/government/orient-local.md`): a name
is the cheapest thing to read and the most expensive to trust; read the body before you cite the
file, with no exemption for files you have already seen. **This row is the actionable residue** —
two names in this repo that currently earn that distrust.
