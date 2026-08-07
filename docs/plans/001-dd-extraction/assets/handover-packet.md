# Handover packet — `@ai-substrate/dd` → `pij-related-koala`

**From**: plan 001 (dd extraction), phase 4 `tk-0005` · **To**: `pij-related-koala`
**Repo**: `AI-Substrate/dd` · **Prepared**: 2026-08-07
**Measured at**: `d2520ad` unless a row says otherwise. Every count below carries the
command that re-derives it, because a count without its SHA is an assertion rather than
a measurement and re-rots silently as the repo moves.

**What this packet is.** Everything needed to swap `harness dd …` for the `dd` binary,
including the parts that are **not done**. Read section 2 first — it is the incomplete
one, and it is stated up front deliberately.

**What this packet is not.** It is not a claim that the extraction is finished. The
consume step — upgrading harness-engineering onto this package and stripping the old
code — is yours and has not been started (standing constraint 5).

---

## 0. The principle worth inheriting

Read this before the artifact. You are inheriting our guardrail rows, but **the rows are
the output of this principle, not the principle**. Given the rows you can apply them;
given the principle you can generate the next ones, including for failure modes we never
hit.

> **Prefer the fix that does not depend on anyone being diligent.**
>
> Turning a mechanical rule into someone's good intentions weakens it, **even when the
> volunteer is sincere and especially when they are reliable** — reliability is exactly
> what makes the dependency invisible until it fails. When you have a choice, encode the
> version that holds when the diligent party is absent, wrong, compacted, or replaced.

It was named at the end of plan 001 as the pattern behind every governance decision that
stuck. Twice a competent agent volunteered the disciplined version of a fix — *"ask me
every time"*, *"I'll carry this rule"* — and twice the mechanical version was chosen
instead. Source: `government/orient-local.md`.

Worked instances in this repo, each one chosen **over** a discipline:

| instead of | we shipped |
|---|---|
| remembering to justify a state change | the schema **refuses** a `blocked`/`na` state with no written reason (`src/core/validate.ts`) |
| asking the o-prime to recall the constraints | `government/standing-constraints.md`, citable **by number**, with the o-prime removed from the recall path |
| remembering not to stage delegate worktrees | a `.gitignore` rule |
| a habit of citing carefully | guardrail 13: **authority is a SHA**, never a working tree |
| a comment promising CI matches `just checks` | `test/ci-parity.test.ts`, which reds when they diverge |
| remembering to rebuild a document after editing it | `scripts/self-host-check.sh`, run by `just checks` and CI |
| remembering to update the orientation file as the repo moves | `scripts/gen-orient-state.mjs`, which derives the block from the shipped bin **in the operation that writes it**; `just check-orient` reds on drift |
| trusting a supplied figure | re-deriving it in the operation that produces its evidence (§2.1) |

**So here is the honest frame for what you are receiving**, and we would rather say it
plainly than imply competence: **this is a repo whose governance assumes its own agents
will be wrong.** That is why artifacts are citable by SHA and constraints by number,
why the guardrails below are reproduced verbatim rather than summarised, and why every
count in this packet carries the command that re-derives it.

A handover claiming careful agents would be the exact defect class we spent this plan
catching — six times, enumerated in §7, including once in the document that argues for
the rule.

## 0.1 The operating rule that follows from it

If you take one line from this packet, take this one:

> **Assert contracts, stamp states, and derive anything that must read as current.**
> The first is durable, the second is honest, the third is the only one that survives
> the repo moving.

It comes from a propagation sweep run after the sixth instance (§7 row 6), and it is
worth more than the rows it produced, because it says **which claims rot and which do
not** — the answer is not what most reviewers assume.

**The failure mode is not the value. It is the tense.** The sweep checked every file
mentioning `dd status` rather than grepping for the bad phrase, and found two kinds of
claim:

| kind | example | does it rot? |
|---|---|---|
| **Contract** — asserts a *rule* | `AGENTS.md`: `dd status` "reported `unconfigured` (exit 2) while verbs were missing and now reports `ok` (exit 0) with `ported[10]`; because the list is DERIVED from the registered commands, it flips back on its own if a registration is ever lost" | **No.** It records the *flip*, so it dates itself and stays true after the flip happens. |
| **State stamped to a moment** — a past-tense record | phase-2's task rows and execution log recording `ported[validate,schema,docs]`, exit 2 | **No.** A log of what was measured *then* is not a claim about *now*. Those rows are still correct. |
| **State asserted in the present tense as standing guidance** | `government/orient-local.md`: "Measured: `dd status` reports `ported: []`, `remaining: 10`, exit 2" | **Yes, and only this one.** |

A present-tense measurement inside a document meant to stay current **has no expiry and
no owner**. Nobody is wrong when it rots, so nobody fixes it. All six instances in §7
have that shape.

### The protective corollary: NEVER SWEEP STAMPED HISTORY

