# Plan 002 — SDK surface design decision (Q-4 · Q-5 · S-2 landing · fr-0001)

**Status**: **RATIFIED** — o-prime (`pij-mental-dajeil`), 2026-08-08: *"D-1 THROUGH D-6
RATIFIED AS A SET, no overrides"*, ruled against the document itself, not the wire summary.
D-4's offered override explicitly declined (deferral IS the one-definition principle applied).
P3 implements exactly this delta; deviation returns here by amendment, never drift — a surface
change arriving without one is a finding.
**Authored**: PM `pij-certain-crab`, 2026-08-08.
**Inputs**: `assets/p1-import-census.md` (the trial floor — commit `e2b995d`),
`research/sdk-guidelines.md` (R-1 research — commit `d022de8`), `requirements.md` rulings
R-1..R-5, §4.1 header ruling, §5.1, §7a S-2 rider, §9 fr-0001/fr-0006.
**Boundary**: this document is where WHAT-IS-OFFERED decisions are finally allowed to happen —
the R-1 sequence (research before design) is satisfied and cited per decision.

---

## D-1 · Q-5: the root export becomes a curated pure barrel; the bin separates

**Decision**: `exports["."]` points at a new curated, side-effect-free barrel
(`src/lib.ts` → `dist/lib.js`). The CLI entry (`src/index.ts`, shebang + `main()`) remains the
`bin` target and is **removed from the exports map entirely**. Dependency direction:
`bin → program → library`, never `library → bin`.

**Why**: §4.3/§B3 measured: importing the root today executes the CLI and yields zero named
exports. Research is unambiguous — the root should be "a curated, documented barrel
representing the package's primary abstraction," and accidental CLI execution is the canonical
dual-package defect (research §2). Drop-the-root was considered (the Effect/remark-cli
pattern) and rejected: dd has a natural primary abstraction (parse → validate → address →
links over deterministic documents), and a root barrel is the cheapest adoption path for new
consumers (fr-0006: every consumer still scraping is one nobody has given a reason to stop).

**Root contents (curated allowlist — every addition is an API review)**:
parse (`parse`), validation essentials (`validateWalk`, `collectLinkCells`,
`resolveAddressFile`, `DdIssue`), addressing (`parseAddress`, `isAddressFailure`), the seam
types (`DocLoader`, `SchemaResolver`), the loader pair (`MemoizingDocLoader`, `FsDocLoader`),
`ConventionSchemaResolver`, and core doc types (`DdDoc`). Nothing render-, adapter-, or
CLI-shaped in the root.

## D-2 · Q-4: width = the measured floor, landed in domain-true subpaths — no speculative widening

**Decision**: the public surface grows by exactly the six floor symbols plus the seam
housekeeping D-1 needs. No symbol is added "because it might be useful" (research §3:
one-consumer-is-evidence; admission test applied per symbol below). The existing 11 subpaths
are untouched (already consumed; removal is breaking; Hyrum).

Per-symbol landings (S-2 rider honoured: destination was ruled, THIS is the landing):

