// The §5.1 trial fixture's import list and construction shape — the four adapting
// harness files, reproduced against dd's PUBLIC surface.
//
// WHAT CHANGED, AND WHY IT MATTERS. In P1 this file carried `@ts-nocheck`, and the
// pragma WAS the measurement: six of the symbols it imports had no public subpath
// (measured `ERR_PACKAGE_PATH_NOT_EXPORTED` — assets/p1-import-census.md group B1),
// so the file could not compile, and that failure was the point. P3 landed the
// ratified surface, so the pragma is gone and every import below is real. The gap
// between "what the consumers do" and "what dd allows" is now closed by
// construction: if it reopens, this file stops compiling.
//
// It is worth being precise about what removing the pragma cost, because it is the
// argument for having written the file at all. `@ts-nocheck` was not only hiding
// six forbidden imports — it was also hiding four WRONG CALL SIGNATURES that the
// P1 skeleton had guessed: `renderDocument(doc)` (it takes a path and a repo root),
// `collectLinkCells(doc)` (it takes a resolved schema too), `validateWalk(path,
// deps, options)` (the document comes first) and `resolveMapSeed(path, repoRoot)`
// (it takes the seam). None of those were reachable as errors while the pragma was
// on. A fixture that cannot compile cannot tell you it is wrong.
//
// NOT RUNNABLE, NOT WIRED — no test lane picks it up (`*.test.ts` is vitest's
// pattern and this is not one). It typechecks; making it RUN against the installed
// tarball is P5's job.
//
// Every line remains DERIVED from an existing consumer — a symbol some harness file
// already imports, a construction expression already written. Nothing here proposes
// a surface; the surface was decided in design-decision.md (D-1..D-6, ratified) and
// amended once (A-1), and this file consumes it.

// ─────────────────────────────────────────────────────────────────────────────
// 1 · IMPORTS — by public subpath only, exactly as a consumer must write them
// ─────────────────────────────────────────────────────────────────────────────

import { isAddressFailure, parseAddress } from '@ai-substrate/dd/core/address';
import type { DdDoc, ResolvedDdSchema } from '@ai-substrate/dd/core/model';
import { parse } from '@ai-substrate/dd/core/parse';
import { collectLinkCells, type DdIssue, resolveAddressFile } from '@ai-substrate/dd/core/validate';
import { validateWalk } from '@ai-substrate/dd/core/walk';
import {
  type DocLoader,
  FsDocLoader,
  MemoizingDocLoader,
  resolveMapSeed,
  type SchemaResolver,
  traverseCorpus,
} from '@ai-substrate/dd/links';
// The host-bound tier. Four of the six P1 floor symbols land here; the subpath is
// named for what it costs — a consumer importing it knows it has taken a Node
// dependency, which the portable subpaths never impose. `DD_ISSUE_CODES` and
// `renderDocument` arrived by ratified amendment A-1: dd's architecture gate
// forbids the portable tree from reaching `output/` or an adapter, and both of
// them do.
import {
  DD_ISSUE_CODES,
  type DdActDeps,
  NodeSchemaFs,
  renderDocument,
  trackedPaths,
} from '@ai-substrate/dd/node';
import { escapeCell, headingSlug } from '@ai-substrate/dd/render/renderer';
import { ConventionSchemaResolver } from '@ai-substrate/dd/schema';
import type { SchemaIssue } from '@ai-substrate/dd/schema/model';

// -- src/plan/ — R-2 has ALREADY ruled these out of the public surface ----------
//
// Recorded, deliberately NOT imported, and still correct after P3: R-2 says `plan/`
// does not ship; harness re-implements plan semantics on dd's primitives. The four
// files import these TODAY, which is why the trial fixture cannot simply mirror
// plan/index.ts wholesale — the re-implementation is harness-side work, sequenced
// after this surface exists. The exports probe asserts `./plan` STAYS forbidden, so
// this is an enforced ruling rather than an omission.
//
// RULED OUT: buildPlanIndex, itemKey, readPlanCheck, readPlanReadiness,
//   PlanDocument, ReadyReading  — plan/index.ts:30-37
// RULED OUT: PlanEdge, PlanIndex, PlanItem — pr-body.ts:1

