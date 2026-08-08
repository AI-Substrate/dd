/**
 * The Node-bound tier — everything dd offers a consumer that is tied to a real
 * host: a filesystem, a git process, an injected clock, the CLI's E-code
 * vocabulary.
 *
 * WHY A SEPARATE SUBPATH. The rest of the library is portable by construction —
 * `test/architecture/dd-core-isolation.test.ts` walks every import edge out of
 * `src/{core,docs,links,mutate,plan,render,schema,shared}` and fails on a `node:`
 * builtin, an adapter, or an `output/` reach. That guarantee is worth something
 * only if it is legible from outside, so the things that DO bind to a host are
 * named as such rather than smuggled through a portable subpath. A consumer
 * importing `@ai-substrate/dd` or `@ai-substrate/dd/core/*` knows it has taken no
 * host dependency; a consumer importing `@ai-substrate/dd/node` knows it has.
 *
 * All five symbols were in `src/acts/` — the CLI half — where no `exports`
 * subpath could reach them, which is exactly what the P1 census measured
 * (`ERR_PACKAGE_PATH_NOT_EXPORTED`, group B1). They are consumed today by real
 * files; the move is what makes them importable, and it changes no behaviour.
 *
 * TWO OF THEM LANDED HERE BY AMENDMENT, not by first choice. `DD_ISSUE_CODES` was
 * ratified for `./core/validate` and `renderDocument` for `./render/renderer`;
 * both were measured impossible, because both produce `output/` E-codes and
 * `renderDocument` additionally constructs four Node adapters. The purity gate is
 * absolute, so the landing moved rather than the gate (amendment A-1, ratified).
 * The honest reading is that the gate found the right home for them: a symbol
 * that needs a host belongs in the tier named for having one.
 *
 * This directory is deliberately NOT part of `SDK_DIRS` in the architecture test.
 * It is an adapter tier, like `src/adapters/`, and adding it there would fail the
 * purity gate for precisely the right reason.
 *
 * EXACTLY FIVE SYMBOLS. `ActDeps` lives beside `DdActDeps` in `./deps.js` and is
 * deliberately NOT re-exported here: A-1 ratifies five, and a barrel that ships a
 * sixth has widened the published surface without a review. The CLI half reaches
 * it directly (`src/acts/shared.ts` -> `../node/deps.js`), which is the honest
 * shape — an internal name should travel by an internal path.
 */

export type { DdActDeps } from './deps.js';
export { DD_ISSUE_CODES } from './issue-codes.js';
export { renderDocument } from './render-document.js';
export { NodeSchemaFs } from './schema-fs.js';
export { trackedPaths } from './tracked-paths.js';
