import { parse } from '../core/parse.js';
import type { DocLoader, DocLoadResult } from '../core/walk.js';

/**
 * The narrow read surface a document loader needs — one method, nothing else.
 *
 * Declared here rather than imported so this layer never names an adapter, which
 * is what keeps the SDK tree free of `src/adapters/`
 * (`test/architecture/dd-core-isolation.test.ts`, ac-0001). The same move is
 * already made twice in this codebase for the same reason: `render/refresh.ts`
 * declares `DdRefreshFs`, and `schema/model.ts`'s `SchemaFs` says outright that
 * "`FsPort` satisfies it structurally, so production injects the real adapter…
 * without this layer ever naming an adapter".
 *
 * Structural typing means no call site changes: a `NodeSchemaFs`, a harness
 * `FsPort`, and a fixture's own stub all satisfy it without knowing it exists.
 * Deliberately NOT re-exported from `links/index.ts` — the ratified surface delta
 * admits `FsDocLoader` and no new type names.
 */
interface DocTextSource {
  /** File contents as UTF-8, or null when missing/unreadable. */
  readText(path: string): string | null;
}

/** Content hashing, declared here for the same reason as {@link DocTextSource}. */
interface DocHash {
  sha256Hex(input: string): string;
}

/**
 * Remember what a loader already answered.
 *
 * The doctor reads the same document from several angles — the traversal, the
 * radius-∞ walk, and the interior-resolution pass — and each of those is a
 * separate, legitimate question. Re-reading and re-parsing the file for every one
 * of them is the only cost worth removing, so it is removed once, here, instead
 * of by teaching each caller to hold state.
 *
 * Caching is per instance and lives exactly as long as one command, which is the
 * only window in which "the file has not changed underneath us" is safe to assume.
 */
export class MemoizingDocLoader implements DocLoader {
  private readonly cache = new Map<string, DocLoadResult>();

  constructor(private readonly inner: DocLoader) {}

  load(path: string): DocLoadResult {
    const hit = this.cache.get(path);
    if (hit) return hit;
    const result = this.inner.load(path);
    this.cache.set(path, result);
    return result;
  }
}

/**
 * Document loader for the outbound walk, over the real filesystem.
 *
 * `tracked` comes from ONE `git ls-files` snapshot taken before the walk — the
 * cheap, correct answer, rather than calling every readable file tracked and
 * silently suppressing the untracked-target WARN. A non-repo (or a failing git)
 * yields null, meaning "this host has no tracking concept", not "everything
 * happens to be tracked".
 *
 * It lives HERE, beside the decorator that wraps it, rather than in `acts/`.
 * `MemoizingDocLoader(new FsDocLoader(...))` is one expression at every call site
 * in this repo and in every measured consumer (P1 census C1/C3), and having the
 * two halves of it answer to different layers is what kept the concrete one out
 * of reach: the decorator was public and the thing it decorates was not, so a
 * consumer could name the wrapper and not build the wrapped (census B1 — the
 * fr-0010 symbol). Same family, same module.
 */
export class FsDocLoader implements DocLoader {
  constructor(
    private readonly fs: DocTextSource,
    private readonly hash: DocHash,
    private readonly tracked: ReadonlySet<string> | null,
  ) {}

  load(path: string): DocLoadResult {
    const text = this.fs.readText(path);
    if (text === null) {
      return { ok: false, path, reason: 'missing', message: `address target is missing: ${path}` };
    }
    const doc = parse(text);
    if (Array.isArray(doc)) {
      return {
        ok: false,
        path,
        reason: 'missing',
        message: `address target is not a readable dd document: ${path}`,
      };
    }
    return {
      ok: true,
      path,
      doc,
      sha: this.hash.sha256Hex(text),
      tracked: this.tracked === null ? true : this.tracked.has(path),
    };
  }
}
