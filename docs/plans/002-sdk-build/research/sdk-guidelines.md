# R-1 research — best-in-class SDK design guidelines

**Satisfies**: R-1's blocking precondition (`requirements.md` §2 — *research before design*).
**Method**: Perplexity deep research (`perplexity_research`, sonar deep model), run 2026-08-08
by the PM (`pij-certain-crab`). Prompt covered: exports-map granularity, root-export/CLI
separation, API surface sizing, ports/DI at the SDK boundary, schema shipping, tarball-testing,
stability marking. Raw response preserved below **unedited** (citations inline as [web:N] —
source URLs in the tail). Interpretation happens in the P2 design doc, not here.

---

## Recommended position

Ship **one npm package with two completely separate entry paths**:

- `bin` points to a thin, side-effectful CLI launcher.
- `exports["."]` points to a **side-effect-free curated library barrel**.
- Add a **small number of capability-level subpaths** such as `./core`, `./links`, `./node`, and `./schema`; do not export the source-tree topology or every file.
- Keep experimental APIs under an unmistakable `./experimental/...` or versioned `./unstable/v1/...` namespace and out of the root barrel.
- Treat every exported runtime symbol, type, subpath, JSON asset, error shape, default, ordering rule, and observable side effect as part of the compatibility budget.

Node describes `exports` as the package's public-interface boundary: once present, undeclared subpaths become inaccessible. It recommends explicit entries when the number is small, patterns only for large sets, and warns that adding `exports` to an existing package is often breaking. [web:16]

### Suggested package shape

```text
src/
  index.ts                 # curated, pure root API
  core/index.ts
  links/index.ts
  ports/index.ts
  adapters/node.ts
  schema/index.ts          # schema URL/path helpers
  experimental/graph.ts
  cli/main.ts              # testable runCli(args, deps)
  cli/bin.ts               # shebang + process wiring only
schemas/
  project.schema.json
dist/
  ...
```

```jsonc
{
  "type": "module",
  "files": ["dist", "schemas", "README.md", "LICENSE"],
  "sideEffects": false,

  "bin": {
    "acme": "./dist/cli/bin.js"
  },

  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./core": { "types": "./dist/core/index.d.ts", "import": "./dist/core/index.js", "require": "./dist/core/index.cjs" },
    "./links": { "types": "./dist/links/index.d.ts", "import": "./dist/links/index.js", "require": "./dist/links/index.cjs" },
    "./ports": { "types": "./dist/ports/index.d.ts", "import": "./dist/ports/index.js", "require": "./dist/ports/index.cjs" },
    "./node": { "types": "./dist/adapters/node.d.ts", "import": "./dist/adapters/node.js", "require": "./dist/adapters/node.cjs" },
    "./schema": { "types": "./dist/schema/index.d.ts", "import": "./dist/schema/index.js", "require": "./dist/schema/index.cjs" },
    "./schema/project.json": "./schemas/project.schema.json",
    "./experimental/graph": { "types": "./dist/experimental/graph.d.ts", "import": "./dist/experimental/graph.js", "require": "./dist/experimental/graph.cjs" },
    "./package.json": "./package.json"
  }
}
```

If CommonJS is not a stated requirement, omit `require` and `.cjs`; ESM-only materially reduces build, type-resolution, testing, and dual-instance complexity. In conditional exports, order matters; the `types` condition should come first and `default`, if used, last. [web:16]

---

## 1. `exports` map and subpath granularity

| Design question | Recommendation | Rationale and trade-off |
|---|---|---|
| Root only | Appropriate for a small, cohesive library whose normal users need roughly the same dependency graph. | Lowest documentation and compatibility cost. A pure ESM barrel can tree-shake well, but Node itself does not tree-shake: importing the root evaluates the reachable module graph. |
| Fine-grained subpaths only | Reserve for frameworks with many independently useful modules, unusually strict bundle boundaries, or APIs where namespace imports are the intended design. | Gives hard dependency and evaluation boundaries, but increases discovery cost, import churn, documentation, declaration files, and the number of semver-protected entry points. |
| Root plus selected subpaths | **Best default here.** Make `.` the easy 80% API and expose a few independently useful or operationally distinct capabilities. | Balances ergonomics with hard boundaries for optional dependencies, platform-specific adapters, schemas, and advanced primitives. |
| Per-file exports | Avoid. Do not mirror `src/**`. | It turns physical layout into public architecture and prevents future file moves, merges, or reorganizations without breaking consumers. |
| Wildcard exports | Use only for genuinely open-ended, homogeneous sets such as locales or generated schemas. Prefer explicit entries otherwise. | Node recommends explicit entries for small sets. `*` is textual substitution and may expose nested files; exclusions require explicit `null` targets. [web:16] |
| Extension choice | Choose exactly one public spelling, such as `pkg/links` or `pkg/links.js`, not both. | Node recommends one canonical subpath per module. Extensioned exports work better with browser import-map folder mappings; extensionless exports are usually more ergonomic and hide storage layout. [web:16] |
| Internal modules | Keep them out of `exports`; use private `package.json#imports` aliases such as `#internal/*` for package-internal imports. | This allows internal refactoring without creating importable npm contracts. |
| `sideEffects` | Set `"sideEffects": false` only if **every exported library module** is import-pure. Otherwise list the actual side-effectful files. | Bundlers use static ESM syntax for used-export analysis and `sideEffects` to omit entire unused module subtrees. A false declaration can incorrectly remove required initialization. [web:23] |

