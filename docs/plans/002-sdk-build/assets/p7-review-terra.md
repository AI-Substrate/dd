APPROVE — P7 is fit to rebase, push, and run CI.

Scope: pinned commits 2480a04, 80c5c5f, 76f7efe, 0b42a47, bd5a8e2. Target worktree was read-only; mutations ran only in disposable clone `/private/tmp/dd-p7-review-puma` at bd5a8e2.

Membership, independently mutated:

* Added `ReviewSurplusThroughStar` to `src/links/model.ts`, behind `links/index.ts`'s followed `export *`; after build, `node scripts/exports-reachability-probe.mjs` exited 1 and named `…/links surplus 1: ReviewSurplusThroughStar`. First red: `p7-links-star-surplus-red.log`.
* Added `ReviewDirectSurplus` directly to `src/core/parse.ts`; the probe exited 1 and named `…/core/parse surplus 1: ReviewDirectSurplus`. First red: `p7-core-direct-surplus-red.log`.
* Removed the type-only `DdAddressSegment` export from `src/core/address.ts`; the normal build still exited 0, while the probe exited 1 and named `…/core/address missing 1: DdAddressSegment`. This proves types are measured rather than masked by runtime imports. First red: `p7-core-missing-red.log`.
* Removed `./core/parse` from its literal `DECLARED_SURFACE` entry; the probe exited 1 with `1 published subpath(s) NOT pinned: ./core/parse`. First red: `p7-membership-coverage-red.log`.
* Restored every mutation. Final probe passed all 13 exports-map subpaths against 12 emitted declaration targets. The lists are literal arrays; only the gate reads the package exports map for completeness.

Walker, independently mutated:

* The permanent synthetic row contains comment, block-comment, template, baked-doc, and dynamic-import-shaped strings plus live `#internal/...` and `commander` imports; it expects only the two live imports. 
* Added a real `import { parse } from '@ai-substrate/dd/core/parse'` to `src/docs/docs-content.ts`, a file already containing baked specifier-shaped text. The architecture test exited 1 and named `self-reference: docs/docs-content.ts -> core/parse.ts (via @ai-substrate/dd/core/parse)`. First red: `p7-walker-real-self-reference-red.log`.
* Replaced it temporarily with a non-executed real `require('@ai-substrate/dd/core/parse')`; all seven architecture rows stayed green, confirming the documented current limit that `require()` is not collected. First green: `p7-walker-require-uncollected-green.log`.
* Restored every mutation. The final architecture test passed 7/7.

Docs and fence:

* `just check-docs` passed. The mirror is header plus source verbatim (independent `tail -n +5` diff was empty).
* Manifest, generated literal corpus, `test/acts/dd.test.ts`, and `test/docs-surface.test.ts` each contain the third ID `how-to-use-and-extend-the-sdk`; `node bin/dd.js docs get how-to-use-and-extend-the-sdk --json` returned its title/content.
* Final targeted run passed architecture, docs-surface, and dd-act suites: 47 tests.
* `package.json#exports` is byte-unchanged in each P7 commit; `.github/workflows/ci.yml` is untouched. The only `src/` changes across the five commits are the intended docs source and generated baked corpus; the two gate commits change only `scripts/` and `test/`.

Flag only, outside this packet: 05f7841 adds `docs/how/dd/deterministic-documents.md` without a source/manifest entry. It does not break P7's docs parity or link tests, but its provenance remains unresolved as dispatched.
