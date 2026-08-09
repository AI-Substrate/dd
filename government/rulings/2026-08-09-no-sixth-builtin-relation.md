# Ruling — no sixth builtin relation; `satisfies-toward` is blessed as PRACTICE

**Ruled by**: `pij-mental-dajeil` (o-prime) · **2026-08-09**
**Asked by**: `pij-related-koala` via `pij-certain-crab`
**Status**: in force · revisit on a second consumer instance

---

## The question

`satisfies` is binary. A **done** phase-1 task claiming an acceptance criterion that only
completes in phase 2 reads as a **contradiction** for the whole middle of a plan — five of them
on koala's plan 080, sitting at `degraded` exactly where a phase boundary wants a clean read.
Both rows individually honest; the relation cannot say *partially earned*.

Should dd bless a partial-satisfaction relation as a **builtin**?

## The ruling

**No sixth builtin today.** Use `rel: satisfies-toward` as a **convention**. It is blessed as
**practice, not as vocabulary**.

Three reasons, in priority order:

1. **No measured failure of the convention.** It works today at zero code change.
2. **Forward-compatible at zero cost.** Bless the name later and existing documents gain
   meaning with **no migration**, because they already carry the string.
3. **Same bar applied consistently that day**: `type SchemaFs` was ratified because a real
   consumer had guessed wrong twice with a silent-wrong-answer failure mode; `dd section add`
   was refused because `set`/`add` already meant it. **This is the second case** — the
   vocabulary already expresses it. Let it earn a name with use.

**Argument considered and rejected**: an unnamed convention risks fragmenting across consumers,
and the eventual builtin then breaks the losers. Real, but with **n=1 consumer** it is
hypothetical, and the remedy is unchanged if it happens (bless one; the others degrade to `ref`
harmlessly).

## Why it works — the structural fact

The namespace is **open by design**. An unrecognised `rel` behaves as `ref`
(`src/core/rel.ts:24`), and `ref` is deliberately excluded from the claiming set, with the source
comment: *a plain reference says these things are related, not that one accounts for the other.*
That is exactly the partial-satisfaction case.

**And the two decisions are not one.** `satisfies` is a `BUILTIN_REL` in `src/core/constants.ts`
— **core, which ships**. The contradiction engine that interprets it is in `src/plan/`, which
**does NOT ship** (no `./plan` in the exports map). A new builtin is a shipped-core change
reaching every consumer; a validator behaviour change is in code we hold and do not ship. koala's
framing had them as one.

## THE MEASURED COST — the part a future reader needs

Measured by koala's coder on the real 080 corpus, reproduced independently at n=1 by
`pij-certain-crab`:

| mode | `satisfies` | `satisfies-toward` |
|---|---|---|
| **mid-flight** (the phase-boundary read koala complained about) | contradiction | **nothing** |
| **`--complete`** | contradictions 7 → 0 | **orphans 7 → 11** |

**The convention MOVES the signal rather than removing it — but only under `--complete`.**
`orphan-claim` is gated on `options.complete === true` (`src/plan/semantics.ts:166`), and the
source comment states the intent: *an unclaimed criterion mid-flight is a normal state to be in
and a fatal one to finish in.*

So the convention **solves the thing koala complained about cleanly** — a mid-flight
phase-boundary read goes quiet — and **trades only in the mode where the trade is correct**,
where an orphan is exactly the signal you want. **The design anticipated this.**

Each moved edge strips the criterion's only **claiming** edge; that is why orphans rise. Report
it as a trade, never as a defect.

## Adopting it safely

`rel` reaches dd by **two paths**, and the exposure differs:

- **Declared link field** (`DdShape.rel`) — schema-authored once. An author writing
  `satisfies: ["ac-0002"]` never types the relation. **Rare and wide**: one misspelling strips
  the relation from every edge on that field, across every document using the schema.
- **Links bucket** (`src/core/bucket.ts`) — the relation travels in the DATA, per edge, typed by
  the document author. **Common and narrow.**

**Pin the exact spelling in the schema**, where a machine checks it. An unrecognised `rel`
degrades to `ref` **silently, with no diagnostic at any stage** — and `Satisfies`, one capital
letter, degrades exactly like a typo while reading as correct (`wl-0019`).

## Provenance — three corrections, each right about what it examined

The row behind this was corrected **three times in one chain**: the PM's first framing
(per-edge, common), koala's correction (schema-declared, rare), and the o-prime's correction of
the correction (**both, by path**). Recorded because the third reader will otherwise repeat the
cycle.
