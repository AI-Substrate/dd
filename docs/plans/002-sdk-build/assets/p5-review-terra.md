# P5 acceptance-gate review — `b1e9cf5`

Verdict: `APPROVE_WITH_NOTES`.

Review object: the P5 commit chain `61183f3`, `894427a`, `f958f0d`, `b1e9cf5` in an isolated
checkout of `/Users/jordanknight/substrate/dd-worktrees/s002-sdk-build`. No reviewed-worktree
files were written.

## Independent acceptance proof

Created an isolated Git checkout at `b1e9cf5` and ran:

```sh
just pack-gate
```

It cloned the pinned HEAD clean, ran lifecycle `prepare` and independent `prepack`, installed the
resulting `.tgz` into a scratch consumer with real `npm install <tgz>`, and then invoked the P5
runner from pack-gate step 8. The runner compiled the fixture under NodeNext from the installed
consumer's `node_modules`, passed all C1--C14 clauses, ran `publint --strict`, and passed
`attw --pack --profile esm-only`.

An independent TypeScript-AST import census found all 21 applicable P1 symbols imported from
public package specifiers, with no missing symbols and no non-public specifiers. The three
additional imports (`DocLoader`, `ResolvedDdSchema`, `SchemaResolver`) are fixture construction
types rather than missing census rows.

## Dim-0 mutations

All mutations were made only in a disposable archive, then restored byte-for-byte.

1. Replaced the C4 loader's `tracked` argument with `new Set()`. The installed-package gate
   exited 1 and named C4, reporting that the `tracked: null` document was observed `false`.
2. Replaced C9's `buildLoader(tracked)` with `buildLoader(null)`. The gate exited 1 and named
   only C9, specifically its "ABSENT from the tracked set ... the set is consulted" assertion.
3. Redirected the root export's `types` target to a nonexistent declaration and packed again.
   `attw --pack --profile esm-only` exited 1, reporting root `node16 (from ESM)` and `bundler`
   fallback-condition errors. This independently proves the selected profile remains non-vacuous.

The unmodified tarball under default strict attw produced exactly the two intended failing
resolution families across code exports: `node10` resolution failures and Node-16 CJS-to-ESM
findings. The package declares `engines.node >=22`, `type: module`, and no require surface; ESM
and bundler profiles passed for every code export.

## Fixture clauses and fence

- C9 explicitly asserts the `git` invocation includes `-z` and exercises both in-set and
  absent-from-set loader arms.
- C4 exercises the null tracked-set semantics. The C4 mutation establishes this is behavioral,
  not a comment-only claim.
- Across all four P5 commits, the serialized exports object has one SHA-256:
  `a7cebad3ffd83d25c004165a277b428b77733902890a198c9a33e50b311c5150`.
- No P5 commit modifies `.github/workflows/ci.yml`.
- P5's implementation paths are fixture/corpus, runner, package-analysis dependencies,
  pack-gate wiring, and justfile wiring; no `src/` path is touched.

## Note

The packet's literal baseline phrase "byte-identical to `f9b7b03`" is historically inaccurate:
`8fb6aec` (P3, before P5) ratified the reviewed root-barrel and `./node` export changes. P5
does not modify that post-P3 map; all four P5 commits preserve it identically. This is a packet
provenance note, not a P5 surface-freeze defect.