**This is the half of the rule that protects you from the rule**, and it is not a
footnote. It is the *inverse* failure of the one we spent this plan chasing, and it is
the one a **diligent** reader is more likely to commit.

> An auditor who "fixes" phase-2's execution log for saying `ported[validate,schema,docs]`,
> exit 2, would **destroy evidence while believing they were removing rot.**

That entry is a **correct historical record**. It was true when measured, it is stamped
to the commit where it was measured, and the stamp is precisely what makes it legible as
*history* rather than as a stale current claim. Editing it does not remove a falsehood —
it removes the proof that the port ever happened in stages.

We are naming this to you specifically because **you are the single most likely agent to
make this mistake, and you would be making it because we taught you to.** You arrive
holding our guardrails and hunting stale claims; every past-tense stamped record in this
repo will look like a hit. A packet that arms a reader to hunt rot without also
protecting history is a net harm, so: **execution logs, receipts, and phase records are
append-only history. Correct the claim, never the record.**

**The reader-side twin**, from a near-miss in this fleet an hour before writing: an agent
grepped `ci.yml` for a gate's *recipe name*, did not find it, and concluded a guard was
unsatisfied. Running the guard gave the right answer in one call — CI invokes the
*script*, not the recipe name. Same principle from the other end: **the derived thing is
the authority; the read is not.** Reach for the command before the grep.

**The sweep result itself**, re-derived here rather than relayed, measured at `0fafbf2`:

```bash
git grep -Iln 'ported: \[\]' -- '*.md'        # 0 — no markdown carries the stale reading
git grep -In  'zero dd logic'                  # 0 — anywhere, any file type
git grep -Il  'dd status' -- '*.md' | wc -l    # 19 files discuss the ledger; none assert a stale value
```

The stale claim **did not propagate** — it was confined to the one file. Two non-markdown
hits for `ported: []` survive and are correct by construction: the generator's own
docstring quoting the defect it exists to fix, and a unit-test fixture asserting the
pre-registration envelope shape. Neither is a standing claim about the repo.

---

## 1. The artifact

| | |
|---|---|
| Package | `@ai-substrate/dd` |
| Version | `0.1.0` (unpublished — see §2.2) |
| Bin | `dd` → `bin/dd.js` |
| Tarball | `ai-substrate-dd-0.1.0.tgz` — size and file count move with every change; run the command below |
| Node | `>=22` |
| Runtime deps | `commander` ^15.0.0, `jiti` 2.7.0 |
| Upstream basis | `d08f4942d28b7e5181d5845a56a63b0cbb1d3402` (harness-engineering `main`) |

Re-derive the tarball facts:

```bash
npm pack --dry-run --json | jq '.[0] | {filename, size, files: (.files | length)}'
```

**Ten verbs answer on the installed bin**: validate, schema, docs, build, address, link,
links, graph, doctor, write. The port ledger is derived from the verbs actually
registered on the program, not from a constant, so `dd status` cannot claim a verb that
does not answer:

```bash
dd --json status | jq '{status, ported: (.data.ported | length), remaining: (.data.remaining | length)}'
```

### The envelope contract

One envelope per command: `{command, status, data, error?, next_action?, timestamp}`.
`status` is `ok` | `degraded` | `unconfigured` | `error`. Exit **0** = ok/degraded,
**2** = unconfigured, **1** = error. `next_action` is REQUIRED on any non-ok status and
the constructors enforce it. `--json` / `--no-json` beat `DD_JSON=1`, which beats TTY
detection; piped output auto-selects JSON.

---

## 2. What is NOT delivered

Stated first and plainly, so you can plan around a known open decision rather than
discover it as a defect.

### 2.1 The exports map is NOT frozen

**Do not treat `package.json` `exports` as a stable public surface.** It is a
**skeleton**, explicitly not a freeze, and the task that would freeze it
(`tk-0002`) is HELD — not deferred, not forgotten, and not partially done.

**The blocking question is Jordan's, and it is unruled**:

- **OQ-1** — is dd consumed as a library (SDK) or shelled to as a CLI? This decides
  whether the exports map matters at all to you.
- **OQ-2** — does `src/plan/` ship publicly, stay internal, or return harness-side?

Neither was ruled before this phase ended. Nobody guessed them. `./plan` is
**deliberately absent** from the map rather than included-by-wildcard, because a
wildcard would have decided OQ-2 by accident; the plan barrel is proven importable
internally only. `test/package-manifest.test.ts` deliberately asserts **nothing** about
`exports` for the same reason — a partial expectation there would have frozen a shape
nobody chose.

What ships today, subject to that ruling:

```
.  ./core/address  ./core/model  ./core/parse  ./core/validate  ./core/walk
./links  ./render/renderer  ./schema  ./schema/index  ./schema/model
./schema/resolve  ./package.json
```

