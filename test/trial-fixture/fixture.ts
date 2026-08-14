/**
 * The §5.1 trial fixture — dd's acceptance gate, run as a real consumer.
 *
 * WHAT THIS FILE IS. A consumer of `@ai-substrate/dd` that imports every symbol
 * the P1 trial census measured, by PUBLIC SUBPATH ONLY, supplies its own foreign
 * ports, drives a real dd plan corpus through validate/link/render, and asserts
 * the OUTPUTS. Green here is the R-4 milestone: ready to trial.
 *
 * WHAT IT USED TO BE, AND WHY THE HISTORY MATTERS. In P1 this file was
 * `skeleton.ts` and carried `@ts-nocheck`, and the pragma WAS the measurement:
 * six of the symbols it imports had no public subpath at all (measured
 * `ERR_PACKAGE_PATH_NOT_EXPORTED` — assets/p1-import-census.md group B1), so the
 * file could not compile, and that failure was the point. P3 landed the ratified
 * surface and the pragma came off, which immediately exposed four WRONG CALL
 * SIGNATURES the skeleton had guessed. P5 is the third step and the one that
 * closes the loop: a file that TYPECHECKS proves the names resolve; only a file
 * that RUNS proves the library does the work. This one runs.
 *
 * IT IS PROVEN TWICE, AGAINST DIFFERENT THINGS.
 *   - `just typecheck` compiles it in-repo, where TypeScript resolves
 *     `@ai-substrate/dd/*` by SELF-NAME through the `exports` map onto local
 *     `dist/`. That is the cheap inner-loop half: break the map and this stops
 *     compiling within seconds.
 *   - `scripts/trial-fixture-run.mjs` compiles and RUNS it inside a throwaway
 *     project where the package was installed from a real `npm pack` tarball, in
 *     Node's own `NodeNext` resolution. That is the half a typecheck cannot
 *     reach: the `files` allowlist, the built `dist/`, the runtime dependencies,
 *     and whether the code actually behaves.
 * Neither is redundant, because they fail for different reasons.
 *
 * THE SURFACE IS FROZEN. Nothing here proposes an export. The surface was decided
 * in design-decision.md (D-1..D-6, ratified) and amended once (A-1); this file
 * CONSUMES it. If a clause below cannot be written without a symbol that is not
 * public, that is a FINDING for the PM — an amendment — never a local fix.
 *
 * THE CORPUS is a verbatim copy of this repo's own plan 001 documents, committed
 * under `fixtures/` beside this file. Verbatim matters: a hand-built toy document
 * would prove the library against a shape invented to suit it. `fixtures/` also
 * matters — that path segment is what `shouldExcludeFromSweep` reads to keep a
 * committed corpus out of `ddocs doctor`'s repo-wide sweep, and this corpus drifts
 * ON PURPOSE (three of the plan's four phase-task links point at documents
 * deliberately left out, which is what clause C5 measures).
 *
 * ATTRIBUTION IS THE POINT (C-6). Every assertion runs inside a NAMED clause and
 * a red prints the clause, what was expected and what was seen. A gate that
 * fails without naming what failed teaches re-running, which is the habit this
 * repo's whole C-6 procedure exists to break.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// 1 · IMPORTS — by public subpath only, exactly as a consumer must write them
// ─────────────────────────────────────────────────────────────────────────────
//
// THIS LIST IS THE ACCEPTANCE MEASUREMENT (§5 progress bar). No deep paths, no
// relative reach into the package, no `./acts/*`, no `./plan`. Every name below
// is a symbol some real adapting harness file already imports.

// The curated root barrel (D-1). Imported for one reason: to prove that
// `import '@ai-substrate/dd'` now YIELDS SOMETHING. It used to point at the bin,
// so importing the package executed the CLI and gave back zero named exports —
// the canonical dual-package defect, and census group B3.
import { parse as parseFromRoot } from '@ai-substrate/dd';
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
// forbids the portable tree from reaching `output/` or an adapter, and both do.
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
// Recorded, deliberately NOT imported, and still correct: R-2 says `plan/` does
// not ship; harness re-implements plan semantics on dd's primitives. The four
// adapting files import these TODAY, which is why the trial fixture cannot
// mirror `plan/index.ts` wholesale — that re-implementation is harness-side work,
// sequenced after this surface exists. The exports probe asserts `./plan` STAYS
// forbidden, so this is an enforced ruling rather than an omission.
//
// RULED OUT: buildPlanIndex, itemKey, readPlanCheck, readPlanReadiness,
//   PlanDocument, ReadyReading  — plan/index.ts:30-37
// RULED OUT: PlanEdge, PlanIndex, PlanItem — pr-body.ts:1

// ─────────────────────────────────────────────────────────────────────────────
// 2 · THE CLAUSE RUNNER — a red must name what failed
// ─────────────────────────────────────────────────────────────────────────────

/** A clause that failed, carrying enough to act on without re-running. */
class ClauseFailure extends Error {}

