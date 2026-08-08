/**
 * `@ai-substrate/dd` — the root barrel.
 *
 * EVERY ADDITION TO THIS FILE IS AN API REVIEW. The list below is a curated
 * allowlist, not a re-export of whatever happens to be public: it is the primary
 * abstraction dd offers — parse → validate → address → links over deterministic
 * documents — and nothing else. A symbol that is merely useful goes to its domain
 * subpath (`./core/*`, `./links`, `./schema`, `./render/*`, `./node`), where it
 * is still reachable and still documented. Widening the root is the one change
 * that cannot be undone quietly, because the root is what a new consumer types
 * first and what every example ends up written against.
 *
 * IMPORTING THIS MODULE HAS NO SIDE EFFECTS. No CLI, no argument parsing, no
 * stdout, no process handlers, no work at module scope. That is not a style
 * preference — it is the defect this file exists to fix. Until now
 * `exports["."]` pointed at `dist/index.js`, the bin: importing the package
 * EXECUTED dd and yielded zero named exports (measured, P1 census group B3, and
 * re-confirmed at HEAD rather than inherited). The bin still exists, unchanged,
 * still shebang-plus-`main()` — it is simply no longer what `import
 * '@ai-substrate/dd'` means. Dependency direction is one-way: bin → program →
 * library, never library → bin.
 *
 * Nothing render-, adapter- or CLI-shaped appears here by design (D-1).
 *
 * @packageDocumentation
 */

// Addressing — naming a document, or a place inside one.
export { isAddressFailure, parseAddress } from './core/address.js';
// The document itself.
export type { DdDoc } from './core/model.js';
export { parse } from './core/parse.js';
// Validation essentials, and the seam type a caller must implement to resolve
// schemas. `DdIssue` is here because an error shape IS API: consumers switch on
// finding classes rather than scraping messages.
export {
  collectLinkCells,
  type DdIssue,
  resolveAddressFile,
  type SchemaResolver,
} from './core/validate.js';
export { type DocLoader, validateWalk } from './core/walk.js';
// The loader pair, as one expression: the decorator and the thing it decorates.
// Exporting only the memoizer is what made it unusable before — a consumer could
// name the wrapper and not build the wrapped (P1 census B1, fr-0010).
export { FsDocLoader, MemoizingDocLoader } from './links/index.js';
export { ConventionSchemaResolver } from './schema/resolve.js';