Every subpath above is an import specifier **observed in a real harness consumer**
(research dossier F-04), mapped explicitly rather than by wildcard so that what is
public is a list somebody chose. `test/consumer-surface.test.ts` imports one named
symbol from each exact subpath, so the map is proven **importable** — it is just not
**frozen**.

**Verified consumer evidence — which strengthens the recommendation but does NOT
substitute for the ruling.** Recorded as `lg-0005` (`df287bb`), computed by koala at
basis `d08f4942` and independently re-verified by the o-prime at upstream HEAD
`ab1e7e75`; the census is stable across that drift.

- Non-test consumers of `services/dd` outside `services/dd` are **16 files**. Twelve of
  them (`acts/dd`) LEAVE with the port, so the surviving harness-to-dd dependency is
  exactly **FOUR files**: `acts/flow.ts`, `acts/plan/index.ts`, `acts/plan/pr-body.ts`,
  `acts/plan/fence.ts`.
- **None of it is CLI-shaped.** `MemoizingDocLoader` and `ConventionSchemaResolver` are
  injected objects — a process boundary destroys the memoization they exist for.
  `validateWalk` / `traverseCorpus` / `resolveMapSeed` return in-memory graphs. And
  **eight of the imported symbols are TYPES** (`DdDoc`, `DdIssue`, `SchemaIssue`,
  `PlanDocument`, `ReadyReading`, `PlanEdge`, `PlanIndex`, `PlanItem`), which **cannot
  cross a CLI boundary at all**.
- That makes library consumption **forced, not preferred**.
- `escapeCell` and `headingSlug` are imported only by `acts/plan/pr-body.ts` (5 call
  sites, all table-cell and anchor composition), so a narrow public util subpath would
  satisfy harness without dragging the whole renderer API under semver.

**Every figure above was re-derived here, not carried on the supplier's headline.**
Measured independently at upstream `ab1e7e75`:

```bash
# 16 consumers, of which 12 under acts/dd leave with the port -> 4 survive
grep -rlE "from '.*services/dd" harness/cli/src --include=*.ts | grep -v '^harness/cli/src/services/dd/'
# 5 call sites, and pr-body.ts is the only importer outside services/dd
grep -c -E '\b(escapeCell|headingSlug)\(' harness/cli/src/acts/plan/pr-body.ts
grep -rl 'escapeCell\|headingSlug' harness/cli/src --include=*.ts | grep -v services/dd
```

The type census was recomputed by parsing the four surviving files' import statements:
8 type-only symbols (the list above) against 16 value symbols. A figure entering a
durable artifact on someone else's summary line is how a rare bad number becomes a
permanent one — the propagation runs through the recipient, so it is stoppable here.
The same standard is why the o-prime re-ran koala's census at a different SHA instead of
accepting it, which is the only reason a six-versus-nine slip surfaced at all. No
exception for a peer prime, and none for the o-prime either.

**Evidence is not a ruling.** However strong the above is, OQ-1 and OQ-2 remain Jordan's
alone, `tk-0002` stays held, and the map is still NOT frozen. Strong evidence must not
soften the honesty requirement — that inversion is how a recommendation quietly becomes
a decision nobody made.

**What this means for you**: if OQ-1 lands on SDK, the map needs a freeze pass before
you depend on it. If it lands on CLI-shelled, the map matters much less and the freeze
can be narrow. Either way the decision is Jordan's, and the work is already carried at
`docs/plans/001-dd-extraction/assets/tasks/phase-4/tasks.dd.json#tasks/tk-0002`.

### 2.2 Not published, not tagged, not released

No `npm publish`, no tags, no GitHub release, no PR (standing constraint 2). Release
enablement — the `RELEASE_PLEASE_TOKEN` secret and the npm trusted-publisher entry — is
Jordan's (constraint 4). Consume the tarball or the git repo, not the registry.

The Release workflow **does not fire on pushes to `main`**, deliberately. It would have
run and gone red on the empty token, and a workflow that reds on every push is not
inert — it is a false-alarm generator you would inherit. Restoring it is one line,
documented in the workflow with the commands to re-derive the facts behind it.

### 2.3 The exemplar corpus stayed upstream

`docs/how/dd/exemplar/` was **not** ported. `backpressure.dd.json` carries
`meta.certainty: "Partial"` — the contested value that dd-next item 10 exists to
re-rate — and the exemplar is the document new authors copy, so porting it would
propagate an unruled value into a second repo by imitation. `docs/how/dd/README.md`
records the refusal and its reasoning so it is not re-litigated, and
`src/docs/content/dd-overview.md` points at the three runnable equivalents that do
ship. Carried as backlog item 18, routed to Jordan alongside 8 and 10.

---

## 3. The wire format: the generated banner changed

