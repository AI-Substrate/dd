# dd — open fixes & enhancements

**Migrated** from `scratch/dd-next.md` in the harness-engineering `s065-deterministic-documents`
worktree (107 lines, verified against `main` `d08f4942`) into this repo by plan 001
phase 4 `tk-0004`. **Kept by**: `pij-related-koala` · **Opened**: 2026-08-06.

**Nothing here is resolved by the migration.** Every status, owner and ordering
constraint below is carried across as written. Items marked **OPEN** are still open —
an OPEN item that arrived here answered would have been decided by a file move, which
is the one thing this migration must not do. Three rows are **added** (18–20), each
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

Three rows opened by plan 001 and carried here rather than resolved in flight. Each is
annotated with who it is routed to and why it is not being decided by the coder who
found it.

| # | Item | Status |
|---|---|---|
| 18 | **Port the dd exemplar corpus (`docs/how/dd/exemplar/`) into this repo, or rule that it stays upstream.** It was deliberately NOT ported: `backpressure.dd.json` carries `meta.certainty: "Partial"` — the exact contested value item 10 exists to re-rate — and the exemplar is the document new authors copy, so porting would propagate an unruled value into a second repo by imitation. `docs/how/dd/README.md` records the refusal and `src/docs/content/dd-overview.md` points at the three runnable equivalents that do ship. **Rule 8 and 10 first**; this is downstream of both. | **OPEN — Jordan** (routed alongside 8/10, per the phase-3 esc-4 ruling) |
| 19 | **Mechanize the two unmechanized guardrails.** Of the three plan guardrails covering the claim-outran-implementation class, only one is even partly mechanized: the schema refuses a `blocked`/`na` state whose reason exists solely in the author's head (`src/core/validate.ts`, class `state-note-required`), and a mutation reds a vacuous guard. **OUT-OF-DIFF SWEEP** and **MEASURED-AT STAMPING** remain pure discipline — nothing fails today if a reviewer skips the sweep or a receipt omits its SHA. Both have a known shape: the sweep as a gate over assertions naming behaviour changed outside the diff, the stamping as a linter requiring every count-claim in an execution log to carry a resolvable SHA. *A rule not yet mechanized is a rule we are still paying for in attention every review.* | **CANDIDATE** — dd repo · proposed by o-prime (SUGG-001), not ruled work |
| 20 | **Re-enable npm provenance on the release path.** `.github/workflows/release.yml` sets `NPM_CONFIG_PROVENANCE=false` because sigstore provenance rejects private source repos (npm E422). That premise is now stale — the repo is PUBLIC (`gh repo view AI-Substrate/dd --json visibility`, measured at `045f958`). Deliberately not flipped by the phase-4 CI sweep: it changes what the release path *emits*, and publishing is out of scope for plan 001 (standing constraint 2). Pairs naturally with release enablement (constraint 4). | **OPEN — Jordan** — dd repo · found by the `tk-0001` CI sweep |

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

## Provenance

Items 1–6 and 14 came from `pij-respectable-clam`'s first real run of the dd builder
flow; 7–12 and 17 from their second. Each was verified against source before entering
this list — one reported cause (a missing references-ledger writer) did **not** hold and
is not listed; the real cause was git-untracked targets, and the surviving finding is
item 3.

The recurring shape across 1, 2, 7, 12 and 17: **an existing capability present on the
siblings and absent from one member**, invisible when reading any single member.

Items 18–20 were opened during the extraction itself: 18 by the phase-3 exemplar-corpus
escalation, 19 by the o-prime's review of the guardrail set, 20 by the phase-4 CI sweep.
