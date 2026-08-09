# dd — deterministic documents

[![CI](https://github.com/AI-Substrate/dd/actions/workflows/ci.yml/badge.svg)](https://github.com/AI-Substrate/dd/actions/workflows/ci.yml)

Validate, render, address and inspect structured documents.

A **deterministic document** is a `.dd.json` file: structured data with a schema, addressable
parts, and per-assertion state. The `.dd.md` beside it is *generated* — humans read the markdown,
tools read the JSON, and neither has to trust prose.

The point is that "done" stops being a claim in a paragraph and becomes a row you can query, with
a schema that says what the states mean and a gate that reads them.

## Install

Two routes, both supported. From the registry:

```bash
npm install -g @ai-substrate/dd     # the `dd` binary on your PATH
npm install @ai-substrate/dd        # or as a library
```

And straight from git — the route that matters when a registry proxy screens new versions for
days at a time, or when you want a branch the registry has not seen. As a library dependency it
is one line; the package builds itself on install:

```bash
npm install git+https://github.com/AI-Substrate/dd.git
```

For the global binary from git, install from a clone:

```bash
git clone https://github.com/AI-Substrate/dd.git
cd dd
npm install
npm install -g .
```

`npm install -g git+<url>` in one step does not work today — npm's staging of a global git
install breaks the TypeScript build that `prepare` runs (`TS2688`, the dev types are not
visible). The clone route above is the supported path to a git-fresh binary.

Requires Node **>= 22**. The only runtime dependencies are `commander` and `jiti`.

```bash
dd --version
dd --help
```

## Quick start

Create a schema. The qualified name comes from the **path**, never from the file, so a copied
package cannot misreport its identity:

```bash
mkdir -p .dd/schemas/review/checklist
cat > .dd/schemas/review/checklist/schema.json <<'JSON'
{
  "dd_schema": 1,
  "description": "A review checklist whose items are approved or waived, not ticked.",
  "enums": {
    "review": {
      "values": ["draft", "in-review", "approved", "waived"],
      "gate_terminal": ["approved", "waived"]
    }
  },
  "sections": {
    "meta": {
      "required": true,
      "shape": { "type": "object", "required": ["title"], "fields": { "title": { "type": "string" } } }
    },
    "items": {
      "shape": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["id", "state"],
          "fields": {
            "id": { "type": "string" },
            "claim": { "type": "text" },
            "state": { "type": "state", "enum": "review" },
            "note": { "type": "string" }
          }
        }
      }
    }
  }
}
JSON
```

Write a document against it:

```bash
cat > review.dd.json <<'JSON'
{
  "dd": { "schema": "review/checklist" },
  "sections": [
    { "name": "meta", "value": { "title": "Release review" } },
    { "name": "items", "value": [
      { "id": "dw-11c2", "claim": "Migration is reversible", "state": "approved" },
      { "id": "dw-4e01", "claim": "Council sign-off", "state": "waived", "note": "no council for internal tooling" }
    ] }
  ],
  "references": []
}
JSON
```

Then check it, render it, and change it — without ever hand-editing the markdown:

```bash
dd validate review.dd.json          # is it well-formed, and is its neighbourhood healthy?
dd build review.dd.json             # write the generated review.dd.md sibling
dd get "review.dd.json#items/dw-4e01/state"
dd set "review.dd.json#items/dw-4e01/state" approved
```

`dd set` validates against the schema **before** it writes, rebuilds the `.dd.md` sibling in the
same operation, and refuses — writing nothing — if the value is not one the schema allows.

## The command surface

```
dd version      Report the installed dd version as an envelope
dd status       Report which dd verbs have been ported into this package
dd validate     Validate one document and its outbound neighbourhood
dd schema       Inspect resolved schemas (list, show)
dd docs         Read baked guidance, compiled into the CLI (list, get)
dd build        Render one .dd.json to its deterministic .dd.md sibling
dd address      Generate and validate canonical dd addresses
dd link         Resolve links and inspect recorded basis freshness
dd links        Report inbound and outbound links for one address or document
dd graph        Emit a standalone mermaid view of the repository dd graph
dd doctor       Sweep documents at infinite validation radius
dd get/set/add/rm   Read and mutate the value an address names
```

`dd <verb> --help` for any of them.

## The envelope contract

**Every command answers one envelope**, so a caller never has to parse prose:

```json
{
  "command": "dd validate",
  "status": "ok",
  "data": { },
  "error": { "code": "E400", "message": "..." },
  "next_action": "...",
  "timestamp": "2026-08-07T05:00:00.000Z"
}
```

| `status` | meaning | exit |
|---|---|---|
| `ok` | it worked | **0** |
| `degraded` | it worked, with WARN-class findings | **0** |
| `unconfigured` | nothing is mapped here yet — **not** success | **2** |
| `error` | it did not work | **1** |

Two rules the code enforces rather than merely documents:

- **`next_action` is REQUIRED on any non-`ok` status.** The envelope constructors refuse to build
  one without it, so a failure can never leave a caller without a next step.
- **Never fake success.** `unconfigured` means "nothing is mapped here yet". A verb that cannot do
  its job says so, and exits 2.

Output mode: `--json` / `--no-json` beat the `DD_JSON=1` environment variable, which beats TTY
detection. Piped output auto-selects JSON, and both flags are accepted **after** the verb as well
as before it.

```bash
dd validate review.dd.json --json | jq '{status, counts: .data.counts}'
dd --json validate review.dd.json | jq '.data.issues[] | {code, location, owner}'
```

## Addresses

An element earns an **id** when it carries state or is a link target. Ids use a registered prefix
and four lowercase hex digits — `ph-`, `tk-`, `ac-`, `bp-`, `lg-`, `dw-`. Addresses are
`file#name/id/name/id…` — one `#`, then alternating names and ids:

```
docs/plans/065/tasks/phase-2/tasks.dd.json#tasks/tk-9f2a
#done_when/tk-9f2a/dw-a9c4          ← bare "#": same document, survives a rename
```

Generate them rather than typing them:

```bash
dd address generate "tasks/tk-9f2a" --path tasks.dd.json
dd address validate "tasks.dd.json#tasks/tk-9f2a" --resolve
```

## Completion states and the gate

| State | Gate | Who sets it |
|---|---|---|
| `unchecked` | holds | anyone (birth state) |
| `checked` | passes | whoever did the work, with evidence |
| `blocked` | holds | anyone, **note required** naming the blocker |
| `human-skipped` | passes | **a human only**, with a receipt carrying their verbatim words |
| `na` | passes | anyone, **note required** |

Gate-terminal by default: `checked ∪ human-skipped ∪ na`. A schema may declare its own enums —
with their own `gate_terminal` sets — so "done" means what that schema says it means, not what a
hard-coded list says.

## The `.dd` resolution ladder

A qualified schema name resolves by deep scan through four roots, **first hit wins**:

| # | Root | Why it is there |
|---|---|---|
| 1 | the document's own folder | a self-contained corpus travels with its schema |
| 2 | `<gitroot>/.dd` | the repository's own schemas — the common case |
| 3 | `<gitroot>/.harness/.dd` | schemas a harness installs alongside the repo |
| 4 | `~/.dd` | your personal schemas, lowest precedence |

Inside a root, the package may sit at any depth, and the layout is
`<root>/schemas/<pkg>/<schema>/schema.json` — the last two path segments **are** the qualified
name.

**Every hit is recorded, not just the winner.** A duplicate name *inside one root* is a hard
error, because nothing can arbitrate it. The same name in a *lower-precedence* root is a shadow —
reported as a warning, with its path, by `dd schema list` and `dd schema show`. Local override is
the feature; silently forking validation is not.

```bash
dd schema list                      # every resolvable schema + shadowed duplicates
dd schema show review/checklist     # one schema: path, shapes, enums, gate-terminal set
```

## Custom render types

An adapter is a file whose **presence is its registration** — no manifest, no import list:

```
<root>/schemas/<pkg>/<schema>/adapters/<type>.ts
```

It is plain TypeScript, loaded and transpiled at runtime (this is the one thing `jiti` is a
dependency for), and it is a pure `(value, ctx) => string`. A missing or throwing adapter is
**loud, not fatal**: the value renders with an honest fallback and the build envelope carries an
explicit warning, which `dd doctor` repeats. A quiet fallback would let a broken adapter look like
a boring document forever.

## Going deeper

The canonical explainer is
[`docs/how/dd/deterministic-documents.md`](docs/how/dd/deterministic-documents.md): what a
deterministic document is, why it exists, and worked examples — addressing down to one field,
typed links and the `E406` refusal, writer refusals, render drift, the doctor, and the link
graph — every one run against this repository's own binary.

The same reference corpus is baked **into the binary**, so an agent can read it with no
checkout and no network:

```bash
dd docs list
dd docs get dd-overview
dd docs get how-to-add-a-schema
dd docs get how-to-use-and-extend-the-sdk
```

The repository copies live in [`docs/how/dd/`](docs/how/dd/README.md).

## Development

```bash
npm ci          # or: just install
just boot       # fast "does it run": build + the spawned-bin smoke test
just checks     # the full gate: lint + build + typecheck + docs-drift + test
just fix        # apply biome's safe fixes
just pack-gate  # prove the published TARBALL works, from a clean clone outward
```

Commits are [conventional commits](https://www.conventionalcommits.org/) — release-please reads
them to cut versions and the CHANGELOG.

## Licence

MIT — see [LICENSE](LICENSE).