Every `.dd.md` this package renders opens with a generated-file banner. Upstream emits
`GENERATED by (backtick)harness dd build(backtick)`; this package emits
`GENERATED by (backtick)dd build(backtick)`. *(Backticks spelled out — see §8.)*

**This is deliberate and it is effectively a wire format.** The banner names the command
that regenerates the file, and here that command is `dd build`. Two renderers that
disagree on it produce byte-different output from byte-identical input.

**Expect a one-line diff on every `.dd.md` in your repository the first time you
regenerate after swapping binaries.** That is the whole diff. It is not drift, not data
loss, and not a regression. Per-package banners are self-consistent and that is the
intended end state — do **not** pin one repo to the other's string, which would leave a
wrong instruction in one of them permanently.

Full detail, including the measured behaviour table:
`docs/plans/001-dd-extraction/assets/handover-notes.md`.

## 4. The renderer-skew window, and how it closes

While the two renderers disagree there is a **RENDERER AUTHORITY SPLIT** in force in
this repo: documents here are mutated and rendered **only** by the local `dd` bin, and
`harness plan validate` remains the semantic authority. The reason is measured, not
assumed — upstream `harness dd set`/`add`/`rm`/`build` **silently** rewrite the banner
to the upstream string while reporting `status: ok`. The loud failure
(`harness dd build --check` reporting a false E422) is survivable because somebody sees
it; the silent one lands in a commit nobody inspected.

A correction to that ruling is also on record and narrows it: `harness plan validate`
is **NOT** drift-affected — drift comparison is `build` alone. The blast radius is the
upstream write path plus upstream `dd build --check`.

**The window closes when you swap.** At that point there is one renderer again and the
banner question is settled by construction. Until then: local bin writes, harness
validates.

## 5. The 11 stay-behind tests

Eleven of the 60 upstream dd test files did **not** port. They are tests of *consumers
of* dd, not tests *of* dd: they reach into `src/services/flow/**`, `src/services/builder/**`
or `src/services/telemetry/**`, which are harness-side internals dd will never own.

```
test/acts/builder-dd-teaching.test.ts
test/acts/dd-native-dryrun.int.test.ts
test/acts/flow-dd-gate.test.ts
test/integration/dd-flow-gate.int.test.ts
test/services/dd/plan/ready.test.ts
test/services/flow/flow-dd-check-gate.test.ts
test/services/flow/flow-dd-gate-surface.test.ts
test/services/flow/flow-dd-gate.test.ts
test/services/flow/flow-dd-link-optin.test.ts
test/services/flow/flow-dd-sdk-seam.test.ts
test/services/flow/flow-dd-untrusted-reading.test.ts
```

**These must keep running in harness-engineering after you strip the old code** — they
are the tests that will tell you the swap did not break the flow↔dd seam. The full
import-direction audit of all 60, committed **before** any file moved, is at
`docs/plans/001-dd-extraction/assets/test-audit.md`. Note the audit corrected the plan's
own prediction: the stay set is 11, not the "~9" the plan estimated.

## 6. Proof you inherit

Re-derive with `just checks`, `just pack-gate`, and
`harness plan validate docs/plans/001-dd-extraction/plan.dd.json`.

**Read the "Result" column as a contract, not a reading.** Each row states what the gate
*asserts* — that is durable. The moving values (test counts, coverage, WARN totals) are
deliberately not stated as standing figures; run the command. The one exception carries
its SHA and says plainly that it moves.

| Gate | What it asserts | What it proves |
|---|---|---|
| `just checks` | **exit 0** | lint, build, typecheck, docs-drift, orient-drift, handover-drift, self-host, tests — the test and file counts rise with every phase, so run it rather than reading a number here |
| `just pack-gate` | **exit 0** | the TARBALL works: clean clone → pack → install → drive the installed bin, including a jiti-loaded custom render type written in untranspiled TypeScript |
| `just self-host` | **zero drift**, over a non-empty document set | dd renders this repo's own plan corpus. An empty glob **fails**: that is a broken gate, not a clean repo |
| `harness plan validate` | **0 ERROR** | semantic gate. Only `error` is a defect signal. The WARN total is an open-item contradiction count (a task checked against an acceptance criterion not yet flipped): it was **6** at `99e4157` and **10** at `d2520ad`, rising as work lands and falling as the o-prime flips ACs. Treat a change as expected, not as drift. |
| Coverage | report-only, **not gated** | no threshold to satisfy or regress |

**Three properties of this repo worth keeping** — each one an instance of §0, offered as
things that earned their place rather than as decoration:

1. **The schema refuses a state change whose reason exists only in the author's head.**
   A `blocked` or `na` state without a non-empty note is an ERROR
   (`src/core/validate.ts`, class `state-note-required`); `human-skipped` requires a
   receipt carrying the human's verbatim words. This is a document that will not accept
   an unjustified state change — a governance rule mechanized in the format itself
   rather than left to review attention.

