# P4 — S-1 Windows drive-letter fix · what the two families actually were

**Phase**: P4 of `dispatch-plan.md`. Spec: `tasks/p4-windows-paths.md`; constraints:
`requirements.md` §7a S-1. Basis: upstream `cfa501a6` (the two-family split this phase
inherits) and `4297c100` (the follow-on, not applicable here).

Commits:

| Family | Commit | Files |
|---|---|---|
| F2 · absoluteness detection | `5b6ad12` | `src/acts/doctor.ts`, `src/acts/graph.ts`, `src/core/validate.ts` |
| F1 · identity spelling | this commit | `src/core/validate.ts` |

Surface-neutral, as required: **no new public symbol, no `package.json` change, no
exports-map change.** Two module-private helpers were added inside `src/core/validate.ts`
(`isRootAnchored`, `canonicalFilePath`); one module-private function was DELETED from each
of `doctor.ts` and `graph.ts`. The two exported functions that changed —
`resolveAddressFile` and `isPathWithinRepo`, both already on the public `./core/validate`
subpath — kept their signatures exactly.

---

## F2 — absoluteness detection (measured, user-visible)

Three sites asked "is this absolute?" with `startsWith('/')`. A Windows drive-letter path
does not start with `/`, so it was read as RELATIVE and glued onto whatever anchor was to
hand. Reproduced on this tree at `68bc594`, before any edit:

```
$ node -e "const f=(p,r)=>p.startsWith('/')?p:(r+'/'+p).replace(/\/+$/,'');
           for (const p of ['C:\\\\repo\\\\docs','C:/repo/docs','c:/repo/docs','/abs/docs','docs'])
             console.log(JSON.stringify(p),'->',JSON.stringify(f(p,'/repo')))"
"C:\\repo\\docs" -> "/repo/C:\\repo\\docs"
"C:/repo/docs"  -> "/repo/C:/repo/docs"
"c:/repo/docs"  -> "/repo/c:/repo/docs"
"/abs/docs"     -> "/abs/docs"        <- correct, and stays correct
"docs"          -> "/repo/docs"       <- correct, and stays correct
```

The forward-slash row is the load-bearing one: it shows this is **not** a separator bug.
The old test accepted forward slashes exactly as badly as backslashes. What it could not
see was drive-letter ABSOLUTENESS — which is also why `toPosix` is not the fix. `toPosix`
changes SPELLING; the predicate is what was wrong.

| Site | Fix | Consequence when it fired |
|---|---|---|
| `acts/doctor.ts:129` | delete `resolveScope`, call `resolveInRepo` | `dd doctor --path` swept a directory that cannot exist and reported a confident clean run over nothing |
| `acts/graph.ts:385` | delete `resolveScope`, call `resolveInRepo` | `dd graph --path` graphed nothing, same shape |
| `core/validate.ts:88` | `isRootAnchored` predicate | a drive-letter address target resolved under the CITING document — library surface |

The two act sites held **byte-identical** copies of `resolveScope`. Both were deleted
rather than repaired, so the fix removes a duplicated grammar instead of adding a third.

`resolveInRepo` is deliberately NOT used at the core site. It anchors on the repo root; an
address anchors on the **citing document**. Same defect, different anchor — reaching for
the same helper there would have been a second bug wearing the fix's clothes.

### Deviation from the upstream fix pattern — the one that matters

Upstream fixed all three sites by importing `resolveInRepo` / `ABSOLUTE_LOGICAL` from
`shared/posix-path.ts`. **`src/core/**` cannot do that.** dd-core is transitively free of
`node:` builtins, enforced mechanically:

- `test/architecture/dd-core-isolation.test.ts` — *"keeps production dd-core transitively
  free of output, acts, adapters, and node builtins"*, which walks every import edge from
  `src/core/**` and reports a `node builtin:` violation with its full trace.
- `src/shared/posix-path.ts:1` — `import { posix } from 'node:path'`.

So `ABSOLUTE_LOGICAL` is **mirrored** in `core/validate.ts` as a local const, not imported.
Mirroring is a real cost and it should be named as one: there are now two copies of one
grammar, in `shared/posix-path.ts` and in `core/validate.ts`, and nothing mechanically
holds them together.

What it buys back is larger than what it costs, and inside this module it is a net
reduction. `validate.ts` already contained **two** hand-rolled absoluteness tests of the
same fact:

- `startsWith('/')` in `resolveAddressFile` (line 88) — drive path judged RELATIVE
- `/^[A-Za-z]:[\\/]/` in the `address-path-absolute` finding (line 161) — drive path
  judged ABSOLUTE

One module, one question, two answers, and they disagreed **on exactly the case at hand**.
That is not a coincidence to fix twice; it is how the defect got in. Both now call the one
`isRootAnchored`. Net grammar count inside `validate.ts`: 3 → 1.

**Widening, disclosed:** a backslash-rooted address (`\foo`) is now also reported
`address-path-absolute`. It always was absolute; it was simply never told. `resolveAddressFile`
is unaffected by this — it slash-normalises before testing.

---

## F1 — identity spelling

A resolved path in dd is not merely a location, it is an **identity**: compared with `===`
(`core/walk.ts:123`, `render/refresh.ts:147`), used as an index key (`plan/index-plan.ts`),
and used as the memoizing loader's cache key. Two spellings of one document therefore
become two documents.

