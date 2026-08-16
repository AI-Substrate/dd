# Research Dossier: Links from a dd to ordinary files

**Generated**: 2026-08-16T01:39:00Z
**Query**: "wl-0023 narrow scope: typed file-link columns, checked Markdown links in prose, and the whole-file address form"
**Effort**: Standard
**Evidence**: 12 current sources · 3 historical sources

## The Ask

`wl-0023` asks dd to connect structured documents to ordinary repository files without pretending those files have dd sections. The ruled stream contains two distinct features: schema-declared `target: "file"` links stored as plain repository-relative paths, and explicit Markdown links inside prose fields. Both must check existence only, degrade with a warning when a target is missing, appear in `ddocs links`/`ddocs graph`, and preserve a route to future `file#method` addressing. This dossier supports the required whole-file-form proposal and the implementation plan; it does not authorize implementation.

## Answer

1. The least-surprising whole-file spelling is the bare path, e.g. `src/search/index.ts`. It matches the ruled typed-column data shape, already names whole documents in `ddocs links` and `ddocs graph map`, round-trips without a meaningless empty fragment, and leaves `file#method` available for future interior semantics.
2. The parser should represent that spelling as `{ file: "src/search/index.ts", segments: [] }`; `formatAddress` must emit the bare path when `segments` is empty. Empty input and trailing `#` remain malformed. Existing `#section` and `file#section/id` forms remain unchanged.
3. Structured and incidental file references need different path bases. `target: "file"` values are ruled repo-relative and therefore resolve from the repository root; Markdown destinations must resolve as Markdown does, relative to the generated sibling’s directory, or the validator would check a different file than the rendered link opens.
4. Existing link collection, validation, traversal, reporting, graphing, and rendering already form the correct pipeline, but each assumes a dd interior. File links should enter that pipeline as explicit file-target cells; existing dd-document edges must keep their current resolution and traversal semantics.
5. Ordinary file nodes must be represented as resolved graph nodes without being loaded, parsed, hashed, schema-resolved, tracked, or traversed. Treating an existing ordinary file as an unresolved dashed node would make the graph contradict the existence check.
6. Build is not currently a validation entry point: `renderDocument` resolves schema/adapters and renders, but never calls `validateDocument`/`validateWalk`. The file-existence check therefore needs one shared pure service consumed by build and the validation/traversal faces rather than a build-only special case.
7. Markdown discovery belongs only on schema-declared prose (`type: "text"`) and only for explicit inline links `[label](destination)`. Bare paths remain data, not references. URI-schemed destinations such as `https://example.com`, fragment-only links, and the image form are outside the local-file population.

## Evidence

| ID | Finding | Evidence | Planning implication | Confidence |
|----|---------|----------|----------------------|------------|
| F-01 | Current grammar requires exactly one `#` and a non-empty interior; `DdAddress.segments` already has a natural empty-array representation. | `src/core/address.ts#DdAddress`, `src/core/address.ts#parseAddress`, live probe `ddocs address validate notes.md` → E405 | Add one canonical whole-file case; do not create a second address type. | High |
| F-02 | `src/foo.ts#parseThing` already parses and returns `classified: false`. | `src/acts/address.ts#registerAddressCommands`; live probe on 2026-08-16 | Preserve this syntax unchanged so future method addressing remains reachable. | High |
| F-03 | `parseAddress` is a ratified public SDK symbol and has 30 source/import/call references. | `src/lib.ts`; `package.json` export `./core/address`; LSP references from `src/core/address.ts:32` | Grammar changes require a full caller audit and public contract tests, not a validator-only patch. | High |
| F-04 | The schema already carries `DdShape.target`; declaration parsing accepts arbitrary non-empty targets, and typed link cells preserve it. | `src/core/model.ts#DdShape`; `src/schema/declarations.ts#parseShape`; `src/core/validate.ts#collectShapeLinks` | `target: "file"` is additive schema vocabulary; no new field is needed. | High |
| F-05 | Current validation parses every declared link as a dd address, applies path warnings, and type-checks only same-document interiors in core; cross-file type checking happens during the walk. | `src/core/validate.ts#validateLink`; `src/core/walk.ts#validateWalk` | File-target semantics must branch before dd schema/interior resolution while reusing path escape diagnostics. | High |
| F-06 | Corpus traversal creates edges from collected cells, queues every in-repo target, and only creates nodes after a successful dd load/schema resolution. | `src/links/traverse.ts#traverseCorpus`; `src/links/model.ts#DdGraphNode` | Existing ordinary files need resolved terminal nodes and must never enter the dd queue. | High |
| F-07 | Mermaid rendering marks any edge target absent from `graph.nodes` as unresolved. | `src/links/graph.ts#toMermaid` | A real file node is required; setting only `edge.to` would render a false dashed node. | High |
| F-08 | `ddocs links` and `ddocs graph map` already accept a bare path as a whole-document query outside the parser. | `src/links/report.ts#resolveLinksTarget`; `src/links/map.ts#resolveMapSeed`; `test/acts/dd-graph-map-live.test.ts` test “maps a whole document when the address names no interior” | Bare-path grammar aligns with existing CLI meaning and removes special-case divergence. | High |
| F-09 | Rendering assumes every parsed link has an interior; cross-file dd links rewrite `.dd.json` to `.dd.md` and anchor on the first segment. | `src/render/renderer.ts#renderLink`, `src/render/renderer.ts#looksLikeAddress` | File-target rendering needs its declared target and must emit no `#`; undeclared inference must not start guessing bare paths. | High |
| F-10 | Build renders and reports adapter/live-reference degradations but does not validate link existence. | `src/node/render-document.ts#renderDocument`; `src/acts/build.ts#envelopeFor`; live `ddocs build docs/plans/wishlist.dd.json --check` | Add named file-link findings to `BuildSuccess` and degrade both write and check outcomes without changing exit 0. | High |
| F-11 | The Node filesystem already exposes an exact existence probe, separate from reads and hashes. | `src/node/schema-fs.ts#NodeSchemaFs.exists` | Existence-only can remain literal: no content read, hash, tracking, or schema parse is necessary. | High |
| F-12 | Current tests prove parser round-trips, missing/untracked WARNs, edge/node traversal, whole-document mapping, and renderer link behavior, but none covers local Markdown discovery. | `test/services/dd/core/address.test.ts`; `test/services/dd/core/walk.test.ts`; `test/services/dd/links/traverse.test.ts`; `test/services/dd/render/renderer.test.ts` | Extend the existing behavioral suites and add explicit positive/negative Markdown cases; do not build a parallel test harness. | High |