let currentClause = '(none)';
const passed: string[] = [];
const failures: { clause: string; message: string }[] = [];

/**
 * Assert, inside the clause currently running.
 *
 * `detail` is not decoration. The C-6 lesson in this repo is that a gate whose
 * red is unattributable trains a re-run, so every failure here carries the
 * expectation AND the observation, printed once, at the moment it is known.
 */
function check(ok: boolean, expectation: string, detail: () => string): void {
  if (ok) return;
  throw new ClauseFailure(`${expectation}\n      observed: ${detail()}`);
}

async function clause(name: string, body: () => void | Promise<void>): Promise<void> {
  currentClause = name;
  try {
    await body();
    passed.push(name);
    console.log(`  ok   ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ clause: name, message });
    console.log(`  FAIL ${name}\n      ${message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 · FIXTURE-OWNED FOREIGN PORTS — supplied here, never imported from dd
// ─────────────────────────────────────────────────────────────────────────────
//
// Measured basis: flow.ts:106-111 says the injected FsPort "satisfies dd's
// SchemaFs structurally" and reuses it rather than growing a second
// document-reading answer. A foreign port is not a fixture-only trick — it is
// what the production consumer already does, so the fixture does it too.
//
// P3 made this MORE true. `FsDocLoader` moved into `src/links/`, where dd's own
// architecture forbids naming an adapter, so its constructor declares the read
// and hash surfaces structurally. The interfaces below name no dd type and never
// did; they now match the library's own declarations by construction.

/**
 * The foreign fs port — deliberately NOT dd's own adapter.
 *
 * Shape derived from two places at once: dd's `SchemaFs` needs readdir + exists +
 * readText, dd's `FsDocLoader` needs only `readText`. One object satisfies both,
 * structurally, with no dd import — which is why the same `deps.fs` goes to
 * `ConventionSchemaResolver` AND `FsDocLoader` at flow.ts:121-126.
 *
 * It counts its own reads so the memoizing decorator can be proven to decorate
 * something rather than merely to exist.
 */
class FixtureFsPort {
  reads = 0;

  readdir(path: string): string[] {
    try {
      return readdirSync(path);
    } catch {
      return [];
    }
  }

  exists(path: string): boolean {
    return existsSync(path);
  }

  readText(path: string): string | null {
    this.reads += 1;
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  }
}

/** Derived from dd's HashPort — an adapter type, so fixture-owned by design. */
const fixtureHash = {
  sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  },
};

/**
 * Derived from dd's ExecPort — an adapter type, so fixture-owned.
 *
 * Deliberately a STUB rather than a real `git`: `trackedPaths` is being proven
 * here, not git. A stub lets both of its answers be driven on demand — a tracked
 * set, and the null that means "this host has no tracking concept" — which is the
 * distinction the loader's untracked-target WARN depends on.
 *
 * It RECORDS the argv it was handed, because the stdout it must produce depends
 * on it: `git ls-files -z` is NUL-delimited, and a stub that emitted newlines
 * would hand back one long bogus path while looking perfectly reasonable. The
 * fixture asserts the flag rather than trusting the comment.
 */
function fixtureExec(result: { code: number; stdout: string }) {
  const calls: { cmd: string; args: string[] }[] = [];
  return {
    calls,
    async run(
      cmd: string,
      args: string[],
      _opts: { cwd: string; timeoutMs?: number },
    ): Promise<{ code: number; stdout: string; stderr: string; ok: boolean }> {
      calls.push({ cmd, args });
      return { code: result.code, stdout: result.stdout, stderr: '', ok: result.code === 0 };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · THE CORPUS — a real dd plan corpus, copied verbatim, links intact
// ─────────────────────────────────────────────────────────────────────────────

const corpusRoot = realpathSync(
  process.argv[2] ?? (() => new Error('usage: fixture.js <corpus-root>'))().toString(),
);
const planDir = join(corpusRoot, 'docs/plans/001-dd-extraction');
const planPath = join(planDir, 'plan.dd.json');
const logPath = join(planDir, 'execution-log.dd.json');
const tasksPath = join(planDir, 'assets/tasks/phase-1/tasks.dd.json');

const fixtureFs = new FixtureFsPort();

/**
 * S1/S2 — flow.ts:118-129 and plan/index.ts:141-147, the resolver both consumers
 * build. The conditional `home` spread is an `exactOptionalPropertyTypes` idiom
 * present in BOTH, copied rather than simplified.
 */
function buildResolver(home: string | undefined): ConventionSchemaResolver {
  return new ConventionSchemaResolver({
    fs: fixtureFs,
    repoRoot: corpusRoot,
    ...(home !== undefined && { home }),
  });
}

/** S3a — plan/index.ts:327, the untracked loader, wrapped as every consumer wraps it. */
function buildLoader(tracked: ReadonlySet<string> | null): DocLoader {
  return new MemoizingDocLoader(new FsDocLoader(fixtureFs, fixtureHash, tracked));
}

/**
 * S4 — the two-field seam BOTH consumers assemble (flow.ts:120-126,
 * plan/index.ts:526/805). It is also, measurably, the SAME seam `validateWalk`,
 * `resolveMapSeed` and `traverseCorpus` each ask for — three separately-declared
 * dep types, one shape. That is why one object drives all three below.
 */
function buildSeam(tracked: ReadonlySet<string> | null = null): {
  schemaResolver: SchemaResolver;
  docLoader: DocLoader;
} {
  return { schemaResolver: buildResolver(undefined), docLoader: buildLoader(tracked) };
}

function readDoc(path: string): DdDoc {
  const text = fixtureFs.readText(path);
  if (text === null) throw new ClauseFailure(`corpus document is unreadable: ${path}`);
  const parsed = parse(text);
  if (Array.isArray(parsed)) {
    throw new ClauseFailure(
      `corpus document did not parse: ${JSON.stringify(parsed).slice(0, 300)}`,
    );
  }
  return parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 · THE CLAUSES
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`trial-fixture: driving the installed @ai-substrate/dd over ${corpusRoot}\n`);

  // -- C1 ---------------------------------------------------------------------
  await clause('C1 root barrel yields named exports (D-1, census B3)', () => {
    check(
      typeof parseFromRoot === 'function',
      "`import { parse } from '@ai-substrate/dd'` must be a function",
      () => typeof parseFromRoot,
    );
    // Identity, not merely presence: the root must RE-EXPORT the subpath's symbol,
    // not carry a second copy that can drift from it.
    check(
      parseFromRoot === parse,
      'the root barrel must re-export the same `parse` as ./core/parse, not a copy',
      () => 'root parse !== ./core/parse parse',
    );
  });

  // -- C2 ---------------------------------------------------------------------
  let planDoc: DdDoc = readDoc(planPath);
  await clause('C2 parse() reads a real plan document', () => {
    planDoc = readDoc(planPath);
    check(
      planDoc.dd.schema === 'builder/plan',
      'the corpus plan document declares schema `builder/plan`',
      () => planDoc.dd.schema,
    );
    check(
      planDoc.sections.length > 10,
      'a real plan carries more than ten sections (this is not a toy document)',
      () => `${planDoc.sections.length} sections`,
    );
    // Negation: malformed input must be REPORTED, not thrown or silently accepted.
    const failed = parse('{"not":"a dd document"}');
    check(
      Array.isArray(failed) && failed.length > 0,
      'parse() answers a non-empty failure array for a non-dd document',
      () => JSON.stringify(failed).slice(0, 200),
    );
  });

  // -- C3 ---------------------------------------------------------------------
  let schema: ResolvedDdSchema | null = null;
  await clause('C3 ConventionSchemaResolver resolves through a FOREIGN fs port', () => {
    const resolution = buildResolver(undefined).resolve('builder/plan', planPath);
    check(resolution.ok, 'the fixture-owned fs port resolves `builder/plan` from the corpus', () =>
      JSON.stringify(resolution).slice(0, 300),
    );
    if (!resolution.ok) return;
    schema = resolution.schema;

    // Negation: an unresolvable ref must be REFUSED, not answered with an empty ok.
    const missing = buildResolver(undefined).resolve('no-such/schema', planPath);
    check(!missing.ok, 'an unresolvable schema ref must NOT resolve ok', () =>
      JSON.stringify(missing).slice(0, 200),
    );

    // The frozen `SchemaResolver` seam is one method wide and answers
    // `{ ok: false, message }` — a string, deliberately. The TYPED findings hang
    // off the richer `resolveDetailed`, which is how a consumer that switches on a
    // finding CLASS rather than scraping a message is meant to ask. That is also
    // what makes the `SchemaIssue` type import above load-bearing, not decorative.
    const detailed = buildResolver(undefined).resolveDetailed('no-such/schema', planPath);
    const issues: SchemaIssue[] = detailed.issues;
    check(
      issues.some((issue) => issue.class === 'schema-not-found'),
      'resolveDetailed carries a typed `schema-not-found` SchemaIssue',
      () => JSON.stringify(issues).slice(0, 300),
    );
  });

  // -- C4 ---------------------------------------------------------------------
  await clause('C4 MemoizingDocLoader(new FsDocLoader(...)) — the fr-0010 pair', () => {
    const before = fixtureFs.reads;
    const loader = buildLoader(null);
    const first = loader.load(planPath);
    const second = loader.load(planPath);
    check(first.ok, 'the concrete loader loads a real document', () => JSON.stringify(first));
    if (!first.ok || !second.ok) return;
    check(
      first.sha === second.sha && first.sha.length === 64,
      'the load carries a stable sha256 of the document',
      () => `${first.sha} vs ${second.sha}`,
    );
    check(
      first.tracked === null,
      'with `tracked: null` the result reports tracking as UNKNOWABLE (null), not as tracked',
      () => String(first.tracked),
    );
    // The strengthening A-2 called for, and the reason it was ratified rather than
    // just fixed: this clause used to assert `tracked === true`. It was written
    // against observed behaviour after the assertion it was FIRST written with
    // (`false`) failed — so the fixture was conformed to the implementation while
    // the contract sat one screen up in the same module. Pinning `null` alone
    // would still pass if the value silently became `false`, so the two arms below
    // close the third case explicitly.
    check(
      first.tracked !== true,
      'the unknowable answer is not the confident `true` this clause used to pin',
      () => String(first.tracked),
    );
    check(
      first.tracked !== false,
      'nor is it `false` — "no tracking concept" is not "this file is untracked"',
      () => String(first.tracked),
    );
    // The decorator must DECORATE. Two loads, one read — proven by counting the
    // foreign port's reads, which is the only place the saving can show up.
    check(
      fixtureFs.reads - before === 1,
      'two loads of one path cost exactly one read through the memoizer',
      () => `${fixtureFs.reads - before} reads`,
    );
    // Negation: an absent document is REPORTED missing, never thrown.
    const absent = loader.load(join(planDir, 'no-such-document.dd.json'));
    check(
      !absent.ok && absent.reason === 'missing',
      'an absent document loads as { ok: false, reason: "missing" }',
      () => JSON.stringify(absent).slice(0, 200),
    );
  });

  // -- C5 ---------------------------------------------------------------------
  let walkIssues: DdIssue[] = [];
  await clause('C5 validateWalk finds the real findings, and only those', () => {
    walkIssues = validateWalk(planDoc, planPath, buildSeam(), { repoRoot: corpusRoot, depth: 2 });

    const errors = walkIssues.filter((issue) => issue.severity === 'ERROR');
    check(
      errors.length === 0,
      'a genuine, valid plan corpus produces NO ERROR-severity findings',
      () => JSON.stringify(errors).slice(0, 400),
    );

    // FOUND: the plan links to four phase task documents; the corpus carries one.
    const missing = walkIssues.filter((issue) => issue.class === 'address-target-missing');
    check(
      missing.length === 3,
      'exactly 3 address-target-missing — phases 2, 3 and 4 are deliberately absent',
      () => `${missing.length}: ${missing.map((issue) => issue.location).join(', ')}`,
    );

    // ABSENT, and this is the non-vacuity control: phase 1 IS in the corpus, so if
    // link resolution were simply reporting every target as missing this would be 4.
    check(
      !missing.some((issue) => issue.message.includes('phase-1')),
      'phase-1 IS present, so it must produce no missing-target finding',
      () => missing.map((issue) => issue.message).join('; '),
    );

    // ABSENT: `tracked: null` means "this host has no tracking concept", so the
    // untracked WARN must be SUPPRESSED rather than fired at every target.
    const untracked = walkIssues.filter((issue) => issue.class === 'address-target-untracked');
    check(
      untracked.length === 0,
      'with `tracked: null` the untracked-target WARN is suppressed entirely',
      () => `${untracked.length} untracked findings`,
    );
  });

  // -- C6 ---------------------------------------------------------------------
  await clause('C6 parseAddress / isAddressFailure / resolveAddressFile', () => {
    const address = parseAddress('plan.dd.json#acceptance_criteria/ac-0001');
    check(!isAddressFailure(address), 'a well-formed address parses', () =>
      JSON.stringify(address).slice(0, 200),
    );
    // Negation: `isAddressFailure` must be able to say NO, or it says nothing.
    const bad = parseAddress('#'.repeat(4));
    check(isAddressFailure(bad), 'a malformed address is reported as a failure, not parsed', () =>
      JSON.stringify(bad).slice(0, 200),
    );
    const resolved = resolveAddressFile(tasksPath, '../../../plan.dd.json');
    check(
      resolved === planPath,
      'a relative address resolves against the document that holds it',
      () => `${resolved} != ${planPath}`,
    );
  });

  // -- C7 ---------------------------------------------------------------------
  await clause('C7 collectLinkCells needs the RESOLVED schema, and finds real cells', () => {
    if (schema === null) throw new ClauseFailure('C3 did not resolve a schema to collect against');
    const cells = collectLinkCells(planDoc, schema);
    check(
      cells.length > 0,
      'the plan document carries schema-declared link cells',
      () => `${cells.length} cells`,
    );
    check(
      cells.some((cell) => cell.raw.includes('execution-log.dd.json')),
      'the acceptance criteria `proven_by` cells are among them',
      () =>
        cells
          .map((cell) => cell.raw)
          .slice(0, 5)
          .join(', '),
    );
  });

  // -- C8 ---------------------------------------------------------------------
  await clause('C8 resolveMapSeed + traverseCorpus walk the real graph', () => {
    const seam = buildSeam();
    const seed = resolveMapSeed(planPath, seam, { repoRoot: corpusRoot });
    check(seed.ok, 'the plan document resolves as a map seed', () =>
      JSON.stringify(seed).slice(0, 300),
    );

    const graph = traverseCorpus([planPath], seam, { repoRoot: corpusRoot, mode: 'direct' });
    check(graph.visited.includes(planPath), 'the traversal visits its seed', () =>
      graph.visited.join(', '),
    );
    // Real CROSS-DOCUMENT traversal: reached only by following an edge out of the
    // plan into a different file. A single-document walk cannot produce this.
    check(
      graph.visited.includes(tasksPath),
      'the traversal follows a real edge into the phase-1 tasks document',
      () => graph.visited.join(', '),
    );
    check(
      graph.edges.some((edge) => edge.from === planPath && edge.to === logPath),
      'the graph carries the plan -> execution-log edge the `proven_by` cells declare',
      () => `${graph.edges.length} edges, none plan -> execution-log`,
    );
  });

  // -- C9 ---------------------------------------------------------------------
  await clause('C9 trackedPaths — both answers, and the loader honours the set', async () => {
    const relative = 'docs/plans/001-dd-extraction/plan.dd.json';
    // NUL-delimited, because `git ls-files -z` is. A stub emitting newlines would
    // yield ONE entry that is every path concatenated — a set that looks populated
    // and matches nothing.
    const exec = fixtureExec({ code: 0, stdout: `${relative}\0${'docs/plans/other.dd.json'}\0` });
    const tracked = await trackedPaths(exec, corpusRoot);
    check(
      exec.calls.some((call) => call.cmd === 'git' && call.args.includes('-z')),
      'trackedPaths asks git for NUL-delimited output, which is why the stub emits \\0',
      () => JSON.stringify(exec.calls),
    );
    check(
      tracked !== null && tracked.size === 2,
      'a successful `git ls-files` becomes a two-entry tracked set',
      () => String(tracked === null ? null : tracked.size),
    );
    check(
      tracked !== null && tracked.has(planPath),
      'the set holds ABSOLUTE posix paths, anchored on the repo root, not git\u2019s relative ones',
      () => JSON.stringify(tracked === null ? null : [...tracked]),
    );

    // The null answer is a DIFFERENT fact from an empty set — "no tracking concept"
    // rather than "nothing is tracked" — and the untracked WARN depends on it.
    const none = await trackedPaths(fixtureExec({ code: 128, stdout: '' }), corpusRoot);
    check(none === null, 'a failing git yields null (no tracking concept), NOT an empty set', () =>
      JSON.stringify(none),
    );

    // S3b/S3c — feed the set into the loader and prove it is CONSULTED. Both arms
    // are needed to tell "consulted" from "hard-coded": a loader that answered a
    // constant `true` would pass the in-set arm alone. Since A-2 the no-set answer
    // is `null` (C4), so a loader ignoring the set is now caught by either arm —
    // but the pair is kept because it pins the two real answers, not the absence.
    if (tracked === null) return;
    const loader = buildLoader(tracked);
    const inSet = loader.load(planPath);
    check(
      inSet.ok && inSet.tracked === true,
      'a document IN the tracked set loads as tracked: true',
      () => JSON.stringify(inSet).slice(0, 200),
    );
    const outOfSet = loader.load(logPath);
    check(
      outOfSet.ok && outOfSet.tracked === false,
      'a document ABSENT from the tracked set loads as tracked: false — the set is consulted',
      () => JSON.stringify(outOfSet).slice(0, 200),
    );
  });

  // -- C10 --------------------------------------------------------------------
  await clause('C10 renderDocument runs off the installed tarball', async () => {
    const result = await renderDocument(planPath, corpusRoot);
    check(result.ok, 'the real plan document renders', () => JSON.stringify(result).slice(0, 400));
    if (!result.ok) return;
    check(
      result.schema === 'builder/plan',
      'the render reports the schema it rendered against',
      () => result.schema,
    );
    check(
      result.markdown.includes('dd standalone extraction'),
      "the rendered markdown carries the document's real title",
      () => result.markdown.slice(0, 200),
    );
    check(
      result.sibling.endsWith('plan.dd.md'),
      'the render names the sibling markdown beside the document',
      () => result.sibling,
    );
  });

  // -- C11 --------------------------------------------------------------------
  await clause('C11 renderer helpers behave', () => {
    check(
      escapeCell('a|b') === 'a\\|b',
      'escapeCell escapes a pipe so a cell can never break its row',
      () => escapeCell('a|b'),
    );
    check(
      escapeCell('<b>') === '&lt;b&gt;',
      'escapeCell neutralises HTML rather than passing it through',
      () => escapeCell('<b>'),
    );
    check(
      headingSlug('Acceptance Criteria') === 'acceptance-criteria',
      'headingSlug lowercases and hyphenates',
      () => headingSlug('Acceptance Criteria'),
    );
  });

  // -- C12 --------------------------------------------------------------------
  await clause('C12 DD_ISSUE_CODES names an E-code for every class actually produced', () => {
    const observed = [...new Set(walkIssues.map((issue) => issue.class))];
    check(
      observed.length > 0,
      'C5 produced findings to look codes up for (otherwise this clause is vacuous)',
      () => '0 classes observed',
    );
    const uncoded = observed.filter((issueClass) => !DD_ISSUE_CODES[issueClass]);
    check(uncoded.length === 0, 'every finding class the walk produced has a frozen E-code', () =>
      uncoded.join(', '),
    );
    check(
      DD_ISSUE_CODES['address-target-missing'].startsWith('E'),
      'the codes are the CLI E-vocabulary a consumer can switch on',
      () => DD_ISSUE_CODES['address-target-missing'],
    );
  });

  // -- C13 --------------------------------------------------------------------
  await clause('C13 NodeSchemaFs answers the same as the foreign port', () => {
    const viaNode = new ConventionSchemaResolver({
      fs: new NodeSchemaFs(),
      repoRoot: corpusRoot,
    }).resolve('builder/plan', planPath);
    const viaFixture = buildResolver(undefined).resolve('builder/plan', planPath);
    check(
      viaNode.ok && viaFixture.ok,
      'dd\u2019s own fs adapter and the fixture\u2019s foreign port both resolve the schema',
      () => `node: ${viaNode.ok}, fixture: ${viaFixture.ok}`,
    );
    // If these disagreed, every clause above would be proving something about the
    // fixture's port rather than about dd.
    if (!viaNode.ok || !viaFixture.ok) return;
    check(
      viaNode.schema.name === viaFixture.schema.name,
      'both ports resolve to the SAME schema, so the foreign port is a faithful stand-in',
      () => `${viaNode.schema.name} vs ${viaFixture.schema.name}`,
    );
  });

  // -- C14 --------------------------------------------------------------------
  await clause('C14 DdActDeps is constructible from the public surface alone', () => {
    // `DdActDeps` is `@experimental` and its `clock` field is typed by `Clock`,
    // which is NOT public. Structural typing is what makes that fine — a consumer
    // supplies the shape without naming the type. Proving it here is the point:
    // if it ever stopped being constructible, the type would be nameable and
    // useless, which is a surface FINDING rather than a fixture problem.
    const deps: DdActDeps = {
      clock: {
        nowIso: () => '2026-08-08T00:00:00.000Z',
        sleep: async () => undefined,
      },
    };
    check(deps.clock.nowIso().endsWith('Z'), 'the injected clock answers an ISO instant', () =>
      deps.clock.nowIso(),
    );
  });

  // ---------------------------------------------------------------------------
  console.log('');
  if (failures.length > 0) {
    console.error(
      `trial-fixture FAILED — ${failures.length} of ${passed.length + failures.length} clauses:`,
    );
    for (const failure of failures) console.error(`  - ${failure.clause}`);
    process.exit(1);
  }
  console.log(
    `trial-fixture PASSED — ${passed.length} clauses, every symbol via a public subpath.`,
  );
}

await main().catch((error: unknown) => {
  console.error(`trial-fixture CRASHED in clause "${currentClause}":`);
  console.error(error);
  process.exit(1);
});
