# P7 notes — pinning membership on every published subpath

## The eleven, derived independently

Derived from `package.json#exports` rather than from the packet's list, per constraint 1:
14 entries − `.` − `./node` − `./package.json` = **11**. The result matches the packet's
list exactly, which is worth recording as agreement between two derivations rather than as
one list copied twice.

But eleven subpaths resolve to **ten** emitted `.d.ts` files: `./schema` and `./schema/index`
are two exports-map keys onto one `dist/schema/index.d.ts`.

## Shape (constraint 2: literal, hand-maintained)

`DECLARED_SURFACE` is keyed by **emitted file**, not by subpath, and each entry carries a
`subpaths: []` field naming the exports-map keys it serves. Two keys onto one file therefore
share **one** literal list. The alternative — an entry per subpath — would have put the same
31 names in two places, where the failure mode is that the copies disagree and the gate
reports whichever it read first.

Total pinned: **190 symbols across 12 emitted targets / 13 published subpaths** (the eleven
plus the two curated barrels, which keep their own authority lines: D-1 and A-1).

Volume is real but it is the point: the lists are values a reviewer reads in a diff, so
widening the surface is an edit someone sees. Nothing is derived at runtime from the `.d.ts`
being checked.

### Added beyond the packet: a coverage check

The table's own completeness is now a gate. Pinning eleven subpaths leaves the hole one level
up — add a *twelfth* subpath to the exports map with no entry in the table and it publishes
its whole module unwatched, invisible for exactly the same reason as the original hole:
nothing asked whether the list was complete. The check compares two hand-maintained records
(the exports map, the table) and fails in both directions; it derives neither from the other.

## Premise correction: `export *` is present tense, not future

The packet anticipated the parser "refus[ing] rather than guess[ing] **if** a barrel grows an
`export *`". Measured at HEAD, two of the eleven **already have one**: `links/index.d.ts` and
`schema/index.d.ts` both `export * from './model.js'`. Under the old rule both would have
refused permanently — the two largest surfaces on the map (73 and 31 symbols) could never be
pinned, which is the hole the task exists to close.

So a **relative** star is now followed, recursively, and its names join the file's own. What
still refuses is what genuinely cannot be read: a star from a bare specifier, a star whose
target is missing, or a cycle. `export * as ns` publishes one name (the namespace) and is
recorded as that name rather than followed.

This loosens an existing guard, so the refusal that survives was negated too (rows 5a/5b) —
a loosened guard that was never tested at its new edge is a guard nobody has read.

## Negation evidence (constraint 3)

Each plant applied alone, built, probed, reverted; sibling targets stayed green as controls.

| # | plant | site | red line |
|---|---|---|---|
| 1 | `export const P7_SURPLUS_PROBE = 1;` | `src/core/validate.ts` | `FAIL  …/core/validate    surplus 1: P7_SURPLUS_PROBE` |
| 2 | `export type P7SurplusProbeType = string;` | `src/links/model.ts` | `FAIL  …/links            surplus 1: P7SurplusProbeType` |
| 3 | removed `export type { DdDerivedState }` | `src/schema/index.ts` | `FAIL  …/schema(/index)   missing 1: DdDerivedState` |
| 4 | removed the `./core/parse` table entry | the gate itself | `FAIL  1 published subpath(s) NOT pinned: ./core/parse` |
| 5a | `export * from 'commander';` | `dist/core/parse.d.ts` | ``REFUSED    dist/core/parse.d.ts — `export * from 'commander'` — a bare specifier's names are not readable from here`` |
| 5b | `export * from './nope.js';` | `dist/core/parse.d.ts` | ``REFUSED    dist/core/parse.d.ts — via `export * from './nope.js'` in dist/core/parse.d.ts: dist/core/nope.d.ts does not exist`` |

Row 2 is the load-bearing one. The planted symbol is **type-only** *and* reachable only
through the followed `export *` — so it proves both new properties at once, and the same run
shows the runtime section reporting `reachable  links  27 named exports` **unchanged**. Row 1
shows the same contrast in one screen: the surplus appears in the reachability line
(`reachable  core/validate  5 named exports  [P7_SURPLUS_PROBE, …]`) with no complaint, because
reachability was never the membership claim.

Rows 1–3 each reddened **only** their own target. Row 4 tests machinery this task added rather
than machinery it was given.

## Gates

- `node scripts/exports-reachability-probe.mjs` → **exit 0**
- `just check-trial` → **exit 0**
- `just checks` → **exit 1**, on a red that is **pre-existing at bare HEAD and outside this
  fence** (see below). The failing set is byte-identical with and without this change: exactly
  `test/docs-surface.test.ts > … serves the same ids …` and
  `test/acts/dd.test.ts > … dd docs list enumerates the baked corpus`. This change adds zero
  failures. Recorded as measured rather than claimed green.

## Blocking finding (reported to the PM, not fixed — out of fence)

`76f7efe docs(dd): how to use dd as a library and extend its surface` added a third baked doc.
It is correctly baked (the drift gate passes; the `check:dd-docs FAIL` lines in the log are
that test's own negation arms), but two things were missed:

1. Two hard-coded literals still name two docs — `test/docs-surface.test.ts:17` (`BAKED`) and
   `test/acts/dd.test.ts:162`.
2. `docs/how/dd/how-to-use-and-extend-the-sdk.md` is byte-identical to its source, i.e. it
   lacks the three-line `<!-- Ported verbatim … -->` header the other two carry, so
   `docs-surface.test.ts:82` (`startsWith('<!--')`) fails once the id is added to `BAKED`.

Both measured in scratch and reverted: with (1) alone, 768/769 pass and only (2) remains.