// ─────────────────────────────────────────────────────────────────────────────
// 2 · FIXTURE-OWNED FOREIGN PORTS — interface only, no implementation
// ─────────────────────────────────────────────────────────────────────────────
//
// The fixture supplies these itself. Measured basis: flow.ts:106-111 says the
// injected FsPort "satisfies dd's SchemaFs structurally" and reuses it rather than
// growing a second document-reading answer. A foreign port is not a fixture-only
// trick — it is what the production consumer already does.
//
// P3 made this MORE true, not less. `FsDocLoader` moved into `src/links/`, where
// dd's own architecture forbids naming an adapter, so its constructor now declares
// the read and hash surfaces structurally. The interfaces below name no dd type and
// never did; they now match the library's own declarations by construction.

/**
 * The foreign fs port — deliberately NOT dd's own adapter.
 *
 * Shape derived from two places at once:
 *   - dd's SchemaFs (public, `@ai-substrate/dd/schema/model`) needs readdir + exists + readText
 *   - dd's FsDocLoader needs only `readText`
 * One object satisfies both, structurally, with no dd import — which is why the same
 * `deps.fs` goes to ConventionSchemaResolver AND FsDocLoader at flow.ts:121-126.
 */
interface FixtureFsPort {
  readdir(path: string): string[];
  exists(path: string): boolean;
  readText(path: string): string | null;
}

/** Derived from dd's HashPort — an adapter type, so fixture-owned by design. */
interface FixtureHashPort {
  sha256Hex(input: string): string;
}

/**
 * Derived from dd's ExecPort — an adapter type, so fixture-owned.
 * Needed ONLY to feed `trackedPaths`; the flow.ts path passes `tracked: null` and
 * avoids it entirely (flow.ts:114-117: a gate refuses on completion, not tracking).
 */
interface FixtureExecPort {
  run(
    cmd: string,
    args: string[],
    opts: { cwd: string; timeoutMs?: number },
  ): Promise<{ code: number; stdout: string; stderr: string; ok: boolean }>;
}

declare const fixtureFs: FixtureFsPort;
declare const fixtureHash: FixtureHashPort;
declare const fixtureExec: FixtureExecPort;
declare const repoRoot: string;
declare const home: string | undefined;
declare const planDocumentPath: string;

// ─────────────────────────────────────────────────────────────────────────────
// 3 · CONSTRUCTION SHAPE — reproduced from the consumers, expression for expression
// ─────────────────────────────────────────────────────────────────────────────

/**
 * S1 — flow.ts:118-129, the gate's deps.
 *
 * Three properties this MUST preserve, all measured:
 *   1. the nesting is MemoizingDocLoader(FsDocLoader(...)) — decorator over
 *      concrete. A fixture that builds only the memoizer proves nothing, because
 *      the INNER one was the unreachable symbol. Both now come from ONE subpath.
 *   2. `fs` is the foreign port, passed to BOTH constructions.
 *   3. `tracked` is null on purpose, not for convenience.
 */
function ddGateDepsShape(): { schemaResolver: SchemaResolver; docLoader: DocLoader } {
  return {
    schemaResolver: new ConventionSchemaResolver({
      fs: fixtureFs,
      repoRoot,
      ...(home !== undefined && { home }),
    }),
    docLoader: new MemoizingDocLoader(new FsDocLoader(fixtureFs, fixtureHash, null)),
  };
}

/**
 * S2 — plan/index.ts:141-147, the same resolver built from a DIFFERENT fs
 * implementation. The conditional `home` spread is an exactOptionalPropertyTypes
 * idiom present in both consumers; the fixture copies it rather than simplifying.
 */
function planResolverShape(): ConventionSchemaResolver {
  return new ConventionSchemaResolver({
    fs: fixtureFs,
    repoRoot,
    ...(home !== undefined && { home }),
  });
}

/** S2b — the dd-built alternative the plan act uses instead of a foreign port. */
function nodeSchemaFsShape(): NodeSchemaFs {
  return new NodeSchemaFs();
}

/** S3a — plan/index.ts:327, the untracked loader. */
function loaderUntrackedShape(): FsDocLoader {
  return new FsDocLoader(fixtureFs, fixtureHash, null);
}

