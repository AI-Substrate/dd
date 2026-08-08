// @ts-nocheck — DELIBERATE, and the reason IS the measurement.
//
// This file is the P1 skeleton (task T2): the import list and construction shape the §5.1
// trial fixture must reproduce, written out so the gap between "what the four adapting
// harness files do" and "what dd's exports map allows" is a FILE rather than a claim.
//
// It does not compile without this pragma, because six of the symbols it imports are
// forbidden by the current exports map (measured: ERR_PACKAGE_PATH_NOT_EXPORTED — see
// docs/plans/002-sdk-build/assets/p1-import-census.md group B1). That failure is the point;
// it is the measurement, not a defect to be worked around.
//
// Why `@ts-nocheck` rather than a tsconfig exclude: the P1 packet scopes writes to
// docs/plans/002-sdk-build/{assets,tasks} and test/trial-fixture. `tsconfig.test.json`
// (which includes `test/`) is OUTSIDE that scope, so excluding this file there was not
// available. `@ts-nocheck` keeps `just checks` green from inside the fence and is reversible
// in one line when P3 makes the imports real.
//
// NOT RUNNABLE, NOT WIRED. No test lane picks it up (`*.test.ts` is vitest's pattern and this
// is not one). Wiring the real fixture into `just checks` is P5's job.
//
// R-1 BOUNDARY: every line below is DERIVED from an existing consumer — a symbol some harness
// file already imports, a construction expression already written. Nothing here proposes a
// subpath, a name, or a shape. The `UNREACHABLE:` markers report what the map forbids today;
// they are not requests. Choosing what is offered is P2 (Q-4/Q-5/S-2).

// ─────────────────────────────────────────────────────────────────────────────
// 1 · IMPORTS — the trial's floor, by public subpath only
// ─────────────────────────────────────────────────────────────────────────────

// -- Reachable today (probed REACHABLE through package.json#exports) -----------

import { isAddressFailure, parseAddress } from '@ai-substrate/dd/core/address';
import type { DdDoc } from '@ai-substrate/dd/core/model';
import { parse } from '@ai-substrate/dd/core/parse';
import { collectLinkCells, type DdIssue, resolveAddressFile } from '@ai-substrate/dd/core/validate';
import { validateWalk } from '@ai-substrate/dd/core/walk';
import {
  type DocLoader,
  MemoizingDocLoader,
  resolveMapSeed,
  type SchemaResolver,
  traverseCorpus,
} from '@ai-substrate/dd/links';
import { escapeCell, headingSlug } from '@ai-substrate/dd/render/renderer';
import { ConventionSchemaResolver } from '@ai-substrate/dd/schema';
import type { SchemaIssue } from '@ai-substrate/dd/schema/model';

// -- Consumed by the four files, NOT reachable today ---------------------------
//
// Each specifier below is written the way a consumer WOULD have to write it if the symbol
// were public at its current module path. That is a placeholder for measurement, NOT a
// proposal: the real subpath (or whether one exists at all) is P2's call.

// UNREACHABLE: renderDocument — src/acts/build.ts, no `./acts/*` subpath.
//   Consumed at plan/index.ts:48.
import { renderDocument } from '@ai-substrate/dd/acts/build';

// UNREACHABLE: NodeSchemaFs — src/acts/schema-fs.ts:32, no `./acts/*` subpath.
//   Consumed at plan/index.ts:49. Note flow.ts deliberately does NOT use it (flow.ts:107-111)
//   and injects its own FsPort instead — two different fs strategies, both measured.
import { NodeSchemaFs } from '@ai-substrate/dd/acts/schema-fs';
// UNREACHABLE: FsDocLoader — src/acts/shared.ts:108, no `./acts/*` subpath exists
//   (ERR_PACKAGE_PATH_NOT_EXPORTED). Consumed at flow.ts:80 and plan/index.ts:50.
//   This is the fr-0010 symbol: a clean-sheet re-implementation never constructs it, so
//   only an adaptation-shaped fixture surfaces it. S-2 landing is P2's.
// UNREACHABLE: trackedPaths — src/acts/shared.ts:139, same absent subpath.
// UNREACHABLE: DD_ISSUE_CODES — src/acts/shared.ts:59, same absent subpath.
// UNREACHABLE: DdActDeps (type) — src/acts/shared.ts, same absent subpath.
import {
  DD_ISSUE_CODES,
  type DdActDeps,
  FsDocLoader,
  trackedPaths,
} from '@ai-substrate/dd/acts/shared';

// -- src/plan/ — R-2 has ALREADY ruled these out of the public surface ----------
//
// Recorded, deliberately NOT imported. R-2: `plan/` does not ship; harness re-implements plan
// semantics on dd's primitives. The four files import these TODAY, which is why the trial
// fixture cannot simply mirror plan/index.ts wholesale — the re-implementation R-2 mandates
// is harness-side work (koala's), sequenced after this surface exists.
//
// UNREACHABLE (and ruled so): buildPlanIndex, itemKey, readPlanCheck, readPlanReadiness,
//   PlanDocument, ReadyReading  — plan/index.ts:30-37
// UNREACHABLE (and ruled so): PlanEdge, PlanIndex, PlanItem — pr-body.ts:1

