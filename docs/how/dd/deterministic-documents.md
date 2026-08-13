<!-- Ported verbatim from the baked `ddocs docs` corpus (`src/docs/content/deterministic-documents.md`).
     The CLI carries the same text: `ddocs docs get deterministic-documents`. Edit the SOURCE, then run
     `npm run gen:dd-docs` — `npm run check:dd-docs` fails the build on drift. -->

# Deterministic documents

A deterministic document is one document with two faces. The source is a `.dd.json` file:
structured data with a declared schema, where every list row has a permanent id and every state
comes from a controlled vocabulary. Beside it sits a generated `.dd.md` sibling that renders as
ordinary markdown — headings, tables, `[x]` marks. People and GitHub read the markdown; tools
read the JSON; the CLI keeps the two in lockstep.

If you are an agent meeting a dd mid-task, the two rules that keep you safe:

1. **Never hand-edit a `.dd.md` file.** It is generated. Your edit will be flagged as drift
   (`E422`) and overwritten by the next build.
2. **Write through the CLI** — `ddocs set`, `ddocs add`, `ddocs rm`. It validates before writing, refuses
   bad values with nothing written, and regenerates the sibling in the same operation. Editing
   the `.dd.json` by hand is allowed, but then you owe a `ddocs build`.

Everything below was run with the `ddocs` CLI in this repository; the outputs are real
(long absolute paths shortened to filenames).

## Why this exists

Teams already draw graphs in their documents: a plan whose acceptance criteria link to tasks,
tasks that link to evidence, phases that gate on all of it. In plain markdown that graph is
soft — held together by relative links and good intentions. You cannot link to a list item,
a checkbox is a keystroke anyone can type, and "make sure every criterion is linked to the task
that completed it" is a plea to the agent, hoping it holds the structure in its head.

A dd hardens that graph into data. Rows get addresses you can link to. Links get types a
validator checks. States get vocabularies a schema declares. "Which criteria are still open?"
stops being a judgment call over prose and becomes a query that returns rows, with ids.

## A small corpus

Three documents: a plan with acceptance criteria, the tasks that satisfy them, and a log holding
evidence. Here is the plan source, in full:

```json
{
  "dd": { "schema": "guide/plan" },
  "sections": [
    { "name": "meta", "value": { "title": "Search rollout" } },
    { "name": "acceptance_criteria", "value": [
      {
        "id": "ac-1a2b",
        "claim": "Queries under 100ms at p95",
        "state": "checked",
        "proven_by": "log.dd.json#entries/lg-3c4d"
      },
      {
        "id": "ac-5e6f",
        "claim": "Index rebuild is idempotent",
        "state": "unchecked"
      }
    ] }
  ],
  "references": []
}
```

The envelope is always this shape: `dd.schema` names a schema, resolved by folder convention
(the document's own folder, then `<gitroot>/.dd`, then `<gitroot>/.harness/.dd`, then `~/.dd` —
first hit wins). `sections` is an ordered list of named slots the schema shapes. `references`
is the basis ledger, covered by the freshness commands.

`ddocs build plan.dd.json` writes the generated face:

```markdown
# Search rollout

**Schema**: guide/plan · **Source**: plan.dd.json · **Sections**: 2

## Acceptance criteria

| id | claim | state | note | receipt | proven_by |
| --- | --- | --- | --- | --- | --- |
| ac-1a2b | Queries under 100ms at p95 | [x] checked | — | — | [lg-3c4d](log.dd.md#entries) |
| ac-5e6f | Index rebuild is idempotent | [ ] unchecked | — | — | — |
```

That `proven_by` cell started as an address string in the JSON and rendered as a working link.
The `[x]` marks are read out of `state`, at render time, from the vocabulary the schema declares.

## Everything has an address

`file#name/id/name/id…` — one `#`, then alternating section names and instance ids:

```bash
ddocs get "plan.dd.json#acceptance_criteria/ac-1a2b/state"
```