/**
 * S3b — plan/index.ts:372/796, depth-conditional. ASYNC by construction:
 * `trackedPaths` returns `Promise<ReadonlySet<string> | null>`, so any call site
 * reproducing this shape is an async one and needs an ExecPort-shaped stand-in.
 */
async function loaderDepthConditionalShape(depth: number): Promise<FsDocLoader> {
  return new FsDocLoader(
    fixtureFs,
    fixtureHash,
    depth === 0 ? null : await trackedPaths(fixtureExec, repoRoot),
  );
}

/** S3c — plan/index.ts:517, always-tracked. */
async function loaderTrackedShape(): Promise<FsDocLoader> {
  return new FsDocLoader(fixtureFs, fixtureHash, await trackedPaths(fixtureExec, repoRoot));
}

/**
 * S4 — the two-field seam BOTH consumers assemble (flow.ts:120-126,
 * plan/index.ts:526/805). It is also, measurably, the SAME seam `validateWalk`,
 * `resolveMapSeed` and `traverseCorpus` each ask for — three separately-declared
 * dep types, one shape. That is why one object drives all three below.
 */
function seamShape(loader: DocLoader): { schemaResolver: SchemaResolver; docLoader: DocLoader } {
  return { schemaResolver: planResolverShape(), docLoader: loader };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · THE DRIVE — a real plan document through validate (§5.1 bar, shape only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reproduces the reading path plan/index.ts takes: read text → parse → resolve
 * schema → validateWalk. Bodies are omitted where the fixture would supply real
 * data; what this file proves is that the SURFACE the drive needs is reachable and
 * that the calls typecheck. P5 builds the fixture that actually runs it against
 * the installed tarball.
 */
async function driveShape(): Promise<void> {
  const text = fixtureFs.readText(planDocumentPath);
  if (text === null) return;

  // `parse` answers with the document or with the failures — narrowing on the
  // array is the consumer's own idiom, and it keeps `DdFailure` un-named.
  const parsed = parse(text);
  if (Array.isArray(parsed)) return;
  const doc: DdDoc = parsed;

  const resolver = planResolverShape();
  const loader: DocLoader = new MemoizingDocLoader(loaderUntrackedShape());
  const deps = seamShape(loader);

  const address = parseAddress(planDocumentPath);
  if (isAddressFailure(address)) return;
  resolveAddressFile(planDocumentPath, repoRoot);

  const issues: DdIssue[] = validateWalk(doc, planDocumentPath, deps, { repoRoot });

  // `collectLinkCells` needs the RESOLVED schema, not just the document: link
  // cells are declared by the schema, so there is nothing to collect without it.
  const resolution = resolver.resolve(doc.dd.schema, planDocumentPath);
  if (resolution.ok) {
    const schema: ResolvedDdSchema = resolution.schema;
    collectLinkCells(doc, schema);
  }

  resolveMapSeed(planDocumentPath, deps, { repoRoot });
  traverseCorpus([planDocumentPath], deps, { repoRoot, mode: 'direct' });

  void issues;
  void ddGateDepsShape();
  void nodeSchemaFsShape();
  void (await loaderDepthConditionalShape(0));
  void (await loaderTrackedShape());
}

/**
 * S5 — pr-body.ts:2, the renderer helpers, and plan/index.ts:278/665's document
 * render. `renderDocument(path, repoRoot)` — a PATH and a repo root, not a parsed
 * document. The P1 skeleton guessed `renderDocument(doc)`; `@ts-nocheck` is why
 * that guess survived a whole phase.
 */
async function renderShape(cell: string, heading: string): Promise<void> {
  void escapeCell(cell);
  void headingSlug(heading);
  const result = await renderDocument(planDocumentPath, repoRoot);
  if (result.ok) void result.markdown;
}

/** S6 — plan/index.ts:50, the issue-code map and the act deps type. */
function issueCodeShape(issue: SchemaIssue, deps: DdActDeps): void {
  void DD_ISSUE_CODES['address-malformed'];
  void issue;
  void deps;
}

export { driveShape, issueCodeShape, renderShape };
