# P7 — Surface-membership gate: pin the eleven wholesale subpaths

**Authority — two Jordan rulings, both verbatim via o-prime relay** (given in the o-prime's
pane; the PM did not witness either — cite these lines, not anyone's summary):

> **What**: *"kk do both, have the pm do it."* — the SDK how-to doc AND the gate extension,
> assigned to the PM.
> **When**: *"both now please."* — both, on this PR.

The timing was briefly the o-prime's *inference* (gate now / doc now-with-revision); Jordan then
ruled it directly and **his ruling is the authority — the inference is superseded and survives
only as background reasoning**. Recorded this way deliberately: an inference relayed down a
chain hardens into "the o-prime said" by the time it reaches a coder unless the record separates
them.

Supporting reason (background, not instruction): the change is surface-NEUTRAL, so it cannot
collide with anything koala's trial reports, and every day it is absent is a day an accidental
export ships unreviewed.

## The hole

`DECLARED_SURFACE` in `scripts/exports-reachability-probe.mjs` pins exact membership for
**two** targets only — `dist/lib.d.ts` (13) and `dist/node/index.d.ts` (5). The other **eleven**
subpaths re-export their modules wholesale and are checked for *reachability*, never for
*membership*. So `export function foo()` added to `src/core/validate.ts` is **instantly public
API** with no gate, no review, no record. That is the `ActDeps` leak class at module scope,
where nothing is watching.

**The eleven** (derive independently from `package.json#exports` — 14 entries, minus the two
curated barrels, minus `./package.json`): `./core/address`, `./core/model`, `./core/parse`,
`./core/validate`, `./core/walk`, `./links`, `./render/renderer`, `./schema`, `./schema/index`,
`./schema/model`, `./schema/resolve`.

## Tasks

### T1 — Extend `DECLARED_SURFACE` to all eleven
Add each subpath's emitted `.d.ts` target with its **ratified name list**, using the existing
exact-set machinery (fails on surplus AND on missing, refuses rather than guesses if a barrel
grows an `export *`).

**Baseline rule**: whatever each subpath exports **today** becomes its ratified list. This is
not ratifying new choices — it is freezing the already-shipped surface so that the *next*
addition is a decision. Arm against a clean floor (the `noUnusedImports` precedent), so derive
the lists from a build at HEAD and state the command you used.

**HAND-MAINTAINED, NOT GENERATED — this is the load-bearing constraint.** Do not generate the
lists at runtime from the `.d.ts` files; a self-deriving list would agree with any surface,
which is precisely the vacuous guard this exists to prevent. The lists are literals a reviewer
reads in a diff. If the volume is large, say so and propose a shape (grouping, one const per
subpath) — but the values stay literal.

**Attribution on red**: a failure must name the subpath AND the surplus/missing symbol, as the
current two-barrel version does.

### T2 — Negation, per the standing standard
Plant a surplus export in **at least two** of the eleven (different modules — e.g. one in
`core/*`, one in `links`/`schema`), confirm each reds **by name**, revert, green. Also prove the
missing direction on one: remove an export, confirm red. State which ones you planted and quote
the red lines. *(A gate pinning eleven surfaces that has only ever been seen passing is the
vacuous-guard shape — a poor thing to ship in the same PR that documents the class.)*

### T3 — Comment the intent
The probe's docblock should say what this section is for in the terms the plan learned it:
membership is a commitment, reachability is not the same claim, and the lists are literal so
that widening the surface is an edit a reviewer sees.

## Gates & fence
`just checks` exit 0 (exit code read; C-6 procedure live), `just check-trial` exit 0.
Fence: `scripts/exports-reachability-probe.mjs`, `docs/plans/002-sdk-build/assets/` for notes.
No `src/` changes, no exports-map changes — **surface-neutral by definition**. If extending the
gate reveals a symbol you believe should not be public, that is a FINDING to the PM (amendment
path), never a removal you make.
