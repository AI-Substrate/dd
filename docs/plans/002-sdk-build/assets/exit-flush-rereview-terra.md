APPROVE

Scope: 869b1c4 only. Reviewed from an isolated `git archive` checkout of
`869b1c4` on Node v24.7.0; the active s002 worktree was never modified.

1. Restored the defect by deleting `makeOutputBlocking()` from
   `exitWithEnvelope`, rebuilt, then ran:

   ```sh
   npm run build --silent
   npx vitest run test/acts/envelope-flush.test.ts
   ```

   Both rows red. The direct-driver and shipped-bin `dd --json graph` rows each
   reported `exit 0, no error, partial JSON — the TRUNCATION signature`, with
   `stdoutBytes=65536` and empty stderr. This closes both the Node-24 vacuity
   and missing-diagnostic findings. Full first-red output:
   `files/869b1c4-blocking-removed.log`.

2. The test was green before mutation: 2/2 rows passed in the isolated checkout.
   The generated corpus's payload is self-asserted independently of the node
   count. Mutating `CORPUS_DOCS` from 900 to 1 with the blocking fix restored
   gave exactly one red (the shipped-bin row) and one green (the direct row):
   `stdoutBytes=956: expected 956 to be greater than 400000`. This proves the
   under-ceiling corpus cannot silently pass. Full output:
   `files/869b1c4-corpus-shrunk.log`.

3. Independent TypeScript-AST walk, not the recorded classifier, found:
   `live-continuation=38`, `bare-return=1`, `helper-body=2`,
   `end-of-function=18`, total 59. The 38 split into 37 at `src/acts/**` and
   `src/app.ts:162`; it reconciles the prior 37 as the acts-scoped count. The
   new census note records the same classification, population, and scope.

4. `git diff --unified=0 1f2667f 869b1c4 -- src/output/exit.ts` contains only
   the corrected docblock; no runtime source moved. The commit changes only
   the census note, `src/output/exit.ts`, and the flush test. `git diff --check`
   is clean.