## Historical Evidence

| ID | Prior friction / decision | Source | Applicability now | Implication |
|----|---------------------------|--------|-------------------|-------------|
| H-01 | Two independent consumers hit the same boundary, and one hand-built the missing existence/freshness check. | `docs/plans/wishlist.dd.json#items/wl-0023` | Direct | The need is consumer-proven; the 2026-08-16 brief supersedes the row’s older “UNRULED” state for the narrow B+C scope. |
| H-02 | Rulings fix WARN-not-error, existence-only, `target: "file"`, no `file#method`, and require the whole-file proposal before dispatch. | `BRIEF-file-links.md#Rulings` | Direct | These are constraints, not design questions. |
| H-03 | `parseAddress` and the link seams are deliberately curated public API. | `docs/plans/002-sdk-build/design-decision.md#D-1` | Direct | Any new exported type or changed return shape needs an explicit surface rationale and installed-package coverage. |

## Risks and Unknowns

| Item | Evidence | Why it matters | Resolution / next evidence |
|------|----------|----------------|----------------------------|
| Public target model | F-03, F-06 | `DdGraphNode` and possibly `DdLinkTarget` currently require dd-only fields (`schema`, `sha`, interior kind). Faking those values would ship a lie; widening them can break SDK consumers. | Plan a discriminated file/document node shape or keep file existence resolution out of `DdLinkTarget`; reviewer must inspect the emitted `.d.ts` delta. |
| Path-base mismatch | F-04, F-09 | Repo-relative structured values and literal Markdown hrefs do not share a base. One resolver for both silently checks the wrong file in one arm. | Carry an explicit cell origin/base (`repo` vs `document`) through collection to resolution; test from a nested dd path. |
| Vacuous WARN test | `BRIEF-file-links.md#The trap` | An implementation that warns on every path passes a missing-only test. | Existing file → zero finding; missing file → exactly one named WARN; mutate the existing target away and restore it. |
| Markdown population | F-12 | A broad regex can classify URLs, images, bare paths, or malformed prose as local file edges. | Pin the narrow inline-link grammar and the required negatives (`https://`, bare path); add malformed/fragment/image cases only if the implementation recognizes them. |
| Graph truthfulness | F-06, F-07 | An existing file can appear unresolved even when validation passes if only edges change. | Assert node kind/resolution and solid Mermaid edge for existing files; missing file stays a dashed unresolved target. |

## Domain Impact

| Domain / boundary | Relationship | Contract or constraint | Evidence |
|-------------------|--------------|------------------------|----------|
| Address grammar | Public syntax and SDK return shape | Bare file path is canonical; `file#method` remains parseable; trailing `#` remains invalid. | F-01–F-03 |
| Schema/link validation | Structured edge production | `target: "file"` is the only typed-column marker; missing target is one WARN. | F-04–F-05, H-02 |
| Markdown prose | Incidental edge production | Only explicit inline links in `text`; local Markdown semantics; external/bare path ignored. | F-12, H-02 |
| Graph/reporting | Public query model | Existing ordinary file is a resolved leaf, never traversed as a dd document. | F-06–F-08 |
| Render/build | Generated human face and build envelope | Structured file paths render as working relative hrefs; build reports degraded and exits 0. | F-09–F-11 |

## Planning Handoff

- **Preserve**: every existing `#interior`/`file#interior` parse and resolution result; same-document semantics; dd-target type checking; path escape warnings; graph determinism; render purity; exit-code/status envelope contract; public export discipline.
- **Change carefully**: `parseAddress`/`formatAddress`; cell collection for `text`; file path base resolution; terminal graph nodes; build degradation aggregation; renderer inference.
- **Likely files/symbols**: `src/core/address.ts`; `src/core/model.ts`; `src/core/validate.ts`; `src/core/walk.ts`; `src/links/{model,traverse,graph,map,report,resolver}.ts` as proven necessary; `src/render/{contract,renderer}.ts`; `src/node/render-document.ts`; `src/acts/{address,build,link,links,graph}.ts`; existing tests/fixtures under `test/services/dd/**` and `test/acts/**`; baked docs source plus generated mirrors if the public grammar is documented.
- **Decisions still required**: exact discriminated public model for ordinary-file graph nodes/resolve output; whether `link resolve <bare-file>` is included or syntax-only while typed/prose links own existence. The whole-file spelling itself is sufficiently evidenced: bare path.