dd has two producers of that identity, and they disagreed about drive-letter case:

| Producer | Grammar | Spelling | Where paths from it come from |
|---|---|---|---|
| `shared/posix-path.ts` (`toPosix`, `posixJoin`, `resolveInRepo`) | upper-cases the drive | `C:/repo/x` | the filesystem — `repoRoot` is `toPosix(cwd())` (`acts/shared.ts:193`), every swept path is `posixJoin`-built (`links/scan.ts:47`) |
| `core/address.ts` (`normalizeFilePath`) | leaves the drive alone | `c:/repo/x` | a parsed dd ADDRESS, through `resolveAddressFile` |

`links/resolver.ts:176-179` chooses between them **in a single expression**, on nothing
more than whether the address has a citing document:

```ts
const targetPath =
  address.file === null   ? (options.fromPath as string)
  : options.fromPath === null ? resolveInRepo(address.file, options.repoRoot)
  : resolveAddressFile(options.fromPath, address.file);
```

So one address text resolves to two different strings depending on where it was written.
That is the whole defect. The fix is `canonicalFilePath` in `core/validate.ts`, applied in
`resolveAddressFile` and `isPathWithinRepo` — canonicalising where the two producers MEET
rather than at either call site, so every consumer converges at once.

### Reachability — stated precisely, because the ordering is the interesting part

This was **not** reachable before the F2 commit. A drive-letter address was re-anchored
before it could be mis-spelled, so it failed for the other reason. F2 stops the
re-anchoring and hands the path through **in the spelling the author used** — which is
what arms F1.

That is not an argument for merging the two commits; it is the strongest argument for
splitting them. The families are distinct in kind (*wrong place* vs *right place, wrong
name*) and ordered in exposure, and the second is invisible until the first is fixed. A
single commit would have shipped the exposure and the fix under one message, and a later
bisect or revert could not tell them apart.

It also explains, mechanically, why S-1 makes the lowercase-drive test **mandatory**: it is
the only assertion that catches F1 being left behind by F2. The upstream note —
*"correctness currently depends on which runs first"* — is now pinned rather than trusted.

**Observable before the fix** (from `path-identity.test.ts`, run red first): a
lowercase-drive address naming a document that exists, cited from a document in the same
repo, is refused as `address resolves outside the repository` by `isPathWithinRepo`, and
the loader is never asked for it. dd reports an in-repo document as outside the repo.

### What was NOT changed, and why

- **`normalizeFilePath` (`core/address.ts`)** — the tempting fix, deliberately declined on
  two independent grounds. It is exported from the public `./core/address` subpath, so its
  spelling is **surface, not detail**, and this phase is surface-neutral by definition
  (S-1 constraint 4; design ratification in flight). It is also outside this phase's write
  fence. Upstream declined it too, and pinned the interaction with a test instead of
  changing it. **Residual, recorded rather than fixed:** `./core/address`'s exported
  `normalizeFilePath` still returns the author's drive case, so a consumer that calls it
  directly and compares against a filesystem-produced path still sees two spellings.
  Everything reachable through `./core/validate` and `./links` now agrees.
- **`plan/index-plan.ts` (`itemKey`, `displayAddress`) and `links/map.ts` (`nodeId`)** —
  these are upstream's *named* F1 sites (`cfa501a6`) and they are **still unfixed in this
  fork**; verified at `68bc594`: `itemKey` is `` `${path}#${interior.join('/')}` `` with no
  `toPosix`, and `nodeId` likewise. Both are outside this phase's allowed paths
  (`src/plan/` is explicitly forbidden; `links/map.ts` is not in the fence). **Finding for
  the PM, not a defect introduced here** — the forward port of `cfa501a6`'s F1 half is
  outstanding, and the fix applied here does not cover it.

---

## Proof

Every assertion fails on a POSIX host with its fix reverted — drive letters and backslashes
are just strings, so no Windows host is needed.

**Red first.** Both test files were written and run before any source edit: 9 red / 7 green
for F2 (the 7 green are the regression rows, which is the point — they pin what must not
change), 5 red / 5 green for F1.

**Verified by negation, one site at a time** — so each site is independently covered rather
than masked by the others:

| Reverted | Result |
|---|---|
| `core/validate.ts` `isRootAnchored` | 3 red |
| `acts/doctor.ts` `resolveInRepo` | 3 red |
| `acts/graph.ts` `resolveInRepo` | 3 red |
| all restored | 16 green |
| `core/validate.ts` `canonicalFilePath` (body → `normalizeFilePath(raw)`) | 5 red |
| restored | 10 green |

**Regression rows, both families**: posix-absolute still passes through; genuinely relative
still re-anchors (on the repo root for the acts, on the citing document for the core);
a path that genuinely leaves the repo is still refused.

**Lowercase-drive rows are present at both layers**, per S-1. At the act layer they passed
as soon as F2 landed, because `resolveInRepo` spells through `toPosix`. At the core layer
the F2 file's lowercase row asserts **only** that the path was not re-anchored and says
nothing about drive case — answering that there would have merged the two families into one
test. The case question is answered in the F1 file.

### Gate

`just checks` — exit **0** at each commit. No C-6 instance: no transient red, no silent
exit 1, nothing re-run to get a different answer.