2. **A guard that cannot pass by failing to look.** `test/ci-parity.test.ts` asserts CI
   runs the same gates as `just checks`. Its parsers **throw** rather than return empty
   when their target moves, and dedicated rows prove that: stub a parser to return `[]`
   and the skip-resistance rows go red. Without them, "parity holds" and "the parser
   found nothing" would be the same green — which is the exact shape of the defect the
   guard was written to kill. This is the designated worked example of the
   mutation-resistance standard: a new guard must red for the **right reason**, red on
   a **semantically wrong but syntactically valid** input, and be **unable to silently
   skip**. One red is not resistance.

3. **A guard that has caught its own authors in real use, not in rehearsal.** Twice in
   one phase the parity guard reddened on a genuine omission committed minutes earlier,
   by two different agents:

   - adding the self-host gate to `just checks` without adding it to CI (`045f958`);
   - the o-prime adding `check-orient` to `just checks` without adding it to CI
     (`0fafbf2`) — **an author who did not write the guard and was not in the coding
     pair.** It named both the missing gate and the order mismatch.

   Re-derived here rather than taken on report: delete the `check-orient` step from
   `ci.yml` and `npx vitest run test/ci-parity.test.ts` goes **2 failed / 17 passed**,
   naming the gate and the order; restore it and it is **19 passed**.

   **This is the distinction worth carrying: it is not a test that passes, it is a test
   that has demonstrably failed the people who wrote it.** A guard nobody has ever been
   caught by is still a claim.

## 7. What is still costing us attention

Three plan guardrails cover the class where **a claim outran its implementation** — a
docstring, a comment or a receipt asserting something no code checks. Here is every
instance, so the count below is the number of rows rather than a figure carried from
someone's summary:

| # | The claim | When it stopped being true | The fix that stuck |
|---|---|---|---|
| 1 | CI's `package-smoke` job asserted `dd status` answers `unconfigured`, exit 2 | true while verbs were landing; the ledger flipped when the tenth registered | assertion corrected to the post-port truth and verified against a real installed tarball (phase 3) |
| 2 | a ledger of the write-family verbs, asserted **outside** the diff that changed them | phase-2 out-of-diff escape | guardrail 8, the out-of-diff assertion sweep |
| 3 | a receipt that a rename regenerated the generated siblings | the rename commit `13d86f8` regenerated **11 of 14** | corrected, and the invariant re-phrased as *which sibling LACKS a matching rebuild* so it is derived rather than counted (§1) |
| 4 | the README anti-rot guard's docstring: extracts the quick start and runs it through the shipped bin | true of the JSON heredocs it did extract; the `dd` commands were retyped as hardcoded arrays, so a wrong command in the README stayed green | guard rewritten to execute what it extracts, proved by mutation (`8a13e53`) |
| 5 | `ci.yml`: *the same three gates `just checks` runs, in the same order, so CI and local cannot drift* | true when written; `just checks` grew to five, and the missing one was `check-docs` — the drift gate itself | `test/ci-parity.test.ts` (`408caa7`) |
| 6 | `government/orient-local.md`: *Measured: `dd status` reports `ported: []`, `remaining: 10`, exit 2* | true before phase 1; wrong on all four values by `d2520ad`, in the mandatory first read for a new seat, carrying the word **Measured** so it read as derived when it was inherited | `scripts/gen-orient-state.mjs` + `just check-orient` (`0fafbf2`); re-reading the file rather than patching the one line surfaced two further stale claims in it |

**Every single one of those was a claim that was true when it was written.** Not one was
ever a lie. The defect is always the same: **nothing re-derives, so truth decays into
assertion at whatever rate the repo moves.** That is why the fixes that stuck are
generators and gates rather than corrections — correcting the text resets the clock,
generating it removes the clock. That one line explains the entire guardrail set in §9a.

**What is still unmechanized.** Only one of the three guardrails is fully mechanized —
the `na`-requires-a-reason rule in §6. The other two:

- **OUT-OF-DIFF SWEEP** remains pure discipline. Nothing fails today if a reviewer skips
  it. Known shape: a gate over assertions naming behaviour changed outside the diff.
- **MEASURED-AT STAMPING** is now mechanized in **exactly one file** — row 6 above is the
  worked shape, and it is no longer hypothetical: derive the block in the operation that
  writes it, gate the drift. Every execution log, receipt, commit message and flow
  comment is still unmechanized. Known shape: a linter requiring every count-claim to
  carry a resolvable SHA.

Both are carried as backlog item 19.

*A rule not yet mechanized is a rule we are still paying for in attention every review.*
You inherit both the guardrails and that ongoing cost.

## 8. Two operational hazards, learned the hard way

1. **Backticks in text passed through a shell get evaluated and silently eat content.**
   It bit two agents in this fleet within an hour; in one case it ate two branch names
   out of a ruling, and the text read as complete. This packet spells out backticks in
   prose where the content must survive verbatim (§3). The reader cannot tell content
   is missing, which is what makes it dangerous rather than annoying.

