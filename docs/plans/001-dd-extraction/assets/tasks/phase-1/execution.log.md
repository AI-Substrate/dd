# Execution log — Phase 1: SDK core port (ph-4c9d)

**Plan**: `docs/plans/001-dd-extraction/plan.dd.json` · **Tasks**: `assets/tasks/phase-1/tasks.dd.json`
**Upstream basis SHA**: `d08f4942d28b7e5181d5845a56a63b0cbb1d3402` (`AI-Substrate/harness-engineering`, read-only)

---

## tk-0001 — port both upstream boundary guards

Read `harness/cli/test/architecture/dd-core-isolation.test.ts` and
`dd-plan-semantics-frozen.test.ts` at the basis SHA. Both contracts are transcribed into
the context brief (§ Boundary contracts). **KF-5: no conflict with this plan found.**

Ported to `test/architecture/`:

- `dd-core-isolation.test.ts` — adapted to the `src/` layout (`CORE = src/core`,
  `SRC = src`). The upstream dependency-cruiser assertion is dropped (no
  `.dependency-cruiser.cjs` here) and its slot taken by a new **SDK-tree external-import
  gate** for ac-0001: every import in `src/{core,docs,links,mutate,plan,render,schema,shared}`
  must be a `node:` builtin or a relative path resolving *inside* the SDK tree.
- `dd-plan-semantics-frozen.test.ts` — re-pinned against `src/plan/semantics.ts`, upstream
  rationale preserved verbatim, OQ-2 caveat added.

### Red → green

```
# RED — before the port (npx vitest run test/architecture)
 ❯ dd-plan-semantics-frozen.test.ts (2 tests | 2 failed)
     × has not changed since the readiness gate composed it
       Error: ENOENT ... open 'src/plan/semantics.ts'
     × still carries the written rationale for excluding `pressure` ...
       Error: ENOENT ... open 'src/plan/semantics.ts'
 ❯ dd-core-isolation.test.ts (4 tests | 2 failed)
     ✓ detects deliberate direct and transitive boundary violations
     ✓ detects a deliberate external import in the SDK tree (ac-0001 red case)
     × keeps production dd-core transitively free of output, acts, adapters, and node builtins
       Error: ENOENT ... scandir 'src/core'
     × keeps the whole SDK tree free of external imports (ac-0001)
 Tests  4 failed | 2 passed (6)

# GREEN — after tk-0002
 ✓ test/architecture/dd-plan-semantics-frozen.test.ts (2 tests) 2ms
 ✓ test/architecture/dd-core-isolation.test.ts (4 tests) 10ms
 Tests  6 passed (6)
```

The two synthetic detector cases pass in **both** states by design — they are the proof the
guards *fire*, driven off in-memory sources rather than the tree, so a missing tree cannot
make them lie. The four production assertions are the ones that go red-then-green.

**Load-bearing result**: the re-pinned digest came out
`3856153824f7fd3448aaf285197054a2f4a2524ed80c0fffe6dc9a3f8526f150` — **byte-identical to
the upstream pin**. The frozen-semantics guard therefore independently proves the port is
verbatim, which is a stronger receipt than the copy command itself.

---

## tk-0002 — copy the SDK + posix-path shim

```bash
git -C ../harness-engineering rev-parse HEAD
# d08f4942d28b7e5181d5845a56a63b0cbb1d3402

for d in core docs links mutate plan render schema; do cp -R "$UP/dd/$d" src/; done
cp "$UP/shared/posix-path.ts" src/shared/posix-path.ts
```

| Measure | Value |
|---|---|
| `.ts` files copied | **45** (matches the plan's count) |
| total files copied | **49** (45 `.ts` + 3 docs assets + the shim) |
| non-`.ts` assets | `docs/content/dd-overview.md`, `docs/content/how-to-add-a-schema.md`, `docs/dd-docs-manifest.json` |
| `tsc -p tsconfig.json` | **exit 0** |

The "48 vs 45" delta in the plan text is the 3 docs assets (see the context brief's
Discoveries row — recorded, scope unchanged).

**One mechanical adjustment**: the tree rose a directory, so the 8 files importing the shim
moved `'../../shared/posix-path.js'` → `'../shared/posix-path.js'`
(`links/{graph,map,report,resolver,scan}`, `plan/check`, `schema/{resolve,scan}`). Every
intra-dd relative specifier is untouched. No behavioural edit anywhere.

**KF-1 status: clean.** The port introduced **zero** new external imports — the ac-0001
gate proves it on every run.
