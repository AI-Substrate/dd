# Workshop: Schema editing verbs — first-class CRUD for sections, columns, enums, and marks

**Type**: CLI Flow + Data Model
**Plan**: 003-tally-columns
**Spec**: `../../original-ask.md` (rulings record; plan doc pending retroactive 1b)
**Created**: 2026-08-12
**Status**: Draft — awaiting Jordan's ruling on the write-vs-print question (Q1)

**Value Thesis**: Today a schema is authored by hand-editing JSON against an allow-list
parser that silently discards unknown keys; every agent that marks a tally column without
tooling walks the same minefield that ate `valuesShape`, nearly shipped `rel` inert, and
would have shipped `tally` dead. First-class verbs move that knowledge out of every
agent's context and into one validated surface.
**Target Proof Level**: Contract Ready
**Current Proof Level**: Contract Ready (verb roster, grammar, refusals, and error classes
specified; unruled items tracked in Open Questions)

**Selected Value Axes**:
- **Agent Readiness**: an agent marks a column with one command instead of learning shape-JSON layout from `dd docs get how-to-add-a-schema`.
- **Safety to Change**: destructive ops refuse with a measured document count instead of silently orphaning data.
- **Proof Quality**: every mutation validates against `parseShape`'s own rules *before* the write, and `dd schema show` proves it after.
- **Cost / Attention Reduction**: the resolution-ladder question ("which of four files is *the* schema?") is answered by the verb, not by every caller.

**Related Documents**:
- `../../original-ask.md` — the rulings this plan already carries.
- `src/schema/declarations.ts:104` (worktree) — `parseShape`, the allow-list every mutation must respect.
- `.harness/government/rulings/2026-08-09-semantic-ontology-leaves-dd.md` (main checkout) — why dd ships mechanisms, not vocabulary.

---

## Purpose

Resolve the design of dd's first schema-write surface before any implementation: what
verbs exist, what they refuse, which file they write, and where the line sits between a
safe toggle and schema surgery. Drives Jordan's pending ruling (Q1) and, once ruled,
hands the implementer a contract instead of a discussion.

## Fresh Entrant Outcome

A fresh human or agent should be able to use this workshop to reach **Contract Ready**
with no additional context. They should be able to:

- Name every proposed verb, its arguments, and its refusal conditions.
- Say which file on the resolution ladder a mutation writes, and why.
- Say why `rm-col` refuses without `--force` and what the count in its refusal means.
- Say what was deliberately omitted and why.

## Key Questions Addressed

- How does an agent turn tally marking (and schema authoring generally) into commands instead of hand-edits?
- Where is the boundary between a cheap, reversible toggle and expensive schema surgery?
- Which rung of the four-root resolution ladder does a write target?
- What stops a destructive schema change from silently orphaning document data?

---

## Value Frame

| Field | Selection | Why It Matters |
|-------|-----------|----------------|
| Target Proof Level | Contract Ready | Implementation follows a ruled contract; Jordan's Q1 ruling is the gate, not more design |
| Primary Value Axis | Agent Readiness | The feature exists because Jordan asked for "first class tooling to assist agents" |
| Supporting Value Axes | Safety to Change, Proof Quality | The write surface is dd's first schema mutation ever; safety properties must be chosen, not inherited |
| Downstream Loop Improved | Agent execution + review | An agent's schema change becomes one auditable envelope instead of a hand-diff a reviewer must reconstruct |

## Evidence Ledger

| Evidence | Location | Supports | Status |
|----------|----------|----------|--------|
| Schema primitive roster (12 shape keys, 11 types) | § Primitives | verb legality matrix | Ready |
| Existing verb asymmetry (16 verbs; schema side read-only) | § The asymmetry | why CRUD, why now | Ready |
| Verb roster + grammar | § Command Summary | the contract | Ready |
| Refusal matrix + error classes | § Refusals | envelope behaviour | Ready |
| Winning-rung rule | § Which file | ladder safety | Ready |
| Doctor-backed impact check | § Destructive ops | data-loss prevention | Ready |
| Worked agent flow (tally marking end-to-end) | § Quick Reference | agent readiness | Ready |
| Q1 ruling (write vs print) | Open Questions | everything downstream | **Missing — Jordan** |

## Decision Space