2. **Authority is a SHA, never a working tree.** A ruling is actionable only as
   committed text citable by SHA. During this phase a ruling was read from an
   uncommitted file, was **wrong at the moment it was read**, and needed a transcription
   repair minutes later. Acting on it would have implemented text nobody had ruled.

## 9. Pointers

| What | Where |
|---|---|
| Standing constraints (cite by number) | `government/standing-constraints.md` |
| Open backlog, annotated (row count gated by `test/docs-surface.test.ts`) | `docs/backlog.md` |
| Wire format + renderer authority + measured behaviour | `docs/plans/001-dd-extraction/assets/handover-notes.md` |
| Import-direction audit (as audited at the time, past-tense record) | `docs/plans/001-dd-extraction/assets/test-audit.md` |
| Frozen P1 CLI surface | `docs/plans/001-dd-extraction/assets/dd-surface.md` |
| Research dossier (F-04 consumer surface) | `docs/plans/001-dd-extraction/assets/research-dossier.md` |
| Local orientation (o-prime is sole writer; repo-state block is **generated** — `just gen-orient`) | `government/orient-local.md` |
| The plan itself | `docs/plans/001-dd-extraction/plan.dd.md` |
| Quick start (executed as a test) | `README.md` |

**`docs/backlog.md` carries the 17 items migrated from `scratch/dd-next.md` verbatim,
plus the rows opened during the extraction.** The exact count is not restated here — it
is asserted by `test/docs-surface.test.ts`, which requires a contiguous run of item
numbers, so a dropped or duplicated row reds the build. **OPEN items are still OPEN** —
the
migration deliberately answered nothing. The `#8-before-#11` ordering constraint is
carried verbatim: running 11 first turns the gate green over three documents holding
undetermined values, and the green then argues the vocabulary is consistent.

**`government/standing-constraints.md` is worth your attention specifically** — it is
reproduced in full in §9a, because a pointer is not a contract body.

---

## 9a. The execution guardrails and standing constraints, VERBATIM

Reproduced in full rather than summarised, because koala asked to see them and has
adopted its own version — **a rule someone intends to cite has to arrive matching the
enforced version**, or the quoted copy silently stops being the real one.

**Both blocks below are GENERATED, not pasted** (`scripts/gen-handover-embeds.mjs`,
`just gen-handover`; `just check-handover` reds on drift, in `just checks` and CI). That
is not decoration — the guardrail block **went stale inside a single review cycle** when
guardrail 9 was amended upstream while this packet sat in review. A hand-pasted contract
body is a present-tense claim in a document meant to read as current, so pasting it
would have made the packet break its own headline rule (§0.1).

### The execution guardrails

<!-- BEGIN GENERATED: guardrails (scripts/gen-handover-embeds.mjs) -->

**Reproduced verbatim as of `648febd`** — 13 rows, the commit that
last changed the source. This is a stamped past-tense copy, not a claim to be current:
these rows move as the o-prime amends them (row 9 was amended twice while this packet sat
in review). Check whether yours is stale, and re-pull the live version, with:

```bash
dd get "docs/plans/001-dd-extraction/plan.dd.json#execution_guardrails"
git log -1 --format=%h -- docs/plans/001-dd-extraction/plan.dd.json   # newer than the stamp above? re-pull.
```

