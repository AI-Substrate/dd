# Ruling — the semantic ontology leaves dd; consumers bring it on top

**Ruled by**: Jordan · **2026-08-09** · **Status**: in force
**Supersedes**: the OQ-2 packaging question (export `./plan` / export primitives / stop packing it)
**Asked**: is `plan` a dd concept, or a harness/builder concept?

---

## The ruling, verbatim

> "yes. we should get taht kind of semantic ontology out of dd. that is the reason the SDK exists
> so they can bring that on top in tier own products"

**Jordan's own question is what produced it** — *"plan is not a dd concept though right? its actually
a harness builder concept?"* — asked while three packaging options were in front of him, none of
which addressed it. **The options were about how to ship something that may not belong.**

## What is actually leaking — measured, not asserted

The leak is **wider than `src/plan`**, which is why the packaging framing was wrong.

| Site | Content | dd concept? |
|---|---|---|
| `src/plan/` — `check.ts`, `semantics.ts`, `ready.ts`, `index-plan.ts` | plan-validate, contradiction detection, orphan-claims, gate readiness | **no** — SDD/builder |
| `src/core/constants.ts:12` — `ID_PREFIXES` | `ph-` phase · `tk-` task · `ac-` acceptance-criteria · `bp-` backpressure · `lg-` log · `dw-` done_when · `fn-` · `fd-` · `vd-` | **no** — every one is the builder's ontology |
| `src/core/constants.ts:57` — `BUILTIN_RELS` | `pressure` (backpressure), `satisfies` (AC satisfaction) | **no** for those two; `proven_by` / `derives` / `ref` are arguable |

dd's own concepts are **documents, sections, addresses, links, relations, schemas, states, gates,
render, sweep**. None of the rows above is one of those.

`ID_PREFIXES` and `BUILTIN_RELS` are in **shipped, exported core** — so the builder's ontology is
enforced on every consumer, not merely bundled.

## THREE OPEN FINDINGS COLLAPSE INTO THIS ONE CAUSE

They were filed separately and are one thing:

- **`wl-0020` (leopard, F2)** — `--mint` is unusable for a foreign domain. A novels repo cannot mint
  `sd-` for story seeds **because dd's core only knows the harness's nouns**, and the front door
  simultaneously forbids hand-naming ids. Not an isolated defect: a symptom.
- **`government/rulings/2026-08-09-no-sixth-builtin-relation.md` (koala)** — `satisfies` is binary and
  cannot express partial satisfaction. It is binary **because it was designed for acceptance
  criteria**, which is builder vocabulary blessed as a dd primitive.
- **The 71KB** of `dist/plan` shipped-and-unexported is the visible tip, and the least important part.

## THE SHAPE OF THE FIX: dd KEEPS THE MECHANISMS, CONSUMERS BRING THE VOCABULARY

This is the distinction the work must hold, or it will delete something load-bearing:

- **Mechanism (STAYS)**: ids are minted under a registered prefix · relations are typed and carry
  semantics · some relations CLAIM and others merely REFERENCE · states come from a declared
  vocabulary with a terminal set.
- **Vocabulary (LEAVES)**: which prefixes exist · which relations exist · which states exist.

**THE PATTERN IS ALREADY PROVEN IN THIS CODEBASE — completion states got it right.**
`COMPLETION_STATES` ships as a **default**, and a schema may declare its own enum with its own
`gate_terminal`. Measured: leopard's novels schema declared `planted / developing / paid-off /
dropped` with `gate_terminal: [paid-off, dropped]` and it worked first try, cold, from the docs
alone. **That is the target shape for prefixes and relations, and it is not hypothetical — one
axis of dd already works this way and a stranger exercised it successfully on day one.**

## Consequences

- **OQ-2's packaging question is moot.** Do not decide how to ship `dist/plan`; decide whether the
  ontology belongs, which is now ruled. `wl-0011` (*does `src/plan` belong in this repo at all*)
  becomes the live scoping question rather than a deferred one.
- **This is what R-4a anticipated.** *"If round 3 finds the primitives insufficient, dd exports the
  missing primitives."* The primitives are the product; the plan layer was never meant to be.
- **`wl-0001` (SDK design flow) now has its central question**, and it is not "what should the API
  look like" — it is **where the seam between mechanism and vocabulary sits**.
- **Not a licence to delete on sight.** Removing `BUILTIN_RELS` wholesale would take the
  claiming-versus-referencing mechanism with it, which is dd's. The vocabulary leaves; the
  distinction stays.