| Symbol | Landing | Admission-test evidence | Confidence |
|---|---|---|---|
| `FsDocLoader` | `./links` (alongside `MemoizingDocLoader`; the seam TYPES already live there by design — census C4) | Consumed twice in trial; implements public `DocLoader`; deps are public shapes (`Pick<FsPort,'readText'>`, `HashPort`, `ReadonlySet\|null`); second use case = any fs-backed consumer. Domain-owned: "load a dd doc from files" is dd's job. | HIGH |
| `NodeSchemaFs` | **new subpath `./node`** — Node-bound adapters | Consumed (`plan/index.ts:49`); it is a Node `fs` adapter, exactly what research §1/§4 says to isolate from the portable core (keeps `node:` deps out of root/core module graphs) | HIGH |
| `trackedPaths` | `./node` | Async, `ExecPort`-driven (git tracked set) — operational, Node-adjacent; consumed at three construction sites (census C3). Portable in shape but operational in meaning; lands with adapters | MEDIUM — trial may argue for a portable home |
| `DD_ISSUE_CODES` | `./core/validate` | It is the issue-code registry — validation contract data, domain-owned; consumers switch on codes (fr-0006's typed-not-scraped argument applied to errors). Research: error shape is API | HIGH |
| `DdActDeps` | `./node` | The deps-seam type for fs/exec/env injection. HONESTLY one-consumer-shaped (research warns); admitted because the floor demands it, landed in `./node` (not core) to mark it operational. **PROVISIONAL — expected koala-trial revision candidate (R-4)** | LOW |
| `renderDocument` | `./render/renderer` | Consumed (`plan/index.ts:48`); rendering is an existing public family; the fn currently sits in `src/acts/build.ts` only by historical accident — nothing CLI about its signature | HIGH |

**Implementation note (not surface)**: landing these means moving code OUT of `src/acts/`
(the CLI half) into the library half — `FsDocLoader`/`trackedPaths`/`DD_ISSUE_CODES`/`DdActDeps`
out of `acts/shared.ts`, `NodeSchemaFs` out of `acts/schema-fs.ts`, `renderDocument` out of
`acts/build.ts` — with `src/acts/*` re-importing from the new homes (acts keep working, no
consumer-visible CLI change). `./acts/*` is never exported (fr-0010 rejected option (a) stays
rejected).

**Explicitly NOT admitted now** (fail the admission test's second-use or ownership gates):
`NodeHash`, `NodeExec` (harness owns its own; fixture owns its stand-ins — census row C),
`posix-path` helpers (see D-4), anything from `src/plan/` (R-2).

## D-3 · fr-0001, ruled together with OQ-2's data fault line: ONE definition — machinery in dd, definitions with their owner

**Decision**: dd answers "the schemas do not travel" the same way R-2 answered code: dd ships
the **resolution machinery** (already public: `ConventionSchemaResolver`, `./schema/*`), plus
two additions — (a) dd's OWN first-party schemas (the ones dd core validation needs) ship in
the package under a dedicated asset subpath (`./schemas/*.json` pattern + a `schemaUrl()`
helper per research §5), and (b) **consumer-domain schemas (builder/\*) stay with their owner**
(harness/builder), resolved in consuming repos via the convention resolver — dd never bundles
another product's schema definitions. One definition per schema, each living with its domain
owner; zero copies inside dd of things dd does not own.

**Why together-with-OQ-2**: the fault line is identical — shipping builder schemas in dd would
lock dd to harness's semantics exactly as shipping `plan/` would have (two-vocabularies
hazard, already rejected in fr-0010 option (c)).

## D-4 · The posix-path duplication: recorded, deliberately NOT unified in plan 002

The byte-identical `posix-path.ts` pair (coder's unprompted P1 finding) is real and will
drift eventually. Unification options all change WHAT IS OFFERED (a new public path module) or
create cross-repo coupling mid-port. **Decision: defer to the koala trial** (R-4 — the
consumer is the only party who can say whether it wants dd's copy as public API), with S-1's
implementation (P4) using dd's internal copy. Recorded as a wishlist candidate, not a P3 work
item. *(If prime reads fr-0001's "one definition" principle as demanding it now, that is a
one-word override at ratification.)*

## D-5 · Stability marking

Everything landed in D-2 ships **stable except `DdActDeps`**, which lands as-is but is
documented `@experimental` in TSDoc (research §7: conspicuous marking; a rename/reshape is a
plausible koala-trial outcome and experimental marking is what makes that revision non-breaking
in policy terms). No `./experimental/*` subpath is created for one symbol; the marking is
doc-level this plan, promoted or reshaped at trial feedback.

## D-6 · Verification surface changes (feeds P5)

Per research §6, adopted into this plan's gates: the §5.1 fixture rides the installed tarball
(already ruled); **additionally** P5 adds `publint --strict` and `@arethetypeswrong/cli --pack`
to the pack gate lane — both run against the tarball, catching exported-but-not-packed and
types-resolution failures the fixture alone would attribute poorly. (Gate design, not surface
design — listed here because the research motivated it and P5 implements it.)

## Exports-map delta (the entire public change, reviewable at a glance)

```jsonc
{
  ".":        "dist/lib.js (NEW curated pure barrel — was: dist/index.js, the CLI bin)",
  "./links":  "+ FsDocLoader (runtime)",
  "./node":   "NEW — NodeSchemaFs, trackedPaths, DdActDeps (@experimental)",
  "./core/validate": "+ DD_ISSUE_CODES",
  "./render/renderer": "+ renderDocument",
  // everything else: UNCHANGED. ./acts/*: still never exported. ./plan: still forbidden (R-2).
}
```

## A-1 · AMENDMENT (2026-08-08) — two D-2 landings collide with the SDK-purity gate

**Status**: **RATIFIED** — o-prime, 2026-08-08, *"as proposed, no amendments"*, read from the
amendment itself. Prime's own words on why: it corrects the ratified D-2 rationale
("nothing CLI about its signature" — *true of the signature and false of the body*), the
rejected options are why the accepted one is trusted (amending the gate was available and
refused), and the reframe makes the purity boundary an architectural statement. Raised by the
coder mid-P3 via the amendment path (measured against `dd-core-isolation`'s own algorithm,
coder took no position); three moves + T2/T3/T4 proceeded unblocked throughout.

**Post-implementation residuals** (P3 report, recorded — deferred to the koala trial per R-4,
candidate A-2 material): (a) `renderDocument`'s return types (`BuildResult` family) are not
exported from `./node` — callable but unnameable except via `Awaited<ReturnType<...>>`; adding
them would exceed the ratified delta. (b) typecheck now depends on `dist/` existing (the
fixture skeleton resolves `@ai-substrate/dd/*` through the real exports map) — pre-existing
gate ordering, newly load-bearing.

**The collision**: `dd-core-isolation` keeps the whole SDK tree
(core/docs/links/mutate/plan/render/schema/shared) free of `output/` and `adapters/` imports —
absolute today (measured: zero escapes), and documented as intent (*"an act is where a
structured finding becomes the CLI's error vocabulary"*). The ratified delta put two E-code /
adapter-coupled symbols INSIDE that tree:

- `DD_ISSUE_CODES` → `./core/validate`: irreducible runtime import of `output/error-codes`
  (it IS that map's values), plus a core↔links type cycle any variant inherits.
- `renderDocument` → `./render/renderer`: five escapes, four runtime — it is a **composition
  root** constructing four Node adapters; keeping its ratified signature means keeping that
  construction.

**Amended landings** (the only change — floor still exactly six, all reachable):

| Symbol | Was (D-2) | Now | Why this option |
|---|---|---|---|
| `DD_ISSUE_CODES` | `./core/validate` | **`./node`** | The E-code vocabulary is CLI vocabulary — the gate's docblock says so in its own words. Landing it in core would invert the boundary (rejected opts: moving error-codes into the SDK tree, duplicating the literals — two exhaustive Records that drift, amending the gate). `./node` already can import `output/`; the consumer imports it alongside `DdActDeps`/`trackedPaths` today, so the cluster stays together |
| `renderDocument` | `./render/renderer` | **`./node`** | It is Node-bound **by construction**, not by accident of address — the D-2 rationale ("nothing CLI about its signature") was true of the signature and false of the body. Injection (signature change) and pure/wiring split (new symbol beyond delta) both deviate more |

**Consequences**: `./core/validate` and `./render/renderer` rows revert to UNCHANGED (their
targets never needed edits). `./node` becomes the five-symbol operational tier: `NodeSchemaFs`,
`trackedPaths`, `DdActDeps` (@experimental), `DD_ISSUE_CODES`, `renderDocument`. The purity
gate stays absolute and becomes a design FEATURE: the SDK tree emits structured findings;
`./node` is where findings meet the CLI vocabulary and Node adapters. D-5 stability unchanged.

**Also recorded, PM-accepted as NOT a surface deviation** (coder's implementation note):
`FsDocLoader`'s ctor port types (`Pick<FsPort,'readText'>`, `HashPort` — both from `adapters/`,
both non-public) are re-declared structurally in `links/loader.ts`, following the existing
in-tree precedent (`render/refresh.ts:9-18`, `schema/model.ts` `SchemaFs`). No new public
symbols (not exported from `links/index.ts`); call sites unchanged (structural typing); P1
census group C already recorded these as foreign stand-in shapes.

## A-2 · AMENDMENT (2026-08-08) — trial round 1: `tracked` lies on no-tracking hosts

**Status**: PROPOSED — awaiting o-prime ratification. Source: koala trial round 1, verified by
o-prime against both the code and its own doc comment before routing. R-4 working as designed:
the surface moved to trial, the trial found what our gates did not, it returns as an amendment.

**The defect** (`links/loader.ts:99`, `FsDocLoader.load`):
`tracked: this.tracked === null ? true : this.tracked.has(path)` — while the module's own doc
comment (lines 59–63) defines `null` as *"this host has no tracking concept"* and **explicitly
rejects** calling-everything-tracked because it silently suppresses the untracked-target WARN.
The code implements the alternative its own comment rejects, and the primary consumer passes
`null` deliberately (`flow.ts:126`). One boolean carries two meanings — *tracked* and
*unknowable* — so consumers get a confident wrong value instead of an absence. The defect is
the VALUE lying, not the WARN policy (koala's own framing, kept).

**Amended shape**: `DocLoadResult.tracked` becomes **`boolean | null`** — `null` = tracking
unknowable on this host. Chosen over a tri-state enum because it adds **zero new exported
symbols** (smallest surface delta), models absence as absence, and TypeScript forces every
consumer that branches on it to face the third case. WARN-suppression behavior on null hosts
is deliberately UNCHANGED (policy question, not this defect). The §5.1 fixture's C9 clause
gets STRONGER: the null-host arm asserts `tracked === null` (it currently pins the lying
`true` — see instrument note).

**Instrument note, recorded on prime's instruction — do not let this pass as a happy ending**:
three instruments touched this semantics and only the external one resolved it right. (1) Our
P5 coder hit it building the fixture (its "fixture bug (a)"), asserted `false`, observed
`true`, and **conformed the fixture to the implementation** — the comment was one screen up.
(2) Our review verified the clause asserted what the code did, not what the contract said.
(3) koala, reading as a consumer, believed the comment. Relatedly, koala disclosed its census
was incomplete (31 symbols / 14 modules true surface, not 25/11) and that our `./node` tier
covered its blind spot **by coincidence, not design** — the six floor symbols were right, and
we did not know they were right for the reason we thought. Two agreeing instruments shared a
blind spot; the floor held anyway; that is luck spent, not method proven.

## What ratification is being asked for

1. D-1..D-6 as a set (or per-item overrides).
2. Confirmation that D-3 is a faithful application of "fr-0001 ruled together with OQ-2".
3. The D-4 deferral (or its override).
After ratification: P3 implements exactly this delta; any deviation discovered mid-build comes
back here first (the surface is movable pre-trial per R-4, but by amendment, not drift).
