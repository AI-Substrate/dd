# P1 · F-4 re-derivation — the `src/plan/` module count, measured

**Phase**: P1 (`dispatch-plan.md`), task T3. **MEASUREMENT ONLY.**
**Derived at**: worktree `s002-sdk-build`, HEAD `7146803`.
**Question (F-4)**: `requirements.md` §4.1 says `src/plan/` imports **six** modules absent from
the `exports` map, **one** (`links/model`) reachable because `links/index` re-exports it
wholesale — yet its table names only **four** modules. Six-minus-one is five; the table shows
four. Re-derive the real numbers.

> **This document does not edit `requirements.md`** (packet forbids it) and takes no position on
> what should be exported. It reports what IS.

---

## Method

**Extract every cross-module import in `src/plan/`** (the `../` specifiers — intra-`plan/`
imports are irrelevant to the exports map):

```bash
cd /Users/jordanknight/substrate/dd-worktrees/s002-sdk-build
grep -rhn "from '\.\./" src/plan/*.ts | sed "s/.*from '//;s/'.*//" | sort -u
```

**Probe each module AND each symbol against the real map** (Node self-reference, post-build, so
resolution goes through `package.json#exports` exactly as a consumer's would):

```bash
npm ci && npm run build
node ./p1-probe2.tmp.mjs      # await import() per subpath + `sym in module` per public barrel
```

The symbol probe is the part §4.1 could not have done by reading: a module can be absent from
the map while its symbols are still reachable **through a barrel that re-exports them**. That
is exactly where the discrepancy lives.

---

## Raw measurement — 13 cross-module modules

| # | Module imported by `src/plan/` | Subpath in `exports`? | Probe |
|---|---|---|---|
| 1 | `core/address` | ✅ `./core/address` | subpath EXPORTED |
| 2 | `core/model` | ✅ `./core/model` | subpath EXPORTED |
| 3 | `core/validate` | ✅ `./core/validate` | subpath EXPORTED |
| 4 | `core/walk` | ✅ `./core/walk` | subpath EXPORTED |
| 5 | `links/index` | ✅ `./links` | subpath EXPORTED |
| 6 | `schema/index` | ✅ `./schema`, `./schema/index` | subpath EXPORTED |
| 7 | `core/constants` | ❌ | `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| 8 | `core/derive` | ❌ | `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| 9 | `core/rel` | ❌ | `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| 10 | `core/value` | ❌ | `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| 11 | `links/map` | ❌ | `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| 12 | `links/model` | ❌ | `ERR_PACKAGE_PATH_NOT_EXPORTED` |
| 13 | `shared/posix-path` | ❌ | `ERR_PACKAGE_PATH_NOT_EXPORTED` |

**Modules absent from the map: 7** — not six.

## The re-export layer — which absences are actually reachable

`src/links/index.ts` is a barrel, and it covers **two** of the seven absentees, by two
different mechanisms:

| Absent module | Mechanism in `src/links/index.ts` | Symbols `src/plan/` needs | Reachable? |
|---|---|---|---|
| `links/model` | `export * from './model.js';` — **wholesale** | `DdLinkEdge` (type) | ✅ via `@ai-substrate/dd/links` |
| `links/map` | **named re-export list**, not wholesale | `addressableAt`, `anchorForLocation`, `indexDocument`, `DdDocumentIndex` (type), `DdAddressableKind` (type) | ✅ all five — each is named in the list |

Probe output for the runtime three:

```
addressableAt       links/map   REACHABLE via @ai-substrate/dd/links
anchorForLocation   links/map   REACHABLE via @ai-substrate/dd/links
indexDocument       links/map   REACHABLE via @ai-substrate/dd/links
```

`DdDocumentIndex` and `DdAddressableKind` are both listed explicitly in the same
`export { … } from './map.js'` block, so the type half is reachable too.

**This is the first half of the discrepancy.** §4.1 credits the re-export layer with rescuing
**one** module (`links/model`, wholesale). It rescues **two** — `links/map`'s entire consumed
surface comes through the named list. §4.1 appears to have reasoned from the mechanism
(`export *` is visible as wholesale rescue) and missed that an explicit named list achieves the
same reachability for the symbols that happen to be on it.

## The genuinely unreachable set

Seven absent modules − two rescued by `links/index` = **five modules with no public path**:

| Module | Symbols `src/plan/` imports | Probe verdict |
|---|---|---|
| `core/constants` | `DEFAULT_GATE_TERMINAL_STATES` | UNREACHABLE (runtime) |
| `core/derive` | `deriveItems` | UNREACHABLE (runtime) |
| `core/rel` | `effectiveRel`, `collectDeclaredRels` | UNREACHABLE (runtime) |
| `core/value` | `isRecord` | UNREACHABLE (runtime) |
| `shared/posix-path` | `isWithin`, `resolveInRepo` | UNREACHABLE (runtime) |

Probe output verbatim:

```
DEFAULT_GATE_TERMINAL_STATES  core/constants       UNREACHABLE (runtime)
deriveItems                   core/derive          UNREACHABLE (runtime)
collectDeclaredRels           core/rel             UNREACHABLE (runtime)
effectiveRel                  core/rel             UNREACHABLE (runtime)
isRecord                      core/value           UNREACHABLE (runtime)
isWithin                      shared/posix-path    UNREACHABLE (runtime)
resolveInRepo                 shared/posix-path    UNREACHABLE (runtime)
```

("UNREACHABLE (runtime)" here means: the symbol is not present on **any** of the eleven public
subpaths, probed by `sym in module` across all of them — not merely that its own module is
unlisted.)

**This is the second half of the discrepancy.** §4.1's table names **four** modules. The fifth,
`shared/posix-path`, is missing from it — and with it two symbols, `isWithin` and
`resolveInRepo`, which `src/plan/check.ts:12` imports.

---

## Verdict — F-4 resolved

| Claim in §4.1 | Measured at `7146803` | Status |
|---|---|---|
| six modules absent from the map | **seven** | ✗ undercount by 1 |
| one reachable via `links/index` wholesale | **two** rescued (`links/model` wholesale, `links/map` by named list) | ✗ undercount by 1 |
| "five symbols across four modules are unreachable" | **seven symbols across five modules** | ✗ undercount by 2 symbols, 1 module |

**Why the arithmetic looked wrong**: it wasn't a typo. "Six minus one" gave five *symbols* in
the prose while the table listed four *modules* — two different units compared as if they were
one, and both numbers happened to be wrong anyway. The corrected statement is:

> `src/plan/` imports **13** modules across module boundaries. **Seven** are absent from the
> `exports` map. **Two** of those seven are nonetheless fully reachable through the `links`
> barrel. **Five** modules — carrying **seven** symbols — have no public path at all:
> `DEFAULT_GATE_TERMINAL_STATES`, `deriveItems`, `effectiveRel`, `collectDeclaredRels`,
> `isRecord`, `isWithin`, `resolveInRepo`.

**Direction of the error**: §4.1 **understated** the gap. Its conclusion — that harness cannot
re-implement plan semantics on today's public surface — survives re-derivation and is if
anything stronger.

**Standing caveat, unchanged**: per §4.1's own header ruling this census measures the
**re-implementation** population, not the trial population. Correcting its arithmetic does not
promote it to being Q-4's input. Q-4's floor comes from `p1-import-census.md`. This document
only makes the historical estimate accurate about the thing it does measure.

---

## Cross-check against the trial population

Of the seven unreachable symbols above, **zero are imported FROM dd** by the four adapting
harness files. Of the six unreachable symbols the trial needs
(`p1-import-census.md` group B1), **zero** appear in `src/plan/`'s import graph. As
*dd-consumed* populations the two are **disjoint** — measured, not argued. That is the sharpest
available evidence for the §4.1 header ruling: neither census is a proxy for the other, because
they share no members at all.

**One name-level overlap, which is not a counter-example but is worth recording precisely.**
`isWithin` and `resolveInRepo` appear in BOTH lists by name — but the harness files import them
from their **own** `harness/cli/src/services/shared/posix-path.ts`
(`flow.ts:79`, `plan/index.ts:47`), never from dd. So they are not dd-surface consumption in
the trial population, and the disjointness above holds as stated.

**Measured, unprompted**: those two files are **byte-identical duplicates**.

```bash
diff harness/cli/src/services/shared/posix-path.ts \
     <dd>/src/shared/posix-path.ts   # → no output (IDENTICAL)
shasum -a 256 …
f051a39f5b74d6ae76b723c0da585de80c527208e8b19b610c5db9408fa8f9cf   (both, 124 lines)
```

Recorded as a fact about the current state, with **no recommendation attached** — whether that
duplication is resolved by an export, left alone, or handled some third way is a P2 question
about what is offered, and the R-1 boundary puts it out of this document's reach. What P1 can
say is that the duplication exists today and is exact, so the two copies are currently in
agreement and any future drift between them would be silent.
