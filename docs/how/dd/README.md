# dd — the repository reference

The `dd` guidance that ships **inside** the binary, kept here as readable files too.

```bash
ddocs docs list          # the same corpus, baked into the CLI
ddocs docs get <id>
```

Start with the README at the repository root for install and a quick start. This folder is the
longer form.

## What is here

| Page | `ddocs docs get` | Covers |
|---|---|---|
| [dd-overview.md](dd-overview.md) | `dd-overview` | The envelope, ids and addresses, completion states and the gate, schema resolution, the CLI family, reading it with `jq`. |
| [how-to-add-a-schema.md](how-to-add-a-schema.md) | `how-to-add-a-schema` | A worked schema package with custom enums and `gate_terminal`, the `human-skipped` receipt convention, and a custom-type adapter. |
| [how-to-use-and-extend-the-sdk.md](how-to-use-and-extend-the-sdk.md) | `how-to-use-and-extend-the-sdk` | Consuming dd as a library — the three import tiers, wiring your own fs/hash ports, and the three steps plus gates for putting a new symbol on the public surface. |
| [deterministic-documents.md](deterministic-documents.md) | `deterministic-documents` | The canonical single-pager: one document with two faces, ids and addresses, typed links the validator checks, a writer that refuses bad values, and a rendered view that cannot drift. |

Every page here is **ported verbatim** from `src/docs/content/`, which is the source of truth. They
carry a header saying so. Editing a copy here changes nothing the CLI serves — edit the source and
run `npm run gen:dd-docs`; `npm run check:dd-docs` runs inside `just checks` and fails the build if
the baked module drifts from its sources.

## What is not here yet

The deeper reference pages and the worked `exemplar/` corpus — including a self-contained example
with its own schema and adapters — **remain upstream**, in `AI-Substrate/harness-engineering`.
They have not been ported into this package.

`dd-overview.md` used to point at them as if they were here; that pointer came across verbatim
with the rest of the upstream text. It has been amended at the source
(`src/docs/content/dd-overview.md`) to say where they actually live and to name what runs today.

**The corpus is deliberately not ported.** It carries `meta.certainty: Partial` — the exact
contested value of dd-next #10, which Jordan has not ruled — and the exemplar is the file new
authors copy, so porting it would propagate an unruled value widely. Revisit rides the backlog
row (phase-4 tk-0004).

The runnable equivalents that ship here:

- the **README quick start** at the repository root — a complete schema, document, validate, build
  and mutate cycle you can paste, and one this repository executes as a test
  (`test/docs-surface.test.ts`), so it cannot rot into an example that no longer runs;
- the **custom-type adapter** worked end to end in `test/acts/jiti-custom-type.test.ts` and again in
  `scripts/pack-gate.sh`, both of which build a self-contained corpus from scratch and assert the
  adapter's output actually reaches the rendered markdown;
- the **render fixture corpus** in `test/services/dd/render/fixtures/`, which pairs every fixture
  document with its committed golden render — including the adapter failure classes.

This gap is recorded rather than papered over: a pointer that does not resolve is worse than an
honest note saying where the thing actually is.