| Option | Description | Pros | Cons | Decision |
|--------|-------------|------|------|----------|
| A. Print-don't-write | Verbs compute + print the edited JSON and target path; agent applies with its own tools | Zero new write surface; zero blast radius; dd stays a schema reader | Two-step for every edit; agent can mangle the apply; audit trail split across tools | Rejected in discussion — superseded by C once scoping emerged, but **formal ruling is Q1** |
| B. Generic addressed write (`dd schema set <json-path> <value>`) | One verb, raw path grammar into schema JSON | Smallest surface; mirrors document `set` | Hand-editing with extra steps: skips domain validation, reintroduces surgery risk, agent must still know shape layout | **Rejected** — deliberate omission, recorded below |
| C. Domain-shaped CRUD verbs (this workshop) | Verbs named for schema nouns (section, column, enum, mark); each validates its own mutation class | Legal mutations = `parseShape`'s own vocabulary; refusals speak the domain; toggle/surgery line enforceable per verb | Larger verb count; dd becomes a schema writer (capability-class change) | **Preferred — awaiting Q1 ruling** |

## The asymmetry this fixes (measured, 2026-08-12)

Documents have addressed CRUD (`get/set/add/rm`), proof (`validate/doctor/build --check`),
graph (`address/link/links/graph`), render (`build`) — every mutation staged, validated
before write, atomic with the sibling. Schemas have `schema list`, `schema show`,
`docs get how-to-add-a-schema` — **read-only inspection**. A schema has no address
grammar, no writer, no refusal path. `src/acts/schema.ts` contains no filesystem write;
dd has **never written a schema**. Every safety property on the document side was built
deliberately; the schema side inherits none of them until someone chooses.

## Primitives the verbs govern (ground truth: `parseShape`'s allow-list)

Types (11): `array bool enum int link number object state string text` + open-namespace
custom (adapter-rendered). Shape keys (12): `type fields required items values enum
gate_terminal target rel valuesShape allowAdditional tally`. Section level: `required`,
`title`. Schema level: `description`, named `enums`, `dd_schema`.

**The toggle/surgery line** (load-bearing for verb design):

| Class | Keys | Verb character |
|---|---|---|
| **Flippable marks** — reversible, absence is the status quo, worst case caught by validate | `tally`, `required` (per-field), `allowAdditional`, `gate_terminal` membership, `rel` | cheap toggles; refuse-and-explain; no impact sweep needed |
| **Structure** — reshapes data, can orphan or invalidate stored values | `type`, `fields` (add/rm/rename), `items`, sections, enums | doctor-backed impact check; `--force` for destructive |

---

## Command Summary

