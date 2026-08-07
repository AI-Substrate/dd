# Handover packet — `@ai-substrate/dd` → `pij-related-koala`

**From**: plan 001 (dd extraction), phase 4 `tk-0005` · **To**: `pij-related-koala`
**Repo**: `AI-Substrate/dd` · **Prepared**: 2026-08-07
**Measured at**: `99e4157` unless a row says otherwise. Every count below carries the
command that re-derives it, because a count without its SHA is an assertion rather than
a measurement and re-rots silently as the repo moves.

**What this packet is.** Everything needed to swap `harness dd …` for the `dd` binary,
including the parts that are **not done**. Read section 2 first — it is the incomplete
one, and it is stated up front deliberately.

**What this packet is not.** It is not a claim that the extraction is finished. The
consume step — upgrading harness-engineering onto this package and stripping the old
code — is yours and has not been started (standing constraint 5).

---

## 1. The artifact

| | |
|---|---|
| Package | `@ai-substrate/dd` |
| Version | `0.1.0` (unpublished — see §2.2) |
| Bin | `dd` → `bin/dd.js` |
| Tarball | `ai-substrate-dd-0.1.0.tgz`, 257,573 bytes, 274 files |
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

Measured at `99e4157`; re-derive with `just checks`, `just pack-gate`,
`harness plan validate docs/plans/001-dd-extraction/plan.dd.json`.

| Gate | Result | What it proves |
|---|---|---|
| `just checks` | 703 tests, 59 files, exit 0 | lint, build, typecheck, docs-drift, self-host, tests |
| `just pack-gate` | exit 0 | the TARBALL works: clean clone → pack → install → drive the installed bin, including a jiti-loaded custom render type written in untranspiled TypeScript |
| `just self-host` | 6 documents, zero drift | dd renders this repo's own plan corpus |
| `harness plan validate` | 0 ERROR, 6 WARN | semantic gate; WARNs are open-item contradictions, not defects |
| Coverage | 70.21% statements | report-only, not gated |

**Three properties of this repo worth keeping**, offered as things that earned their
place rather than as decoration:

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

3. **A guard that caught its own author, unprompted.** Adding the self-host gate to
   `just checks` immediately reddened the parity guard for a **real** missing CI step —
   not a rehearsed mutation, a genuine omission committed minutes earlier. A guard that
   catches the person who wrote it is proven rather than asserted.

## 7. What is still costing us attention

Three plan guardrails cover the class where **a claim outran its implementation** — a
docstring, a comment or a receipt asserting something no code checks. That class was
caught **three times** during this extraction (a CI assertion, a write-family ledger, a
sibling-count receipt), and once more in review when a README guard turned out to
re-type the commands it claimed to execute.

Only one of the three is even partly mechanized — the `na`-requires-a-reason rule in §6.
**OUT-OF-DIFF SWEEP** and **MEASURED-AT STAMPING** are still pure discipline: nothing
fails today if a reviewer skips the sweep or a receipt omits its SHA. Both have a known
shape (a gate over assertions naming behaviour changed outside the diff; a linter
requiring every count-claim to carry a resolvable SHA), and both are carried as backlog
item 19.

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
| Open backlog, 21 items, annotated | `docs/backlog.md` |
| Wire format + renderer authority + measured behaviour | `docs/plans/001-dd-extraction/assets/handover-notes.md` |
| Import-direction audit, all 60 tests | `docs/plans/001-dd-extraction/assets/test-audit.md` |
| Frozen P1 CLI surface | `docs/plans/001-dd-extraction/assets/dd-surface.md` |
| Research dossier (F-04 consumer surface) | `docs/plans/001-dd-extraction/assets/research-dossier.md` |
| The plan itself | `docs/plans/001-dd-extraction/plan.dd.md` |
| Quick start (executed as a test) | `README.md` |

**`docs/backlog.md` carries 21 items**: the 17 migrated from `scratch/dd-next.md`
verbatim, plus 4 opened during the extraction. **OPEN items are still OPEN** — the
migration deliberately answered nothing. The `#8-before-#11` ordering constraint is
carried verbatim: running 11 first turns the gate green over three documents holding
undetermined values, and the green then argues the vocabulary is consistent.