### Tree-shaking conclusion

Subpaths are not a substitute for correct ESM and purity:

1. A root barrel of static `export { x } from "./x.js"` statements can tree-shake successfully.
2. A subpath gives a stronger boundary because the resolver never enters unrelated entry points.
3. Barrels become problematic when re-exported modules have top-level effects, eagerly initialize large dependencies, use CommonJS, or defeat a particular bundler's analysis.
4. Subpaths are therefore most valuable for: heavy optional dependencies; Node-only versus portable code; adapters; schemas/assets; experimental APIs; capabilities consumers commonly use independently.

Also avoid independently bundling every entry point in a way that duplicates class definitions, symbols, registries, or singleton state. Prefer preserved modules or shared chunks so `pkg` and `pkg/core` observe the same runtime identities.

---

## Exemplary packages to study

| Package | Current export strategy | What it demonstrates | Caveat |
|---|---|---|---|
| **Zod 4.4.3** | Root plus explicit families including `./mini`, `./locales`, `./v3`, `./v4`, `./v4/core`; `"sideEffects": false`. [web:31] | Good model when editions and materially different bundles are legitimate user choices. | Versioned paths reflect exceptional migration needs; do not copy without a similar requirement. |
| **Effect 3.22.1** | Root plus a very large explicit module catalog (`effect/Effect`, `effect/Clock`, …). [web:32] | Strong exemplar for an intentionally module-oriented, compositional platform. | Far too granular for a normal SDK. Every entry increases documentation and compatibility obligations. |
| **Vite 8.2.1** | `bin.vite` is `bin/vite.js`; root library is `dist/node/index.js`; deliberate entries `./client`, `./module-runner`. [web:33] | Excellent same-package CLI/library separation. Its `bin` is not the root API. | `./internal` is a specialized ecosystem contract. |
| **esbuild 0.28.1** | Classic `main`/`types` + separate `bin.esbuild`; no `exports` map. [web:34] | Cleanest demonstration that one package can expose CLI and JS API through unrelated entry files. | No `exports` means deep imports are not encapsulated; new packages should use `exports`. |
| **Commander 15.0.0** | One root library export; no `bin`; explicit `files` allowlist. [web:35] | Deliberately cohesive root-only library API. | Not dual-surface; study for root curation. |
| **unified 11.0.5** | One ESM root export, tightly allowlisted files, `"sideEffects": false`. [web:36] | Narrow core; ecosystem composed from separate plugin packages. | Trades single-package convenience for independent plugin versioning. |
| **remark 15.0.1** / **remark-cli 12.0.1** | remark: pure root library. remark-cli: `exports: []`, one `bin`, only `cli.js` shipped. [web:37][web:38] | Strongest possible separation: an executable package explicitly not importable as a library. | Two-package pattern applies if CLI/SDK cadence or stability policy diverge significantly. |
| **TypeScript 7.0.2** | Separate `bin.tsc`, minimal root, explicitly named `./unstable/...` subpaths. [web:39] | Current concrete example of segregating unstable APIs from the executable and stable surface. | "Unstable" must be backed by an explicit compatibility policy. |

---

## 2. Root export and CLI isolation

| Question | Defensible guidance |
|---|---|
| Should `.` exist? | **Yes, normally.** Make it a curated, documented barrel representing the package's primary abstraction. Omitting `.` is justified only when there is no natural default capability or when independent modules are the central design (Effect). |
| What belongs in `.`? | High-frequency stable functions, core input/output types, the primary client/factory, and documented errors. Not: platform adapters, CLI parsers, raw schemas, experimental APIs, generated internals, heavyweight optional integrations. |
| Should root export everything? | No. "Convenient root" is not "recursive index of the repository." Curate manually; review changes to it as API changes. |
| How does accidental CLI execution happen? | If `main`/`exports["."]` points at the executable — or the root imports a module that performs top-level `parse(process.argv)`, writes output, installs handlers, mutates globals, or calls `process.exit()` — ordinary `import "pkg"` performs CLI behavior. |
| Correct dependency direction | `bin.ts → cli/main.ts → public core`; never `index.ts → bin.ts`. The library knows nothing about argv, terminal colors, exit codes, or process lifecycle. |
| Thin bin launcher | Shebang, call a testable `runCli(process.argv.slice(2), adapters)`, map result to `process.exitCode`, final presentation only. [web:181][web:182] |
| Export the CLI parser? | Only if programmatic command embedding is a supported use case; then a pure builder from `./cli`, automatic parsing solely in `bin.ts`. |
| `main` versus `exports` | `exports` takes precedence in modern Node; legacy `main`/`types` should point at the library root — never the bin. [web:16] |

