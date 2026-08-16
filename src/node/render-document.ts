import { NodeEnv } from '../adapters/env/node-env.js';
import { NodeHash } from '../adapters/hash/node-hash.js';
import { JitiLoader } from '../adapters/loader/jiti-loader.js';
import { parse } from '../core/parse.js';
import { collectFileRefs, type DdIssue, validateFileRefs } from '../core/validate.js';
import { ErrorCodes } from '../output/error-codes.js';
import { collectCustomTypes, loadAdapters } from '../render/adapters.js';
import type { DdAdapterIssue } from '../render/contract.js';
import {
  type DdRefreshedBasis,
  type DdRefreshIssue,
  refreshLiveReferences,
} from '../render/refresh.js';
import { renderDd } from '../render/renderer.js';
import { ConventionSchemaResolver } from '../schema/resolve.js';
import { isWithin, toPosix } from '../shared/posix-path.js';
import { DD_ISSUE_CODES } from './issue-codes.js';
import { NodeSchemaFs } from './schema-fs.js';

/**
 * Adapter issue class → frozen E-code (T006 ruling a). Like `DD_ISSUE_CODES`, it
 * lives in the host-bound tier rather than beside the renderer: `src/render/`
 * stays free of `output/`, which the renderer-purity rules and the SDK-tree gate
 * both enforce.
 */
const ADAPTER_CODES: Record<DdAdapterIssue['class'], string> = {
  'adapter-not-found': ErrorCodes.DD_ADAPTER_NOT_FOUND,
  'adapter-load-failed': ErrorCodes.DD_ADAPTER_LOAD_FAILED,
  'adapter-runtime-failed': ErrorCodes.DD_ADAPTER_RUNTIME_FAILED,
  'adapter-output-invalid': ErrorCodes.DD_ADAPTER_OUTPUT_INVALID,
};

/** The sibling markdown for a dd document — always beside it, never elsewhere. */
export function siblingPath(documentPath: string): string {
  return `${documentPath.replace(/\.json$/, '')}.md`;
}

export interface BuildFailure {
  ok: false;
  code: string;
  message: string;
  next_action: string;
  details?: unknown;
}

export interface BuildSuccess {
  ok: true;
  path: string;
  sibling: string;
  schema: string;
  markdown: string;
  warnings: Array<DdAdapterIssue & { code: string }>;
  /** Live bases whose target has moved since the ledger recorded it. */
  refreshed: DdRefreshedBasis[];
  refreshIssues: Array<DdRefreshIssue & { code: string }>;
  /**
   * Ordinary-file references that did not check out — always WARN, by ruling.
   * This is the first dd check whose answer depends on files dd does not own, so
   * a sparse clone must not fail a gate over something that is not wrong.
   */
  fileIssues: Array<DdIssue & { code: string }>;
}

export type BuildResult = BuildSuccess | BuildFailure;

/**
 * Everything up to (but not including) the write: read, parse, resolve the schema,
 * load adapters, render. Shared by `ddocs build`, by `autoRegenerateSibling` and by
 * `writeDocumentWithSibling`, so no caller's render can drift from what `ddocs build`
 * itself would have produced.
 *
 * It lives in the host-bound tier because that is what it IS: the body constructs
 * four Node adapters (`NodeSchemaFs`, `NodeEnv`, `NodeHash`, `JitiLoader`) and
 * returns `output/` E-codes. It sat in `src/acts/build.ts` by historical accident
 * — nothing about its signature is CLI-shaped — but `src/render/` could not hold
 * it either without breaking the SDK-tree purity gate, which is why the ratified
 * landing is `./node` (amendment A-1) rather than `./render/renderer`.
 *
 * `options.text` renders a document that is NOT (yet) the bytes on disk. That is
 * what lets a mutating verb stage its sibling before it commits anything: the
 * render is proven against the new content while the old content is still safe.
 */