// ─────────────────────────────────────────────────────────────────────────────
// 2 · FIXTURE-OWNED FOREIGN PORTS — interface only, no implementation
// ─────────────────────────────────────────────────────────────────────────────
//
// The fixture must supply these itself. Measured basis: flow.ts:106-111 says the injected
// FsPort "satisfies dd's SchemaFs structurally" and reuses it rather than growing a second
// document-reading answer. So a foreign port is not a fixture-only trick — it is what the
// production consumer already does, and reproducing it is part of the trial.

/**
 * The foreign fs port — deliberately NOT dd's own adapter.
 *
 * Shape derived from two places at once, which is the measurement worth keeping:
 *   - dd's SchemaFs (src/schema/model.ts:9)  needs readdir + exists + readText
 *   - dd's FsDocLoader (src/acts/shared.ts:109) needs only Pick<FsPort,'readText'>
 * One object satisfies both, structurally, with no dd import. That is why the same
 * `deps.fs` can be passed to ConventionSchemaResolver AND FsDocLoader at flow.ts:121-126.
 */
interface FixtureFsPort {
  readdir(path: string): string[];
  exists(path: string): boolean;
  readText(path: string): string | null;
}

/** Derived from dd's HashPort (src/adapters/hash/hash-port.ts) — unexported, so fixture-owned. */
interface FixtureHashPort {
  sha256Hex(input: string | Uint8Array): string;
}

/**
 * Derived from dd's ExecPort — unexported, so fixture-owned.
 * Needed ONLY to feed `trackedPaths`; the flow.ts path passes `tracked: null` and avoids it
 * entirely (flow.ts:114-117: a gate refuses on completion, not on tracking).
 */
interface FixtureExecPort {
  run(
    cmd: string,
    args: readonly string[],
    opts: { cwd: string; timeoutMs: number },
  ): Promise<{ ok: boolean; stdout: string }>;
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
 *   1. the nesting is MemoizingDocLoader(FsDocLoader(...)) — decorator over concrete. A
 *      fixture that builds only the memoizer proves nothing, because the INNER one is the
 *      unreachable symbol.
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
 * S2 — plan/index.ts:141-147, the same resolver built from a DIFFERENT fs implementation.
 * The conditional `home` spread is an exactOptionalPropertyTypes idiom present in both
 * consumers; the fixture copies it rather than simplifying it.
 */
function planResolverShape(): ConventionSchemaResolver {
  return new ConventionSchemaResolver({
    fs: fixtureFs,
    repoRoot,
    ...(home !== undefined && { home }),
  });
}

/** S2b — the dd-built alternative the plan act uses instead of a foreign port (plan/index.ts:77). */
function nodeSchemaFsShape(): NodeSchemaFs {
  return new NodeSchemaFs();
}

/** S3a — plan/index.ts:327, the untracked loader. */
function loaderUntrackedShape(): FsDocLoader {
  return new FsDocLoader(fixtureFs, fixtureHash, null);
}

/**
 * S3b — plan/index.ts:372/796, depth-conditional. ASYNC by construction: trackedPaths returns
 * Promise<ReadonlySet<string> | null> (src/acts/shared.ts:139-142), so any call site
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
 * S4 — the two-field seam BOTH consumers assemble (flow.ts:120-126, plan/index.ts:526/805).
 * Measured: `SchemaResolver` and `DocLoader` are re-exported BY NAME from
 * @ai-substrate/dd/links precisely so an external consumer can name them without reaching
 * into a module path — so the seam's TYPES are public today while one of its two
 * IMPLEMENTATIONS is not.
 */
function seamShape(loader: DocLoader): { schemaResolver: SchemaResolver; docLoader: DocLoader } {
  return { schemaResolver: planResolverShape(), docLoader: loader };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · THE DRIVE — a real plan document through validate (§5.1 bar, shape only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reproduces the reading path plan/index.ts takes: read text → parse → resolve schema →
 * validateWalk. Bodies are omitted; this file measures the SURFACE the drive needs, and P5
 * builds the fixture that actually runs it against the installed tarball.
 */
async function driveShape(): Promise<void> {
  const text = fixtureFs.readText(planDocumentPath);
  if (text === null) return;

  const doc: DdDoc | DdIssue[] = parse(text);

  const resolver = planResolverShape();
  const loader: DocLoader = new MemoizingDocLoader(loaderUntrackedShape());
  const deps = seamShape(loader);

  const address = parseAddress(planDocumentPath);
  if (isAddressFailure(address)) return;
  resolveAddressFile(planDocumentPath, repoRoot);

  validateWalk(planDocumentPath, deps, { repoRoot });
  collectLinkCells(doc as DdDoc);

  resolveMapSeed(planDocumentPath, repoRoot);
  traverseCorpus(planDocumentPath, deps, { repoRoot });

  void resolver;
  void ddGateDepsShape();
  void nodeSchemaFsShape();
  void (await loaderDepthConditionalShape(0));
  void (await loaderTrackedShape());
}

/** S5 — pr-body.ts:2, the renderer helpers, and plan/index.ts:48's document render. */
function renderShape(cell: string, heading: string, doc: DdDoc): void {
  void escapeCell(cell);
  void headingSlug(heading);
  void renderDocument(doc);
}

/** S6 — plan/index.ts:50, the issue-code map and the act deps type. */
function issueCodeShape(issue: SchemaIssue, deps: DdActDeps): void {
  void DD_ISSUE_CODES;
  void issue;
  void deps;
}

export { driveShape, issueCodeShape, renderShape };
