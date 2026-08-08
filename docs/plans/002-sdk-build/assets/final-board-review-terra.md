APPROVE

Review scope:
- `506b13e` — `test/architecture/dd-core-isolation.test.ts`
- `179afd9`, `d505fb0` — `scripts/pack-gate.sh`

Independent proof:

1. In a disposable local clone at `d505fb0`, I planted `src/core/review-self-reference.ts` with:

   ```ts
   import '@ai-substrate/dd/node';
   ```

   `npx vitest run test/architecture/dd-core-isolation.test.ts` exited 1. The core-purity gate reported the complete bare-specifier trace, including:

   ```text
   adapters: core/review-self-reference.ts -> node/index.ts (via @ai-substrate/dd/node) -> node/deps.ts -> adapters/clock/clock-port.ts
   ```

   It also reported:

   ```text
   self-reference: core/review-self-reference.ts -> node/index.ts (via @ai-substrate/dd/node)
   ```

   The saved first-red output is `506b13e-node-self-reference-red.log`.

2. Replacing that mutation with `import '@ai-substrate/dd/core/parse';` again exited 1, solely through the external-import row:

   ```text
   self-reference: core/review-self-reference.ts -> core/parse.ts (via @ai-substrate/dd/core/parse)
   ```

   This proves a self-reference is reported even when both endpoints are in the SDK tree. Saved as `506b13e-sdk-self-reference-red.log`.

3. After deleting the mutation, the targeted suite passed 6/6. Resolver inspection confirms only this package's `exports`/`imports` maps are resolved; unrecognized bare names yield `null` and are reported by name, with no node_modules traversal. The injected-manifest rows exercise both package self-reference and the tail-bearing `#internal/*.js` pattern.

4. `179afd9` changes only explanatory comments. `d505fb0` changes exactly four literal human messages; no assertion/control-flow condition changed. The final fail message is a literal, and `git show d505fb0:scripts/pack-gate.sh | bash -n` passed.

5. `./scripts/pack-gate.sh` in the isolated checkout passed. Its actual stdout contains:

   ```text
   === 3/8  prepare built dist/ on install; a lifecycle hook must rebuild it after we clear it
       prepare: npm ci built dist/ (the git-URL path)
       packed ai-substrate-dd-0.1.0.tgz (a lifecycle hook built dist/)
   ```

   The measured lifecycle table in `mid-suite-rebuild-race.md` supports the `prepack OR prepare` qualification: plain `npm pack` runs `prepare` under npm 10.9.2 and npm 11.x. The complete run is `d505fb0-pack-gate.log`.

Conclusion: accept the PM's retroactive scope blessing. All four over-wide strings needed the same correction; leaving the step-2 phrase intact would falsely separate one lifecycle-hook claim from the other three.
