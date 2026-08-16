# Whole-file address form proposal — wl-0023

**Decision proposed**: a whole file is written as its bare repository path, with no `#`.

```text
src/search/index.ts                  whole file
src/search/index.ts#parseThing       future interior/symbol form (syntax already valid; resolution out of scope)
plan.dd.json#acceptance_criteria/ac-1a2b  existing dd interior form (unchanged)
```

## Canonical model

`parseAddress("src/search/index.ts")` returns:

```ts
{ file: "src/search/index.ts", segments: [] }
```

`formatAddress` emits `src/search/index.ts` whenever `segments` is empty. The CLI reports this as `form: "file"`, `classified: false` without resolution, and an empty `segments` array. Empty input and `src/search/index.ts#` remain malformed. `#section`, `file#section/id`, multiple-`#` rejection, `@` reservation, segment validation, normalization, and all existing dd resolution remain unchanged.

## Why bare path

1. **It is the ruled data shape.** Typed columns store plain repository-relative paths; requiring another spelling in the grammar would make storage and addressing disagree.
2. **It already means “whole document” on two shipped faces.** `ddocs links <path>` and `ddocs graph map <path>` special-case a bare path today. Moving that meaning into the parser removes divergence rather than inventing a new convention.
3. **It preserves the future form.** A fragment remains available: `file#method`. No delimiter is consumed merely to say “there is no interior”.
4. **It round-trips without decoration.** Parsing and formatting do not add an empty fragment that the author never wrote.
5. **It is ordinary link syntax.** Rendered file links can use the real path; no custom `file:` scheme needs translation before GitHub or a Markdown reader can open it.

## Rejected forms

| Form | Rejected because |
|------|------------------|
| `src/search/index.ts#` | Encodes absence as an empty interior; the current grammar deliberately rejects it; creates a meaningless fragment in rendered hrefs; disagrees with the ruled plain-path column. |
| `file:src/search/index.ts` | Invents a dd-only scheme, is not the ruled stored value, needs renderer/CLI translation, and creates avoidable ambiguity around platform path syntax. |
| `src/search/index.ts#file` | Claims a synthetic interior that does not exist and occupies the fragment namespace reserved for later real interiors. |

## Semantic fence

The grammar’s acceptance of a bare path does not authorize path guessing. A structured file edge still requires schema `target: "file"`; an incidental prose edge still requires explicit inline Markdown `[label](path)` inside a declared `text` field. A bare path mentioned in prose remains unchecked.

Structured `target: "file"` values resolve from the repository root, matching the brief’s repo-relative contract. Incidental Markdown destinations resolve from the containing generated document, matching Markdown click behavior. Both check only existence. No content read, hashing, tracking, schema resolution, freshness, or `verify-basis` integration is added.

## Compatibility and proof

- Run LSP references for public `parseAddress` before editing and migrate every caller cleanly.
- Preserve all existing parser worked examples byte-for-byte.
- Prove `src/foo.ts#parseThing` remains syntax-valid and unclassified.
- Prove existing file → no finding; remove it → exactly one WARN naming the path; restore it → no finding.
- Prove trailing `#`, empty input, external Markdown URL, and bare prose path do not become valid file edges.

**Recommendation**: adopt the bare-path whole-file form.