---

## 3. Sizing the public API

| Principle | Application |
|---|---|
| One consumer is evidence, not a specification | One real consumer discovers requirements, but its filenames, workflow states, and orchestration should not automatically become SDK concepts. Extract stable domain concepts; keep consumer-specific orchestration behind an adapter. |
| Do not speculate broadly | Start with demonstrated use cases; write at least one second, meaningfully different example before generalizing. "Might be useful" is insufficient for a permanent export. |
| Hyrum's Law | With enough consumers, every observable behavior acquires a dependency. Fewer exports, fewer globals, deterministic behavior, explicit contracts preserve change freedom. [web:301] |
| Deep modules | Prefer a small interface hiding substantial complexity over many shallow wrappers mirroring implementation steps (Ousterhout). |
| Public means semver cost | Exported names AND TypeScript types are contracts; published types are part of the semver contract. [web:258][web:260] |
| Compatibility is more than compilation | Source, runtime, and semantic compatibility are distinct; changed defaults/ordering/interpretation can be breaking while still type-checking. [web:303] |
| Primitives versus facades | Provide **semantic, composable primitives**, not storage-level internals; put the common workflow in a convenience facade implemented on those primitives (cf. Azure SDK core/convenience layering). [web:295] |
| Representation hiding | Do not expose mutable implementation fields, cache layout, AST internals, or concrete fs implementation types (cf. Rust API guidelines on public fields). [web:271] |

### Admission test for a stable export

| Gate | Required evidence |
|---|---|
| User value | One concrete use case + a plausible second use not merely duplicating the first consumer. |
| Semantic ownership | The concept belongs to the package's domain, not one application's workflow. |
| Contract clarity | Inputs, outputs, errors, cancellation, concurrency, ownership, determinism documentable. |
| Evolution path | Optional additions or a V2 path possible without changing existing callers. |
| Testability | Testable solely through its public import path and public types. |
| Maintenance | Team willing to preserve or deprecate under published policy. |
| Layering | Does not leak a third-party dependency or representation unnecessarily. |

If any gate fails, keep the symbol internal or experimental.

---

## 4. Ports, adapters, and dependency injection

| Design area | Recommendation |
|---|---|
| Public ports | Small, capability-oriented structural interfaces (`ReadFilePort`, `HashPort`, `Clock`); never all of Node's `fs` or a broad `Platform`. [web:56] |
| Constructor/factory | `createClient({ fs, hash, clock })` — one readonly options object; future optional settings without positional churn. |
| Defaults | Offer `createNodeClient()` / `nodePorts` from `pkg/node`; keep Node built-ins out of the portable core's module graph. |
| Interface-first | Interfaces for caller-implemented capabilities; concrete class exports only when runtime identity/lifecycle is itself the contract. |
| Ownership | State explicitly: caller-owned ports are not closed/disposed by the SDK; SDK-created resources get explicit `close()`/`dispose()`. |
| Errors | Domain errors at the core boundary; preserve originals as `cause`; never leak `node:fs` errors as the only contract. |
| Adding methods | Adding a required method to a caller-implemented interface is BREAKING. Use `PortV2 extends Port`, a separate capability port, or an optional member with documented fallback. [web:258] |
| Structural typing risk | Keep port names/shapes domain-specific; add a nominal brand only where confusing two ports would be dangerous. |
| Stability | Own the port types in your package; referencing third-party interfaces makes their release cycle part of your semver surface. |

---

## 5. Shipping JSON schemas and data assets

| Pattern | Recommendation |
|---|---|
| Export JSON directly | Stable named path (`./schema/project.json`), `schemas/**` in `files`; consumers use `import ... with { type: "json" }`. [web:91] |
| Export a JS wrapper | `pkg/schema` exporting a typed schema object — best TS ergonomics; keep off the root barrel. |
| Resolve URL helper | `projectSchemaUrl(): URL` — decouples consumers from physical layout. |
| Resolve fs path | `projectSchemaPath()` Node-only, in `pkg/node`. |
| Consumer-side resolution | `import.meta.resolve("pkg/schema/project.json")` — Node applies package-export resolution. [web:40] |
| Copy command | `pkg schema copy --to ./schemas` only when external tools require a repo-local file; version/hash it; never silently overwrite. |
| `$schema` | Offer a hosted canonical URL and/or documented resolution; `./node_modules/...` paths are fragile under pnpm/PnP. |

