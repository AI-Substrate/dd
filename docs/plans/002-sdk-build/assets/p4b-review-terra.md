# P4B narrow review — `252402c`

## Verdict

APPROVE.

## Scope and fence

```
git diff-tree --no-commit-id --name-only -r 252402c
src/links/map.ts
test/services/dd/links/map.test.ts
```

The only production edit is `nodeId`: it imports and applies `toPosix(path)`
before constructing the graph identity. No F2 predicate or absolute-path
meaning logic moved. `git diff --check 252402c^ 252402c` passed.

## Public behavior

`git show 252402c:src/links/index.ts | grep -n 'mapAddress\|DdMap'` confirms
that `mapAddress` is re-exported by the public `./links` barrel. The new
assertions invoke that public function and observe both public issue locations
and the emitted node/key/parent graph.

## Independent Dim-0 mutation

In an isolated `git archive 252402c` under
`/private/tmp/dd-p4b-252402c-review` (with the source worktree untouched), I
first ran:

```
npx vitest run test/services/dd/links/map.test.ts \
  -t 'nodeId — F1 identity spelling' --reporter=verbose
```

Baseline: all three new tests passed.

I then independently restored the predecessor implementation:

```ts
function nodeId(path: string, interior: readonly string[]): string {
  return interior.length > 0 ? `${path}#${interior.join('/')}` : path;
}
```

The same command exited 1: exactly tests 1 and 2 failed, while test 3 passed.
The failures show the raw `C:\repo\...` `issues[].location` leak and a
three-node graph where the canonical result has two nodes. The passing control
continues to show the displayed seed address normalized to
`docs/plan.dd.json`.

## Validation

```
npx vitest run test/services/dd/links/map.test.ts --reporter=dot
# 49 passed
npx biome check src/links/map.ts test/services/dd/links/map.test.ts
# no fixes applied
npx tsc -p tsconfig.test.json --noEmit
# passed
```