**`government/standing-constraints.md` is worth your attention specifically.** It exists
because these constraints previously lived only in the o-prime's context, and it says so
plainly — including that the o-prime was not a reliable place to keep them. You inherit
a subtree where the constraints you wrote are citable by number instead of living in one
agent's memory.

---

## 9a. The execution guardrails, VERBATIM

Reproduced in full rather than summarised, because koala asked to see them and has
adopted its own version — a rule someone intends to cite has to arrive citable, or the
quoted version stops matching the enforced one. Source of truth:
`docs/plans/001-dd-extraction/plan.dd.md#execution_guardrails` (13 rows, measured at
`c53c85a`; re-derive with `dd get "docs/plans/001-dd-extraction/plan.dd.json#execution_guardrails"`).

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

10. MEASURED-AT STAMPING (o-prime 2026-08-07; sharpened by the PM after the o-prime applied it to its own record). Any count or completeness claim in an execution-log entry, receipt, report, commit message, brief or flow comment carries the commit SHA it was measured at PLUS the re-derivation command. A claim without its SHA is an assertion, not a measurement, and re-rots silently as the repo moves. THE RULE BINDS AT THE MOMENT OF MAKING SOMETHING AUTHORITATIVE, not merely at the moment of counting: a loose wrong number costs nothing until someone puts it in a durable artifact, and whoever does that owns the defect regardless of who first said it. Instances: CI assertion, write-family ledger, sibling-count receipt, and the o-prime's own stale first-push premise.

11. TYPECHECK IS NOT IMPLIED BY GREEN TESTS (PM-measured during the phase-3 fix round; fixed at c0af550): vitest STRIPS types, so a test file can be fully green while the test lane does not typecheck. 'The tests pass' is therefore NOT sufficient proof for a test-lane change — only just checks is. Binding on every remaining phase (all of them add tests) and on every reviewer accepting a test-lane diff.

12. CLAIM-OUTRAN-IMPLEMENTATION is the unifying defect class (named by the phase-3 coder, endorsed by the PM and o-prime 2026-08-07). The vacuous README guard, the stale CI package-smoke assertion, and the over-confident sibling-count receipt are ONE failure: a test or receipt whose CLAIM outran its IMPLEMENTATION, surviving review because the claim was read instead of the code. The coder's line is the rule: A GUARD'S DOCSTRING IS A HYPOTHESIS UNTIL A MUTATION REDS IT. Guardrails 7 (out-of-diff sweep), 9 (measured-at stamping) and this one are three instruments against the same class — cite this row when explaining why any of them exists.

13. AUTHORITY IS A SHA, NEVER A WORKING TREE (o-prime 2026-08-07, from a near-miss the PM caught). A ruling, brief, guardrail or constraint is actionable only as COMMITTED text that can be cited by SHA. Working-tree text is never authority, and a governance file read mid-write is actively dangerous: the coder read this plan's ESC-1 ruling out of the-flow.json while it was still being repaired, and the text it saw had two branch names missing to a shell-substitution defect. It refused to act and escalated, which is the second line of defence; NOT OPENING the file was the first, since flow files are a forbidden path in every packet. Two individually-survivable faults (a transcription loss and a read-mid-write) compound into a wrong implementation. Corollaries: verbatim-critical text travels as a file plus pointer, never as an argv string; and a ruling that arrives by any channel other than the recipient's own chain of command is not actionable, whatever it says.
```

The eight standing constraints are likewise reproduced in full at
`government/standing-constraints.md` and are cited **by number** across this subtree.
Read that file directly rather than any summary of it, including this one.

## 10. Status of this packet

**PREPARED, NOT SENT.** Handover traffic is prime-to-prime (standing constraint 6): the
PM signals packet-ready after review and the o-prime sends it. This file is the pointer.

**Not done and deliberately so**: `tk-0002` (exports freeze — HELD on OQ-1/OQ-2) and
`tk-0006` (the push to `origin/main` — gated on review plus explicit go). The push is a
fast-forward of 46 commits onto an existing `origin/main` at `b1b794d`, which **is** an
ancestor of local `main` — no rewrite, no force. Re-derive:

```bash
git merge-base --is-ancestor origin/main main && git rev-list --count origin/main..main
```
