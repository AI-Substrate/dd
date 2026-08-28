# Immutable correction packet — wl-0023 merge gate

**Role**: coder (fresh replacement fleet)
**PM**: `pij-civil-chinchilla`
**Governing seat**: `pij-mental-dajeil`
**Branch/worktree**: `feat/file-links` at `/Users/jordanknight/substrate/dd-worktrees/file-links`
**Basis before this packet**: `f0464094145cfdb789094d752036013f15cb4951`
**Finding status**: independently reproduced and accepted as merge-blocking by the governing seat

## Assignment

Correct one composition defect: an invalid schema-declared `target: "file"` cell is rejected by `validateLink`, but is still emitted by `collectFileRefs`. It then reaches existence checks, rendering, links, and graph traversal as if it were a legal whole-file reference.

Cold reproduction, with `src/library.ts` present and the cell value `src/library.ts#parseThing`:

- `ddocs validate` returns E406 `link-type-mismatch` **and a false E431** claiming the existing file is missing.
- `ddocs build` returns degraded/exit 0, writes the sibling, and reports the same false warning.
- `ddocs graph` returns ok, emits an edge to an impossible filesystem path ending `src/library.ts#parseThing`, and emits no resolved node for the file that exists.

The defect is at `src/core/validate.ts:578-584`: target classification is treated as sufficient population membership. The comment at `:611-614` says validation already refused `#`; refusal is not exclusion.

## Accepted contract

1. Fix the ordinary-file population at the shared seam, not separately in each act. Only a legal whole-file form may become a `DdFileRef`: parsing succeeds, `file` is non-null, and `segments` is empty.
2. An interior-bearing or otherwise malformed `target:file` value keeps its existing type/grammar ERROR and produces:
   - zero `FileExistence` probes for that value;
   - zero file-link WARN findings for that value;
   - no file edge or node for a fabricated path;
   - no rendered file href for the invalid value. Render the authored text plainly.
3. Valid `target:file` cells remain unchanged: one existence probe, one resolved terminal file node when present, working sibling-relative href, and the existing WARN-only behavior when absent.
4. Do not change whole-file address grammar, incidental Markdown extraction, dd-link resolution, reverse lookup, or ordinary-file inbound scope.

## Mandatory composed proof

Use one document containing both:

- invalid cell: `src/library.ts#parseThing`;
- valid sibling cell: `src/valid.ts`, present on disk.

### Counting existence proof

Pass a counting `FileExistence` into `validateWalk` and assert both directions in the same test:

- invalid cell causes **zero** probes;
- valid cell causes **exactly one** probe of its canonical repository-root path.

Also assert the invalid cell produces E406 without E431. The valid arm is mandatory: “no E431” alone passes if existence probing is disabled for every file cell.

### Graph shipped-surface proof

Drive the shipped graph surface and assert both directions:

- no edge or node contains `src/library.ts#parseThing` or an absolute path with that fragment;
- the valid sibling edge is present;
- the valid sibling node is present, `kind: "file"`, and `resolved: true`;
- the valid file remains a leaf.

Graph is the load-bearing shipped assertion because its current failure is silent under `status: ok`.

### Build/render proof

Drive build or the renderer over the same invalid/valid pair:

- no file finding is produced for the invalid value;
- the invalid value is plain text, not a Markdown href;
- the valid sibling remains a working href and preserves ordinary missing-file behavior.

## Non-vacuity

Prove the new guards rather than naming them:

1. Break/remove the invalid-value exclusion; run the targeted tests and record RED naming the fabricated probe/edge or false finding.
2. Break valid-file admission; run the same targeted tests and record RED naming the missing valid probe/node/href.
3. Restore; record GREEN.

The reviewer will independently inspect or mutate Dim-0. Do not edit assertions to manufacture RED.

## Allowed paths

- `src/core/validate.ts`
- `src/render/renderer.ts`
- `test/services/dd/core/validate.test.ts`
- `test/services/dd/core/walk.test.ts`
- `test/services/dd/render/renderer.test.ts`
- `test/acts/dd-build.test.ts`
- `test/acts/dd-graph-map-live.test.ts`
- this packet, unchanged, only for staging in the packet commit if the PM has not already committed it

Ask the PM before touching any other path.

## Forbidden paths

- `src/core/address.ts` and all address grammar changes
- other production acts, graph/traversal/model files, schemas, exports, dependencies, generated corpus, and baked docs
- `.harness/government/**`
- `.the-flow-state.json`, `the-flow.json`, `the-flow.md`
- `.flow-pair/**`, `.harness/temp/**`, `dist/**`, `coverage/**`, `node_modules/**`
- every `.dd.md` by hand

## Proof before COMPLETE

Run targeted lanes only; skip formatter, project-wide tests, and `just checks` while other seats are active:

```bash
npm test -- test/services/dd/core/validate.test.ts test/services/dd/core/walk.test.ts
npm test -- test/services/dd/render/renderer.test.ts
npm test -- test/acts/dd-build.test.ts test/acts/dd-graph-map-live.test.ts
just typecheck
```

Then commit through:

```bash
harness commit "fix: exclude invalid ordinary-file references" -- <changed-allowed-paths>
```

Do not push. Reply by `pij send` to `pij-civil-chinchilla` with `COMPLETE` or `BLOCKED`, changed paths, commit SHA, exact test counts, both mutation REDs, restored GREEN, and any scope question. Every reply follows C10 wire discipline.