```
1. harness-engineering checkout is READ-ONLY reference — never write, build, or install there; the port basis SHA is recorded in phase 1 and rebased deliberately, never silently.

2. No npm publish, no --provenance, no tags, no releases — Jordan publishes. Landing on main + CI green IS authorized (Jordan 2026-08-07); conventional commits are load-bearing for release-please.

3. .the-flow-state.json / the-flow.json / the-flow.md are builder-owned — no hand writes, either repo.

4. src/app.ts registry is the convergence hot-spot: one phase in flight at a time lands registry edits; the PM serializes if pipelined phases both touch it.

5. .dd/schemas exemplar VALUES stay verbatim (dd-next #8-11: running the generator first turns the gate green over undetermined values — do not resolve the vocabulary as a side effect).

6. Every phase ends just checks green locally before handing to review; the dd status ledger must never claim a verb that does not work.

7. RENDERER AUTHORITY SPLIT (o-prime 2026-08-07, from the tk-0003 banner collision): from the tk-0003 landing commit onward, THIS repo documents are mutated/rendered ONLY by the LOCAL dd bin (set/add/rm/build) — upstream harness dd set/build on them is forbidden (its renderer silently regresses the banner). harness plan validate REMAINS the semantic authority (checks/gates/contradictions, per Jordan: plan checks stay harness-side); drift authority is LOCAL dd build --check. A harness-reported drift is adjudicated: local check green + banner-only diff = renderer skew (expected until koala swaps upstream), anything else = real. Window closes at handover.

8. OUT-OF-DIFF ASSERTION SWEEP (o-prime 2026-08-07, after TWO out-of-diff escapes: the write-family ledger gap and the CI package-smoke latent red): every review packet includes a repo-wide sweep for assertions about the changed behaviour living OUTSIDE the diff — CI configs, docs, ledgers, baked strings. Diff-scoped review is structurally blind there; the sweep is the reviewer floor, not a per-packet habit.

9. CORRECTION to the renderer-authority guardrail (measured by the PM): harness plan validate is NOT drift-affected — drift comparison is build alone. Blast radius of the banner skew = upstream write path + upstream dd build --check (E422 false-fail). The authority split stands; the harness-drift adjudication clause in the earlier row describes a case that cannot occur and is superseded here (append-only, prior row retained).

10. MEASURED-AT STAMPING (o-prime 2026-08-07; sharpened by the PM after the o-prime applied it to its own record). Any count or completeness claim in an execution-log entry, receipt, report, commit message, brief or flow comment carries the commit SHA it was measured at PLUS the re-derivation command. A claim without its SHA is an assertion, not a measurement, and re-rots silently as the repo moves. THE RULE BINDS AT THE MOMENT OF MAKING SOMETHING AUTHORITATIVE, not merely at the moment of counting: a loose wrong number costs nothing until someone puts it in a durable artifact, and whoever does that owns the defect regardless of who first said it. Instances: CI assertion, write-family ledger, sibling-count receipt, and the o-prime's own stale first-push premise. TENSE IS THE DISCRIMINATOR, NOT THE VALUE (o-prime + PM, after sweeping the orient-local defect for propagation and finding none). Three kinds of claim, and only one decays: a CONTRACT claim asserts a rule and never rots; a PAST-TENSE record stamped to a commit is correct forever, because it describes what was measured then; a PRESENT-TENSE state claim in a document meant to stay current has no expiry and no owner, and every instance of this class has had that shape. PROTECTIVE COROLLARY: never sweep stamped history. An auditor who 'fixes' phase-2's execution log for saying ported[validate,schema,docs] exit 2 would DESTROY EVIDENCE while believing they were removing rot — that entry is a correct historical record, and the stamp is precisely what makes it legible as history rather than as a stale current claim. Assert contracts, stamp states, and DERIVE anything that must read as current. THE STAMP CAN BE PERFORMED AS THEATRE (PM + reviewer, phase-4 review, the sharpest critique of this rule so far). The handover packet stated the push as 46 commits WITH THE RE-DERIVATION COMMAND PRINTED BENEATH IT — and that command does not produce 46: it gives 57 at the packet's own declared base, 58 at the review SHA, 59 on the next run. The figure was already stale at its own stamp. Printing a command beside a number does not make the number derived; the command was RECORDED, NOT RUN, so measured-at was satisfied in form and violated in substance. A stamp is evidence only if someone ran the thing at the moment they wrote it. For a fast-decaying value — a commit count, a branch delta, anything that moves every commit — even an honestly-run stamp is wrong by the time a reader arrives, so DO NOT STATE IT AT ALL: print the command and let it be the answer.

11. TYPECHECK IS NOT IMPLIED BY GREEN TESTS (PM-measured during the phase-3 fix round; fixed at c0af550): vitest STRIPS types, so a test file can be fully green while the test lane does not typecheck. 'The tests pass' is therefore NOT sufficient proof for a test-lane change — only just checks is. Binding on every remaining phase (all of them add tests) and on every reviewer accepting a test-lane diff.

12. CLAIM-OUTRAN-IMPLEMENTATION is the unifying defect class (named by the phase-3 coder, endorsed by the PM and o-prime 2026-08-07). The vacuous README guard, the stale CI package-smoke assertion, and the over-confident sibling-count receipt are ONE failure: a test or receipt whose CLAIM outran its IMPLEMENTATION, surviving review because the claim was read instead of the code. The coder's line is the rule: A GUARD'S DOCSTRING IS A HYPOTHESIS UNTIL A MUTATION REDS IT. Guardrails 7 (out-of-diff sweep), 9 (measured-at stamping) and this one are three instruments against the same class — cite this row when explaining why any of them exists.

13. AUTHORITY IS A SHA, NEVER A WORKING TREE (o-prime 2026-08-07, from a near-miss the PM caught). A ruling, brief, guardrail or constraint is actionable only as COMMITTED text that can be cited by SHA. Working-tree text is never authority, and a governance file read mid-write is actively dangerous: the coder read this plan's ESC-1 ruling out of the-flow.json while it was still being repaired, and the text it saw had two branch names missing to a shell-substitution defect. It refused to act and escalated, which is the second line of defence; NOT OPENING the file was the first, since flow files are a forbidden path in every packet. Two individually-survivable faults (a transcription loss and a read-mid-write) compound into a wrong implementation. Corollaries: verbatim-critical text travels as a file plus pointer, never as an argv string; and a ruling that arrives by any channel other than the recipient's own chain of command is not actionable, whatever it says.
```

