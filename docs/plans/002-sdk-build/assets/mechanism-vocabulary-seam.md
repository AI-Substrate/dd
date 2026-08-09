# The mechanism/vocabulary seam — scoping only, no work started

**Author**: `pij-certain-crab` (PM, plan 002), 2026-08-09, on the o-prime's instruction to scope
rather than start. **Authority**: Jordan's ruling, `government/rulings/2026-08-09-semantic-ontology-leaves-dd.md`
(`d8950eb`) — *"we should get taht kind of semantic ontology out of dd. that is the reason the SDK
exists so they can bring that on top in tier own products"*.

This document exists to answer one question and refuse the rest: **where does dd's mechanism end
and a consumer's vocabulary begin?** It does not propose an implementation.

## The question that produced the ruling

Jordan asked *"plan is not a dd concept though right? its actually a harness builder concept?"* —
while three packaging options for `dist/plan` sat in front of him. **None of the three addressed
whether the thing should be there at all.** The packaging question is moot; this replaces it.

## dd's own concepts, and the ones that are not

**dd's**: documents · sections · addresses · links · relations · schemas · states · gates ·
render · sweep.

**Not dd's, and currently in shipped, exported core**:

| Where | What | Whose noun |
|---|---|---|
| `core/constants.ts:12` `ID_PREFIXES` | `ph- tk- ac- bp- lg- dw- fn- fd- vd-` | phase, task, acceptance-criterion, backpressure, log, done_when — **the harness builder's** |
| `core/constants.ts:57` `BUILTIN_RELS` | includes `pressure`, `satisfies` | backpressure, acceptance-criterion satisfaction — **the harness builder's** |

Not one of those is a document, a section, an address, a relation-as-such, a schema, a state, a
gate, a render or a sweep. **They are not merely bundled — they are enforced on every consumer.**

## Three findings, one cause

Filed separately over one day and all downstream of the same leak:

- **`wl-0021`** — leopard's novels repo cannot mint `sd-` for a planted seed, because core knows
  only the harness's nouns, while the front door forbids hand-naming ids. `--mint` is unusable
  for any foreign domain.
- **`wl-0023` / koala's contradiction storm** — `satisfies` is binary **because it was designed
  for acceptance criteria**, and a multi-phase criterion has no way to say "partially earned".
- **The 71KB of unexported `dist/plan`** — the visible tip, and **the least important of the
  three.** It is what we noticed first because it had a size.

## The constraint that must survive — and it is the whole risk

> **dd keeps the MECHANISMS. Consumers bring the VOCABULARY.**

Stays dd's, and would be destroyed by a naive removal:

- ids are minted under a **registered prefix**, unique per file, fixed shape;
- links carry a **typed relation**;
- **some relations CLAIM and others merely REFERENCE** — `CLAIMING_RELS` is the engine behind
  every contradiction finding dd can make;
- states come from a **declared vocabulary with a terminal set**.

Leaves: *which* prefixes · *which* relations · *which* states.

**Ripping out `BUILTIN_RELS` wholesale takes claiming-versus-referencing with it**, and that is
the mechanism, not the ontology. The distinction is the point of the whole exercise.

## The pattern is already proven HERE — and that is the scoping answer

One axis of dd already does this correctly, and the seam is visible in the source as a
**parameter with a default** rather than a constant read directly:

```
derive.ts:76,100   gateTerminal: readonly string[] = DEFAULT_GATE_TERMINAL_STATES
                   ^ the CALLER passes the schema's gate_terminal; the constant is a FALLBACK
declarations.ts:440  values: COMPLETION_STATES      ← the built-in `state` type's default values
validate.ts:160      shape.type === 'state' ? COMPLETION_STATES : undefined
```

A schema may declare its own state enum with its own `gate_terminal`. **`pij-industrial-leopard`
declared `planted / developing / paid-off / dropped` for a novels repo and it worked first try,
cold, from the shipped docs alone.** That is not a hypothesis about what good would look like —
it is a stranger exercising the target shape successfully on day one.

**Contrast, and this is the entire finding of this document:**

| Axis | How the vocabulary reaches the mechanism | Overridable? |
|---|---|---|
| completion states | **parameter** with a default (`gateTerminal = DEFAULT_…`) | **yes** — proven cold by an outside consumer |
| id prefixes | baked into `MINTED_ID_PATTERN` at module load | **no** — no injection point exists |
| relations | `effectiveRel()` closes over `BUILTIN_RELS` | **no** — no injection point exists |

**So the shape of the work is not "remove the constants". It is "give prefixes and relations the
same injection point states already have."** The mechanism stays exactly where it is; the
vocabulary arrives from the schema, as it already does for one axis out of three.

## What this does to the board

- **OQ-2's packaging question is MOOT** — (a)/(b)/(c) all answered "how do we ship this?" when
  the question is whether it belongs.
- **`wl-0011`** (*does `src/plan` belong in this repo at all*) stops being deferred and becomes
  the live scoping question.
- **`wl-0001`** has its central question, and it is **not** *"what should the API look like"* —
  it is **where the seam sits**.

## Not started, and deliberately

No code has moved. The seam is measured, the constraint is named, and the proven template is
identified — that is the whole of what was asked for. **The failure mode this document exists to
prevent is a well-intentioned removal that takes claiming-versus-referencing out with the
harness nouns**, which would silently disable every contradiction dd can detect while looking
like a successful cleanup.