| Command | Class | Purpose |
|---------|-------|---------|
| `dd schema new <pkg>/<name> --description "..."` | create | scaffold a whole schema package at the chosen root |
| `dd schema add-section <schema> <section> [--table\|--object\|--text] [--required] [--title "..."]` | create | add a section shape |
| `dd schema add-col <schema> <section> <col> --type <t> [--required] [--values a,b,c] [--tally in\|total] [--rel <r>] [--target <t>]` | create | add a column (field on the table's item shape) |
| `dd schema add-enum <schema> <name> --values v1,v2 [--terminal v2]` | create | add a named, shared enum |
| `dd schema mark <schema> <section> <col> --tally in\|total\|off` | toggle | the flip family — tally today; the pattern for future marks |
| `dd schema set-col <schema> <section> <col> [--type <t>] [--required <bool>] [--rel <r>] ...` | update | change a column's declaration |
| `dd schema set-section <schema> <section> [--required <bool>] [--title "..."]` | update | change section metadata |
| `dd schema rename-col <schema> <section> <old> <new>` | update+migrate | rename, with offered document migration |
| `dd schema rm-col <schema> <section> <col>` | destroy | remove a column — impact-checked |
| `dd schema rm-section <schema> <section>` | destroy | remove a section — impact-checked |

All verbs: resolve the **winning rung**, validate against `parseShape`'s own rules
**before** any write, stage `.tmp`+rename, answer in the standard envelope with the
path written. `--json` everywhere, exit codes per the frozen envelope contract.

## Which file — the winning-rung rule

The ladder is `doc-folder → gitroot → harness → home`. Every write verb:

1. Resolves the schema exactly as `schema show` does.
2. **Writes the winning rung only** — the file `schema show` reports as authoritative.
3. **Refuses if the name is shadowed** (a lower rung also defines it): editing the winner
   silently changes behaviour relative to what a different machine resolves; editing the
   loser is a no-op that looks like an edit. The refusal names both paths and the
   `next_action` is to resolve the shadow first — dd already classes shadowing as
   `degraded`, so the verb refuses to *deepen* a condition dd reports as a defect.
4. `dd schema new` alone takes `--root gitroot|doc-folder|harness|home` (default
   `gitroot`) because creation has no winner to follow.

## Destructive ops — the doctor-backed impact check

`rm-col`, `rm-section`, `set-col --type`, and `rename-col` can orphan or invalidate
stored document data. Before writing, the verb sweeps documents resolving to the schema
(the `doctor` machinery, scoped to one schema — no new sweep engine) and refuses with
the measured count:

```
$ dd schema rm-col probe/week days mon
E4xx  3 document(s) carry values under "days.mon":
        docs/plans/weekly.dd.json (5 rows)
        ...
      Removing the column strands those values as undeclared fields.
      → re-run with --force to proceed; values become undeclared (visible to render, invisible to validate)
```

`--force` proceeds and the envelope records what was stranded. A clean sweep (0 carriers)
writes without ceremony. `rename-col` additionally offers `--migrate`: rewrite the key in
every carrier document **through the existing document writers** (`writeDocumentWithSibling`
per document — atomic, sibling in lockstep), so the migration inherits the crash-safety
the document side already paid for.

## Refusals (each maps to one frozen E-code; allocation negotiated against the manifest at implementation, same as E463 was)

| Refusal | Trigger | Class |
|---------|---------|-------|
| unknown schema | name resolves nowhere on the ladder | existing E401 family |
| shadowed write | winning rung has a lower-precedence duplicate | new: schema-shadowed-write |
| illegal mark | `--tally in` on a non-numeric column; second `total` column; `rel` on a non-link | mirrors `parseShape`'s own fail() classes — the verb enforces at write time exactly what resolution enforces at read time |
| unknown key/type | verb would write a key `parseShape` discards | structurally impossible by design — verbs only speak the allow-list; this is the whole point |
| destructive without force | impact sweep found carriers | new: schema-impact-refused |
| enum in use | `rm` of an enum a column references | new: schema-enum-referenced |
| structural conflict | duplicate column, duplicate section, rename target exists | new: schema-conflict |

## Deliberate omissions (scored, not skipped)

- **No generic `dd schema set <json-path>`** — Option B above. It reintroduces every
  hazard the domain verbs exist to remove.
- **No `dd schema rm <pkg>/<name>`** (whole package) — deleting a schema out from under
  its documents is a git operation someone should feel.
- **No `--fix` on validate, still** — the tally ruling's boundary is unchanged by this
  workshop.
- **No schema versioning/migration framework** — `dd_schema: 1` stays frozen; this
  surface edits within the version, never across versions.

## Quick Reference — the agent flow this exists for

```bash
dd docs get how-to-add-a-schema         # learn (existing; page gains a tally + verbs section)
dd schema new probe/week --description "timesheet"
dd schema add-section probe/week days --table
dd schema add-col probe/week days task --type string --required
dd schema add-col probe/week days mon  --type number --tally in
dd schema add-col probe/week days total --type number --tally total
dd schema show probe/week               # prove (existing verb, unchanged)
dd add 'week.dd.json#days' '{"task":"triage","mon":2}'   # tally materialises on write
dd validate week.dd.json                # stored tally proven against rows (E463)
```

Zero hand-edits, zero shape-JSON knowledge, every step refusable and auditable.

## Attention Reduction

| Future Loop | Before Workshop | After Workshop |
|-------------|-----------------|----------------|
| Agent schema edit | read the how-to, hand-write JSON, hope the key survives the allow-list | one verb, validated before write, proven after |
| Review | reconstruct a hand-diff's legality against `parseShape` from memory | read one envelope; refusals already enforced the rules |
| Implementation (of this feature) | re-derive the toggle/surgery line and ladder semantics | verb table + refusal matrix are the contract |
| Data-loss incident response | discover orphaned values after the fact | the impact count appeared in the refusal before the write |

## Open Questions

### Q1: Does dd write schemas, or print what to write? — **OPEN, Jordan's ruling**

The capability-class finding (dd has never written a schema; document-side safety
properties have no schema analogue; blast radius spans every resolving document) is with
Jordan alongside the zero-write alternative. This workshop specifies Option C so the
ruling is over a concrete contract, not an abstraction. **Nothing below implementation
starts before this is ruled.**

### Q2: Float precision policy — **OPEN, Jordan's, separate thread**

Unrelated to this surface but gates the tally feature's final form. Seam:
`roundToDataPrecision`, `src/core/tally.ts:81` (worktree), one function body.

### Q3: Does `rename-col --migrate` land in v1? — **OPEN, scoping**

It is the one verb that composes schema CRUD with document CRUD. Shippable without it
(rename refuses with the carrier count; agent migrates by hand through document verbs);
including it is where the crash-safety story gets tested for real.

## Validation / Acceptance

This workshop reaches its target proof level when:

- Jordan can rule Q1 by reading § Decision Space + § Refusals alone. ✅ (structure in place)
- An implementer can build any single verb from its row + § Which file + § Refusals without opening this conversation. ✅
- The reviewer of that implementation can check refusal behaviour against the matrix rather than reconstructing intent. ✅
- Q1 ruled → status moves Draft → Approved and the plan's phase list gains the verb work. ⏳