```json
{ "command": "ddocs get", "status": "ok",
  "data": { "address": "plan.dd.json#acceptance_criteria/ac-1a2b/state",
            "trail": ["acceptance_criteria", "ac-1a2b", "state"],
            "kind": "part", "value": "checked" } }
```

It is honest JSON underneath, so `jq` answers the same question the same way:

```bash
jq -r '.sections[] | select(.name=="acceptance_criteria")
       | .value[] | select(.id=="ac-1a2b") | .state' plan.dd.json
# checked
```

Ids are born once and never reused, so addresses survive editing. Reverse the order of the
criteria rows in the JSON and the same `ddocs get` returns the same value — the address names the
row by id, never by position. This is what plain markdown cannot do: there is no way to link to
a list item, and renumbering breaks whatever convention you invented instead.

Do not invent ids by hand. `ddocs add --mint` picks a collision-free one under a registered prefix:

```bash
ddocs add "plan.dd.json#acceptance_criteria" \
  '{"claim": "Rollback drill rehearsed", "state": "unchecked"}' --mint ac
# → "minted": "ac-5e70", "written": true, "sibling_regenerated": true
```

## Links are typed, and the validator checks the type

In the tasks schema, `satisfies` is declared as a link with a target type:

```json
"satisfies": {
  "type": "array",
  "items": {
    "type": "link",
    "target": "guide/plan/section/acceptance_criteria",
    "rel": "satisfies"
  }
}
```

Point one of those links at the wrong kind of row — a log entry, say — and validation refuses
with the exact mismatch:

```bash
ddocs validate tasks.dd.json
```

```json
{ "status": "error",
  "error": { "code": "E406",
    "message": "link targets \"guide/log/section/entries\", expected \"guide/plan/section/acceptance_criteria\"" },
  "next_action": "Fix tasks.dd.json at $.sections[tasks].value[0].satisfies[0], then re-run `ddocs validate tasks.dd.json`." }
```

Because links carry a relation (`satisfies`, `proven_by`, …), the graph is walkable in both
directions. "Which tasks claim this criterion?" is one command:

```bash
ddocs links "plan.dd.json#acceptance_criteria/ac-1a2b"
```

```json
{ "inbound": [
    { "from": "tasks.dd.json", "address": "plan.dd.json#acceptance_criteria/ac-1a2b",
      "location": "$.sections[tasks].value[0].satisfies[0]", "rel": "satisfies" } ],
  "outbound": [
    { "to": "log.dd.json", "address": "log.dd.json#entries/lg-3c4d",
      "location": "$.sections[acceptance_criteria].value[1].proven_by", "rel": "proven_by" } ] }
```

The claim, the task that satisfies it, and the log entry that proves it: three documents, one
traversal. `ddocs graph` emits the same structure as a mermaid diagram — this corpus comes back as:

```text
flowchart LR
  n0["log.dd.json"]
  n1["plan.dd.json"]
  n2["tasks.dd.json"]
  n1 -->|proven_by| n0
  n2 -->|satisfies| n1
  n2 -->|satisfies| n1
```

## The writer refuses bad values, and writes nothing

States come from a vocabulary. The built-in completion enum is `unchecked`, `checked`,
`blocked`, `human-skipped`, `na` — and a schema may declare its own. Feed the writer a value
outside the vocabulary:

```bash
ddocs set "plan.dd.json#acceptance_criteria/ac-5e6f/state" done
```

```json
{ "status": "error",
  "error": { "code": "E451",
    "message": "the change would make plan.dd.json invalid: value \"done\" is not in unchecked, checked, blocked, human-skipped, na",
    "details": { "reason": "schema-refused", "written": false } } }
```

Some states carry obligations — `blocked` and `na` require a note, `human-skipped` requires a
receipt with the human's verbatim words — and the writer holds those too:

```bash
ddocs set "plan.dd.json#acceptance_criteria/ac-5e6f/state" blocked
# → E451: state "blocked" requires a non-empty note   (written: false)
```

A valid write goes through, and the markdown face updates in the same operation:

```bash
ddocs set "plan.dd.json#acceptance_criteria/ac-5e6f/state" checked
# → "written": true, "sibling_regenerated": true
grep ac-5e6f plan.dd.md
# | ac-5e6f | Index rebuild is idempotent | [x] checked | — | — | — |
```

This is what a completion gate reads. Each state vocabulary declares a `gate_terminal` set
(by default `checked`, `human-skipped`, `na`), and "done" means membership in that set — a
mechanical check over rows, with every open item nameable by id. One warning about
authority: a row's typed `state` and a summary derived from the assertion rows it links to
are separate claims, and `ddocs validate` does not reconcile them — a task can say `checked`
over an all-`unchecked` assertion list without raising a finding. When the two disagree,
believe the derived summary; it is the one computed from rows. The flow-level gate that
refuses to leave a phase while criteria are open is built on exactly this layer; the gate
verbs themselves live upstream in `harness`, not in this package.

## The rendered view cannot drift

Hand-edit the `.dd.json` (or the `.dd.md`) and the two faces disagree. The check catches it:

```bash
ddocs build plan.dd.json --check
```

```json
{ "status": "error",
  "error": { "code": "E422",
    "message": "plan.dd.md drifted from the render of plan.dd.json" },
  "next_action": "Regenerate with `ddocs build plan.dd.json` and commit the result." }
```

`ddocs build plan.dd.json` regenerates the sibling and the check goes green. Run the check in CI
and a stale rendered view cannot land. CLI writes never owe a build — `set`, `add`, and `rm`
regenerate the sibling themselves.

## The doctor sweeps the whole corpus

`ddocs doctor` discovers every dd document in the repository and validates the lot:

```bash
ddocs doctor
# → "discovered": 3, "swept": 3, "counts": { "error": 0, "warn": 0 }, "findings": []
```

The answer is either zeros or a named list of findings, each carrying its severity, its
location, and the owner — the document that must change to fix it, which is not always the one
where the problem surfaced.

A document can ask the sweep to skip it: `"sweep_exclude": true` in its `dd` envelope. The
doctor honours it — this corpus with one document excluded answers `"discovered": 3,
"swept": 2` — but a direct `ddocs validate <path>` never does: pointing the verb at a document
always validates it, and the excluded document above still fails its own validate with `E402`.

## How commands answer

Every verb returns one envelope: `status` (`ok` exits 0, `degraded` 0, `unconfigured` 2,
`error` 1), `data`, an `error` with a stable `E`-code when something failed, and a
`next_action` telling you what to do about it — required on every non-`ok` answer. Piped
output selects JSON automatically; `--json` / `--no-json` force it either way. As an agent you
can drive the whole surface without parsing prose.

## Where to go next

- **Root `README.md`** — install, and a complete quick start: write a schema with a custom
  vocabulary, a document against it, then validate, build, and mutate. The repository executes
  it as a test, so it cannot rot.
- **`ddocs docs get how-to-add-a-schema`** — the worked schema package: custom enums,
  `gate_terminal`, the `human-skipped` receipt convention, and a custom render adapter.
- **`ddocs docs get how-to-use-and-extend-the-sdk`** — consuming dd as a library: the import
  tiers, the fs/hash ports you bring, and how the public surface grows.
- **`ddocs docs get dd-overview`** — the reference tour: the envelope fields, id grammar, schema
  resolution and shadowing, completion states, and jq recipes.
- **`ddocs docs list`** — this corpus, baked into the binary, readable with no checkout and no
  network.

The deeper reference set (eleven chapters) and the worked `exemplar/` corpus live upstream in
`AI-Substrate/harness-engineering` and have not been ported here. What runs locally is what
this page just showed you, plus the root quick start and the test-fixture corpora under
`test/`.