<!-- END GENERATED: guardrails -->

### The standing constraints

Binding on **every seat in the dd subtree**, including seats that never saw koala's
original brief. They exist as a file because they previously lived only in the o-prime's
context — and the file says so plainly, including that the o-prime was not a reliable
place to keep them. You inherit a subtree where the constraints you wrote are citable by
number instead of living in one agent's memory.

<!-- BEGIN GENERATED: constraints (scripts/gen-handover-embeds.mjs) -->

**Reproduced verbatim as of `3343a09`** — 8 constraints,
the commit that last changed the source. Cite them BY NUMBER. Stamped past-tense copy:
check whether yours is stale, and re-pull, with:

```bash
git log -1 --format=%h -- government/standing-constraints.md   # newer than the stamp above? re-pull.
```

```
## 1 — harness-engineering is READ-ONLY reference

Never write it, never build or install there. Copy out of it only. The port basis SHA
is recorded in phase 1 and is rebased deliberately, never silently.

## 2 — No publish, no tags, no releases from agents

Jordan publishes. No `npm publish`. No `--provenance` experiments. Local commits only.
**Superseded for landing only** by Jordan's ruling of 2026-08-07: pushing `main` and
driving CI to green *is* authorized, and no PR is required. That ruling settles
**whether** we push — not the sequence, and not anything about releasing.

## 3 — Flow files are engine-owned and a forbidden path

`.the-flow-state.json`, `the-flow.json`, `the-flow.md` — never read or written by hand,
in either repo. builder guided mode is their sole writer. **Reading them is forbidden
too, not merely writing**: see guardrail "AUTHORITY IS A SHA, NEVER A WORKING TREE" for
the near-miss that proves why.

## 4 — Release workflows sit INERT until Jordan enables release

Verbatim from the brief: *"Release enablement (RELEASE_PLEASE_TOKEN + npm trusted
publisher) is Jordan's; the workflows sit inert until then."*

**"Fails closed" is not "inert."** A workflow that fires on push and goes red is not
inert — it is a false-alarm generator inherited by every future contributor, and by
koala. Gating such a workflow is *compliance with this constraint*, not a new policy
decision. (Applied 2026-08-07 as the ESC-1 ruling; see the phase-4 flow node.)

## 5 — The consume step is koala's, not ours

Handover completes when the SDK surface is stable and the packet is sent. Upgrading
harness-engineering to consume `@ai-substrate/dd` and stripping the old code is
**koala's work**. Never start it.

## 6 — Handover traffic is prime-to-prime

`pij-related-koala` is a peer prime. The PM prepares the handover packet; the **o-prime
sends it**. A worker messaging another fleet is the wrong altitude, and an unreviewed
packet makes our defects their problem.

## 7 — Human rulings are transcribed verbatim before anyone acts

Whoever receives a ruling from Jordan writes it verbatim into the durable artifact and
sends the other party the pointer **before** acting on it. Do not paraphrase a ruling
into an implementation.

## 8 — Open questions block only what depends on them

OQ-1 (SDK-as-library vs CLI-shelled) and OQ-2 (does `plan/` ship public) gate the
exports freeze — phase-4 `tk-0002` — and **nothing else**. Do not guess them, and do not
let them stall independent work.
```

<!-- END GENERATED: constraints -->

## 10. Status of this packet

**PREPARED, NOT SENT.** Handover traffic is prime-to-prime (standing constraint 6): the
PM signals packet-ready after review and the o-prime sends it. This file is the pointer.

**Not done and deliberately so**: `tk-0002` (exports freeze — HELD on OQ-1/OQ-2) and
`tk-0006` (the push to `origin/main` — gated on review plus explicit go).

The push is a **fast-forward** onto an existing `origin/main` at `b1b794d`, which **is**
an ancestor of local `main` — no rewrite, no force. **The commit count is deliberately
not written here.** Run the command; it rises with every commit, so any number printed
in this document would be wrong before you read it:

```bash
git merge-base --is-ancestor origin/main main && echo "fast-forward, no force needed"
git rev-list --count origin/main..main
```

This paragraph previously carried a standing figure with that command printed directly
beneath it — and the figure did not match its own command **at its own stamped base**.
It is worth stating rather than quietly correcting, because it is the subtlest instance
in §7 and the one that indicts the guardrail itself: **stamping a figure with a
re-derivation command does not make it derived.** The command was recorded, not run.
Measured-at stamping was performed *as a claim*, which turned the instrument against
this defect class into an instance of it. The repair is not a better number — it is the
tense rule from §0.1: a count in a document meant to read as current gets **derived**,
never asserted.