export async function renderDocument(
  documentPath: string,
  repoRoot: string,
  options: { text?: string } = {},
): Promise<BuildResult> {
  const fs = new NodeSchemaFs();
  const home = new NodeEnv().home();

  if (!isWithin(repoRoot, documentPath)) {
    return {
      ok: false,
      code: ErrorCodes.DD_BUILD_INPUT_INVALID,
      message: `document is outside the repository root: ${documentPath}`,
      next_action: 'Point `ddocs build` at a document inside this repository.',
    };
  }

  const text = options.text ?? fs.readText(documentPath);
  if (text === null) {
    return {
      ok: false,
      code: ErrorCodes.DD_BUILD_INPUT_INVALID,
      message: `document is missing or unreadable: ${documentPath}`,
      next_action: 'Check the path, then re-run `ddocs build <path>`.',
    };
  }

  const doc = parse(text);
  if (Array.isArray(doc)) {
    return {
      ok: false,
      code: ErrorCodes.DD_BUILD_INPUT_INVALID,
      message: `${documentPath} is not a valid dd document`,
      details: { path: documentPath, failures: doc },
      next_action: 'Fix the reported location, then re-run `ddocs build <path>`.',
    };
  }

  const resolver = new ConventionSchemaResolver({
    fs,
    repoRoot,
    ...(home !== undefined && { home: toPosix(home) }),
  });
  const resolution = resolver.resolveDetailed(doc.dd.schema, documentPath);
  const record = resolution.record;
  if (!record) {
    const blocking = resolution.issues.find((issue) => issue.severity === 'ERROR');
    return {
      ok: false,
      code: ErrorCodes.DD_SCHEMA_UNRESOLVABLE,
      message: blocking?.message ?? `schema not found: ${doc.dd.schema}`,
      details: { path: documentPath, schema: doc.dd.schema, issues: resolution.issues },
      next_action: 'Run `ddocs schema list` to see which schemas resolve from here.',
    };
  }

  const adapters = await loadAdapters({
    types: collectCustomTypes(doc, record.schema),
    schemaPath: record.path,
    fs,
    loader: new JitiLoader(),
  });

  // Live-ledger refresh (plan 3.4): recompute what this document's `live` entries
  // promise, so a cross-file row summary is current at render. It reads only —
  // `ddocs build` must not dirty the document it renders, or `--check` could never
  // be stable.
  const refresh = refreshLiveReferences({
    doc,
    path: documentPath,
    schema: record.schema,
    gateTerminal: record.gateTerminal,
    fs,
    hash: new NodeHash(),
  });

  let markdown: string;
  try {
    markdown = renderDd(doc, {
      path: documentPath,
      repoRoot,
      schema: record.schema,
      gateTerminal: record.gateTerminal,
      adapters,
      derived: refresh.derived,
    });
  } catch (error) {
    return {
      ok: false,
      code: ErrorCodes.DD_RENDER_FAILED,
      message: `render failed for ${documentPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      next_action:
        'Report this with the document — a render failure is a dd bug, not a data error.',
    };
  }

  // Existence, and nothing else (BRIEF ruling 2). `NodeSchemaFs.exists` already
  // satisfies the seam structurally, so this is the whole of the wiring: the port
  // has no `readText` on it, which is what makes read/parse/hash unreachable here
  // by accident rather than by discipline.
  //
  // It runs after the render on purpose. The two are independent — a missing
  // target does not change a single byte of markdown — and putting the probe
  // downstream keeps a filesystem answer out of the render's inputs, so
  // `ddocs build --check` stays byte-stable whether or not the target is there.
  const fileIssues = validateFileRefs(
    collectFileRefs(doc, record.schema),
    documentPath,
    repoRoot,
    fs,
  ).map((issue) => ({ ...issue, code: DD_ISSUE_CODES[issue.class] }));

  return {
    ok: true,
    path: documentPath,
    sibling: siblingPath(documentPath),
    schema: record.name,
    markdown,
    warnings: adapters.issues.map((issue) => ({ ...issue, code: ADAPTER_CODES[issue.class] })),
    refreshed: refresh.refreshed,
    refreshIssues: refresh.issues.map((issue) => ({
      ...issue,
      code: ErrorCodes.DD_LIVE_BASIS_REFRESH_FAILED,
    })),
    fileIssues,
  };
}