Treat the schema's **content and identifier** as API. Breaking validation changes require a major version or a new versioned schema path.

---

## 6. Test the published artifact, not just source

| CI layer | What to run | Catches |
|---|---|---|
| Tarball inventory | `npm pack --dry-run --json` then real `npm pack --json`. [web:151] | exports target built locally but excluded by `files`; missing schemas/declarations/shebang. |
| publint | `npx publint --strict` post-build. [web:143] | Invalid/inconsistent exports, main, module, types, formats, targets absent from publish list. |
| Are The Types Wrong | `npx @arethetypeswrong/cli --pack .` (supports npm-pack tarballs). [web:139] | ESM/CJS declaration mismatches, untyped resolutions, resolution-mode failures. |
| Installed fixtures | Temp projects installing the `.tgz` — NOT `file:..`, NOT workspace links. | Published-but-missing files, reliance on source, undeclared deps, bad bin links. |
| ESM fixture | Import every documented subpath; assert root import produces **no output or process effects**. | Export-map defects; accidental CLI execution. |
| TS fixture | Compile under lowest + newest supported TS with `node16`/`nodenext`. | Declaration reachability, leaked private types. |
| CLI fixture | Invoke `node_modules/.bin/<cli>` for help/success/invalid-args; assert stdout/stderr/exit code. | Missing shebang, bin not packed, unintended `process.exit`. |
| Schema fixture | Resolve exported schema from installed tarball; validate valid + invalid fixture docs. | "Exported in package.json but not in tarball", invalid JSON, stale helper. |
| API report/type tests | API Extractor reports committed; `tsd`/`expect-type` for tricky generics. [web:266] | Accidental public exports; declaration-level breaking changes runtime tests miss. |

Run the same gate in CI; never rely solely on `prepublishOnly` (publishing can disable lifecycle scripts).

---

## 7. Versioning and experimental surfaces

| Strategy | Guidance |
|---|---|
| Stable root + stable subpaths | Same semver guarantee; a subpath is not "less public" for being outside the barrel. [web:227] |
| Experimental subpath | Conspicuous `pkg/experimental/...`, excluded from `.`, `@experimental` on every item. |
| Versioned unstable path | `pkg/unstable/v1/...` for volatile protocols; redesign appears at `v2` without silently changing imports. |
| Prerelease channel | `1.4.0-beta.1` under `beta`/`next` dist-tag for package-wide experiments. [web:233] |
| Promotion | Add stable path first; keep experimental path as deprecated re-export for a documented window; never silently retarget an existing path to changed semantics. |
| Experimental policy | State whether breaking experimental changes may occur in minors, the deprecation window, and stabilization criteria (cf. Google AIP-181, ~90-day rule of thumb). [web:311] |
| Behavioral changes | Version defaults, ordering, normalization, error codes, and schema semantics — not just signatures. [web:303] |
| API lock | One reviewed API report per stable entry point; explicit export allowlists so `export *` cannot silently create commitments. |

Node's own model is useful language: experimental APIs sit outside normal semver guarantees; stable APIs prioritize ecosystem compatibility — documented explicitly, not inferred from naming. [web:226]

## Final design decision (researcher's synthesis)

Use **both** a curated root and a handful of explicit capability subpaths. Keep the root pure and convenient; use subpaths to isolate platform adapters, advanced primitives, assets, and experimental features. Point `bin` at an entirely separate executable that imports the library — not vice versa. Base stable exports on demonstrated domain use cases, but design them consumer-neutral and composable. Make the packed tarball and installed fixture — not the source workspace — the object tested and approved for release.

---

## Source index (abridged — key citations)

- [web:16] nodejs.org/api/packages.html — exports as the public-interface boundary
- [web:23] webpack.js.org/guides/tree-shaking
- [web:31–39] package.json files of zod, effect, vite, esbuild, commander, unified, remark, remark-cli, typescript
- [web:40] import.meta.resolve (Node ESM docs)
- [web:49/56] Microsoft DI guidelines; AWS hexagonal-architecture guidance
- [web:91] nodejs.org/api/esm.html — JSON import attributes
- [web:139] arethetypeswrong CLI (--pack support)
- [web:143] publint
- [web:151/152] npm pack / npm publish docs
- [web:181/182] npm bin field discussions/docs
- [web:226/227] Node stability index; semver.org
- [web:233] npm dist-tags (pnpm docs)
- [web:258/260] semver-ts.org — types as semver contract
- [web:266] api-extractor.com
- [web:271] rust-lang.github.io/api-guidelines/future-proofing
- [web:295] Azure SDK protocol/convenience layering
- [web:301] hyrumslaw.com
- [web:303/311] Google AIP-180 (compatibility) / AIP-181 (stability levels)
