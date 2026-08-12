#!/usr/bin/env node
// Runtime reachability probe for @ai-substrate/dd's exports map.
//
// RUN IT:  node scripts/exports-reachability-probe.mjs   (from the repo root)
//
// SELF-SUFFICIENT BY DESIGN. It builds its own scratch project and symlink rather
// than requiring a hand-made one. A gate that only works when its operator has
// prepared the environment correctly is the shallow-clone defect waiting to happen:
// CI's first run went red because `sourceStamp` asked "which commit last changed
// this path" of a shallow clone, which cannot answer and does not say so. An
// instrument must either work where it runs or refuse — never answer a question it
// cannot see.
//
// ⚠️ AND HERE IS THE QUESTION THIS PROBE CANNOT SEE, stated because this is the
// gate people reach for when they think "is the exports map right".
//
// IT SYMLINKS THE REPO (see `symlinkSync` below), so it resolves against the
// WORKING TREE and is structurally blind to the `files` allowlist. An `exports`
// entry pointing at a path that `files` does not pack — reachable here, ABSENT
// from the tarball a consumer installs — passes this probe every time.
//
// The gate that catches that coupling is `scripts/pack-gate.sh`, whose
// `attw --pack <tarball>` resolves every exports entry against the REAL packed
// artifact (negation-proved there by pointing `exports["./links"].types` at a
// missing file). TWO GATES THAT DISAGREE BY CONSTRUCTION, and only one of them
// can see `files` at all.
//
// Live example, not hypothetical: `dist/plan` is packed (18 files, 71KB) and not
// exported. Un-packing it is under consideration — and if `./plan` were ever
// exported without restoring it to `files`, THIS PROBE WOULD STILL PASS.
// Answers the question a barrel-file reading cannot: can a CONSUMER import this
// subpath? An exports map does not merely fail to list a path, it FORBIDS it
// (ERR_PACKAGE_PATH_NOT_EXPORTED), so "the module exports it" and "a consumer can
// import it" are different facts. Method suggested by pij-related-koala.
//
// Every result is paired with a POSITIVE CONTROL: a probe that reports "all
// forbidden" proves nothing if the probe itself is broken.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..');

// dist/ is what the exports map points at — probing without it measures nothing.
if (!existsSync(join(REPO, 'dist', 'index.js'))) {
  console.error('dist/ is missing — run `npm run build` first. Refusing to probe a tree');
  console.error('whose exports map points at files that do not exist: a probe that cannot');
  console.error('see the artifact must refuse, not report everything forbidden.');
  process.exit(1);
}

// Build the consumer view in a scratch dir, so the probe never depends on the
// operator having prepared one.
const scratch = mkdtempSync(join(tmpdir(), 'dd-exports-probe-'));
writeFileSync(join(scratch, 'package.json'), JSON.stringify({ name: 'probe', type: 'module' }));
mkdirSync(join(scratch, 'node_modules', '@ai-substrate'), { recursive: true });
symlinkSync(REPO, join(scratch, 'node_modules', '@ai-substrate', 'dd'), 'dir');

const CONSUMED = [
  'core/address', 'core/model', 'core/parse', 'core/validate', 'core/walk',
  'links', 'node', 'render/renderer', 'schema', 'schema/index', 'schema/model',
  'schema/resolve',
];

// R-2 ruled these OUT of the public surface. Listing them as an EXPECTATION, not
// as a finding: the probe now fails if one ever becomes reachable, which is the
// only way a deliberate omission stays deliberate. Previously `plan` sat in
// CONSUMED and was reported as "UNREACHABLE BY A CONSUMER" — true, but it read as
// a defect when it is a ruling.
const RULED_OUT = [
  // "does not ship" was WRONG and this label said it for the life of the branch.
  // Measured 2026-08-09: `dist/plan` IS in the tarball — 18 files, 71KB, 7.1% of
  // the package — because `files` is `["bin","dist","LICENSE"]`. It ships and is
  // UNREACHABLE, which is a different fact and the one that matters: a consumer
  // installs the compiled plan layer and cannot import a symbol of it. The
  // imprecision was not free — it framed a consumer's investigation around
  // "can this be rebuilt from primitives" when the finished layer was already
  // in their node_modules.
  { spec: 'plan', why: 'R-2/OQ-2: plan/ ships in dist but is NOT EXPORTED — held, not stripped' },
  { spec: 'acts/shared', why: 'the CLI half is never exported (fr-0010 option (a), rejected)' },
  { spec: 'acts/build', why: 'ditto — renderDocument is reachable at ./node instead' },
];

// The ratified root allowlist (design-decision D-1), RUNTIME bindings only. The
// four type-only members — DdDoc, DdIssue, DocLoader, SchemaResolver — carry no
// runtime binding, so the subpath resolving is the whole claim for them, exactly
// as the P1 census recorded.
const ROOT_RUNTIME_EXPORTS = [
  'ConventionSchemaResolver', 'FsDocLoader', 'MemoizingDocLoader', 'collectLinkCells',
  'isAddressFailure', 'parse', 'parseAddress', 'resolveAddressFile', 'validateWalk',
];

// The six symbols the P1 census measured as CONSUMED-BUT-FORBIDDEN (group B1) —
// the floor Q-4 started from — each at the home the ratified delta gave it.
const MOVED_SYMBOLS = [
  { spec: '.', name: 'FsDocLoader', from: 'src/acts/shared.ts' },
  { spec: 'links', name: 'FsDocLoader', from: 'src/acts/shared.ts' },
  { spec: 'node', name: 'NodeSchemaFs', from: 'src/acts/schema-fs.ts' },
  { spec: 'node', name: 'trackedPaths', from: 'src/acts/shared.ts' },
  { spec: 'node', name: 'DD_ISSUE_CODES', from: 'src/acts/shared.ts (A-1)' },
  { spec: 'node', name: 'renderDocument', from: 'src/acts/build.ts (A-1)' },
];

// The DECLARED surface of EVERY published subpath — type-only exports INCLUDED.
//
// MEMBERSHIP IS A COMMITMENT; REACHABILITY IS NOT THE SAME CLAIM. The section
// below this one proves a consumer CAN import each subpath. That says nothing
// about WHAT they get. Eleven of the thirteen subpaths re-export their modules
// wholesale, so before this table `export function foo()` added to
// `src/core/validate.ts` was instantly public API with no gate, no review and no
// record — the `ActDeps` leak class (a sixth symbol shipping from `./node` on a
// tier ratified at five), but at module scope where nothing was watching.
//
// The runtime probe cannot close it. `import * as ns` yields runtime bindings
// only, so a type-only surplus is structurally invisible to every other check in
// this file. That is measured, not feared: `ActDeps` was plainly readable in
// `dist/node/index.d.ts` and unseen here. Reachable but unasserted is the same
// as unmeasured.
//
// So this reads the EMITTED `.d.ts` and demands an EXACT set, failing in BOTH
// directions. A missing symbol breaks a consumer; a surplus one is a published
// symbol nobody reviewed, and it is far cheaper to refuse it now than to remove
// it after someone imports it.
//
// THE LISTS ARE LITERAL ON PURPOSE. Deriving them at runtime from the same
// `.d.ts` they are checked against would produce a list that agrees with any
// surface — a guard that can never fail, which is worse than no guard because it
// reports safety. These are values a reviewer reads in a diff, so WIDENING THE
// SURFACE IS AN EDIT SOMEONE SEES. The eleven wholesale subpaths were seeded
// from the surface already shipping at HEAD (`npm run build`, then the emitted
// `.d.ts` read with this file's own parser): that freezes what shipped so the
// NEXT addition is a decision, and ratifies no new choices.
//
// Keyed by EMITTED FILE, not by subpath, because `./schema` and `./schema/index`
// are two exports-map keys onto one `.d.ts`. One list per file cannot disagree
// with itself the way two copies would; `subpaths` records which keys it serves,
// and the coverage check below makes the table's own completeness a gate.
const DECLARED_SURFACE = [
  {
    file: 'dist/lib.d.ts',
    subpaths: ['.'],
    label: '@ai-substrate/dd',
    authority: 'the D-1 allowlist',
    names: [
      'ConventionSchemaResolver', 'DdDoc', 'DdIssue', 'DocLoader', 'FsDocLoader',
      'MemoizingDocLoader', 'SchemaFs', 'SchemaResolver', 'collectLinkCells',
      'isAddressFailure', 'parse', 'parseAddress', 'resolveAddressFile', 'validateWalk',
    ],
  },
  {
    file: 'dist/node/index.d.ts',
    subpaths: ['./node'],
    label: '…/node',
    authority: 'A-1 (the five-symbol operational tier)',
    names: ['DD_ISSUE_CODES', 'DdActDeps', 'NodeSchemaFs', 'renderDocument', 'trackedPaths'],
  },
  {
    file: 'dist/core/address.d.ts',
    subpaths: ['./core/address'],
    label: '…/core/address',
    authority: 'the P7 baseline',
    names: [
      'DdAddress', 'DdAddressFailure', 'DdAddressSegment', 'formatAddress', 'isAddressFailure',
      'normalizeAddress', 'normalizeFilePath', 'parseAddress',
    ],
  },
  {
    file: 'dist/core/model.d.ts',
    subpaths: ['./core/model'],
    label: '…/core/model',
    authority: 'the P7 baseline',
    names: [
      'DdDoc', 'DdEnumSchema', 'DdFailure', 'DdFailureClass', 'DdHeader', 'DdInstance',
      'DdPrimitiveType', 'DdReference', 'DdReferenceMode', 'DdSection', 'DdSectionSchema',
      // Widened for tally columns: a consumer typing a shape has to be able to
      // name what a column's `tally` marking may be. The union is the whole
      // vocabulary, so exporting it exports no mechanism.
      'DdShape', 'DdStateEntry', 'DdTallyRole', 'ResolvedDdSchema',
    ],
  },
  {
    file: 'dist/core/parse.d.ts',
    subpaths: ['./core/parse'],
    label: '…/core/parse',
    authority: 'the P7 baseline',
    names: ['parse'],
  },
  {
    file: 'dist/core/validate.d.ts',
    subpaths: ['./core/validate'],
    label: '…/core/validate',
    authority: 'the P7 baseline',
    names: [
      'DdIssue', 'DdIssueClass', 'DdLinkCell', 'DdSeverity', 'SchemaResolveResult',
      'SchemaResolver', 'collectLinkCells', 'isPathWithinRepo', 'resolveAddressFile',
      'validateDocument',
    ],
  },
  {
    file: 'dist/core/walk.d.ts',
    subpaths: ['./core/walk'],
    label: '…/core/walk',
    authority: 'the P7 baseline',
    names: [
      'DocLoadResult', 'DocLoader', 'ValidateWalkDeps', 'ValidateWalkOptions',
      'shouldExcludeFromSweep', 'validateWalk',
    ],
  },
  {
    file: 'dist/links/index.d.ts',
    subpaths: ['./links'],
    label: '…/links',
    authority: 'the P7 baseline',
    names: [
      'DD_SUFFIX', 'DdAdapterGap', 'DdAdapterGapSource', 'DdAddressable', 'DdAddressableKind',
      'DdBasisResult', 'DdBasisState', 'DdBasisVerdict', 'DdCorpusGraph', 'DdCorpusScan',
      'DdDoctorDeps', 'DdDoctorFinding', 'DdDoctorOptions', 'DdDoctorReport', 'DdDocumentIndex',
      'DdGraphNode', 'DdLedgerUpdate', 'DdLinkEdge', 'DdLinkIssue', 'DdLinkIssueClass',
      'DdLinkResolution', 'DdLinkResolveOptions', 'DdLinkResolverDeps', 'DdLinkTarget',
      'DdLinkUnresolvedReason', 'DdLinksReport', 'DdMapArm', 'DdMapCut', 'DdMapDeps',
      'DdMapDirection', 'DdMapEdge', 'DdMapMark', 'DdMapNode', 'DdMapOptions', 'DdMapPalette',
      'DdMapResult', 'DdResolvedSegment', 'DdSegmentKind', 'DdTraverseDeps', 'DdTraverseOptions',
      'DdWalkBounds', 'DdWalkCut', 'DdWalkResult', 'DdWalkStep', 'DdWalkVisit', 'DocLoader',
      'FsDocLoader', 'MAP_WIDTH', 'MemoizingDocLoader', 'PLAIN_MAP_PALETTE', 'SchemaResolver',
      'UNBOUNDED', 'addressableAt', 'anchorForLocation', 'boundedWalk', 'findLedgerEntry',
      'indexDocument', 'isWithinLocation', 'linkIssue', 'linksFor', 'mapAddress',
      'reachableFrom', 'renderMapTree', 'resolveLink', 'resolveLinksTarget', 'resolveMapSeed',
      'runDoctor', 'scanCorpus', 'toMermaid', 'traverseCorpus', 'updateLedgerEntry',
      'verifyBasis', 'wrapPlain',
    ],
  },
  {
    file: 'dist/render/renderer.d.ts',
    subpaths: ['./render/renderer'],
    label: '…/render/renderer',
    authority: 'the P7 baseline',
    names: [
      'MAX_CELL_DEPTH', 'RENDER_BANNER', 'escapeCell', 'headingSlug', 'renderDd',
      'sectionForAddress', 'sectionTitle',
    ],
  },
  {
    file: 'dist/schema/index.d.ts',
    subpaths: ['./schema', './schema/index'],
    label: '…/schema(/index)',
    authority: 'the P7 baseline',
    names: [
      'BUILTIN_COMPLETION_ENUM', 'ConventionSchemaResolver', 'DdDerivedState', 'DdSchemaItem',
      'DdSection', 'DeclarationResult', 'RootScan', 'SCAN_SKIP_DIRS', 'SCAN_SKIP_PATHS',
      'SCHEMAS_DIR', 'SCHEMA_FILE', 'SUPPORTED_SCHEMA_VERSION', 'SchemaDeclaration', 'SchemaFs',
      'SchemaHit', 'SchemaIssue', 'SchemaIssueClass', 'SchemaListEntry', 'SchemaListing',
      'SchemaRecord', 'SchemaResolution', 'SchemaResolverOptions', 'SchemaRoot',
      'SchemaRootKind', 'SchemaSeverity', 'deriveSchemaItems', 'deriveSchemaState',
      'isQualifiedName', 'parseSchemaDeclaration', 'scanRoot', 'schemaIssue',
    ],
  },
  {
    file: 'dist/schema/model.d.ts',
    subpaths: ['./schema/model'],
    label: '…/schema/model',
    authority: 'the P7 baseline',
    names: [
      'DdSchemaItem', 'SCAN_SKIP_DIRS', 'SCAN_SKIP_PATHS', 'SCHEMAS_DIR', 'SCHEMA_FILE',
      'SUPPORTED_SCHEMA_VERSION', 'SchemaFs', 'SchemaHit', 'SchemaIssue', 'SchemaIssueClass',
      'SchemaListEntry', 'SchemaListing', 'SchemaRecord', 'SchemaResolution', 'SchemaRoot',
      'SchemaRootKind', 'SchemaSeverity', 'schemaIssue',
    ],
  },
  {
    file: 'dist/schema/resolve.d.ts',
    subpaths: ['./schema/resolve'],
    label: '…/schema/resolve',
    authority: 'the P7 baseline',
    names: [
      'ConventionSchemaResolver', 'SchemaResolverOptions', 'deriveSchemaItems',
      'deriveSchemaState',
    ],
  },
];

/**
 * Every name a `.d.ts` publishes, or a REFUSAL.
 *
 * `export *` used to be an automatic refusal, on the reasoning that it makes a
 * surface unenumerable by reading. Measured at HEAD that was too broad: the two
 * wholesale barrels (`links/index`, `schema/index`) BOTH star-re-export a
 * sibling `./model.js`, and a relative star IS enumerable — it just takes one
 * more file. Refusing there would mean the two largest surfaces on the map could
 * never be pinned, which is the hole this section exists to close.
 *
 * So a relative star is FOLLOWED, recursively, and its names join this file's.
 * What still refuses is what genuinely cannot be read: a star from a bare
 * specifier (whose names live in a package this script does not resolve), a star
 * whose target is missing, or a cycle. Refuse rather than guess — the
 * shallow-clone rule applied to the probe's own instrument.
 *
 * `export * as ns` is a different statement: it publishes ONE name, the
 * namespace, and is recorded as that name rather than followed.
 */
function declaredNames(declPath, seen = new Set()) {
  const shown = relative(REPO, declPath);
  if (seen.has(declPath)) return { refused: `\`export *\` cycles back through ${shown}` };
  seen.add(declPath);
  if (!existsSync(declPath)) return { refused: `${shown} does not exist` };
  // Comments talk ABOUT exports; strip them rather than pattern-match around them.
  const code = readFileSync(declPath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  const names = new Set();
  // `export * as ns from '…'` publishes the namespace name, not the target's names.
  for (const match of code.matchAll(/export\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from/g)) {
    names.add(match[1]);
  }
  for (const match of code.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g)) {
    const spec = match[1];
    if (!spec.startsWith('.')) {
      return { refused: `\`export * from '${spec}'\` — a bare specifier's names are not readable from here` };
    }
    const nested = declaredNames(join(dirname(declPath), spec.replace(/\.js$/, '.d.ts')), seen);
    if (nested.refused) return { refused: `via \`export * from '${spec}'\` in ${shown}: ${nested.refused}` };
    for (const name of nested.names) names.add(name);
  }
  for (const match of code.matchAll(/export\s+(?:type\s+)?\{([\s\S]*?)\}/g)) {
    for (const raw of match[1].split(',')) {
      const part = raw.trim().replace(/^type\s+/, '');
      if (part === '') continue;
      const aliased = part.split(/\s+as\s+/);
      names.add((aliased[1] ?? aliased[0]).trim());
    }
  }
  // Declarations exported in place, not through a brace list.
  const declared = /export\s+(?:declare\s+)?(?:abstract\s+)?(?:function|const|let|var|class|interface|enum|type)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of code.matchAll(declared)) names.add(match[1]);
  return { names: [...names].sort() };
}

// Controls: one that MUST resolve, two that MUST fail — so a uniform result
// (all-ok or all-forbidden) is detectable as a broken probe rather than a finding.
const CONTROLS = [
  { spec: '.', expect: 'reachable', why: 'root export is declared — if this fails the probe is broken' },
  { spec: 'definitely/not/a/real/subpath', expect: 'forbidden', why: 'undeclared path must be refused' },
  { spec: 'core/parse.js', expect: 'forbidden', why: 'declared path with wrong extension must be refused' },
];

function probe(sub) {
  const spec = sub === '.' ? '@ai-substrate/dd' : `@ai-substrate/dd/${sub}`;
  // Child process per subpath: resolution must happen from the CONSUMER's cwd, and
  // a root import executes the CLI as a side effect — which would otherwise set this
  // process's exit code and print help into our own output.
  const src =
    `import(${JSON.stringify(spec)})` +
    `.then(m=>{const n=Object.keys(m).filter(k=>k!=='default');` +
    `process.stdout.write('OK '+n.length+' '+n.join(','))})` +
    `.catch(e=>process.stdout.write('ERR '+(e.code??'UNKNOWN')))`;
  try {
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', src], {
      cwd: scratch, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const marker = out.lastIndexOf('OK ') >= 0 ? out.slice(out.lastIndexOf('OK ')) : out;
    if (marker.startsWith('OK ')) {
      const [, count, names = ''] = marker.split(' ');
      return { ok: true, names: Number(count), exports: names ? names.split(',') : [] };
    }
    const err = out.slice(out.lastIndexOf('ERR '));
    return { ok: false, code: err.replace('ERR ', '').trim() || 'UNKNOWN' };
  } catch {
    return { ok: false, code: 'SPAWN_FAILED' };
  }
}

let failures = [];

console.log('=== CONTROLS (probe validity) ===');
let controlsPassed = true;
for (const c of CONTROLS) {
  const r = probe(c.spec);
  const got = r.ok ? 'reachable' : 'forbidden';
  const pass = got === c.expect;
  if (!pass) controlsPassed = false;
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${c.spec.padEnd(34)} expected ${c.expect.padEnd(10)} got ${got}` +
      (r.ok ? ` (${r.names} named exports)` : ` (${r.code})`),
  );
}
if (!controlsPassed) {
  console.log('\n!! CONTROLS FAILED — every result below is meaningless. Fix the probe.\n');
  process.exit(1);
}
console.log('\nControls pass — probe is trustworthy; results below are real.\n');

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PURITY — the §4.3 regression gate, stated explicitly.
//
// This is the defect the whole surface change exists to fix, so it gets its own
// section rather than being implied by an export count. Importing the package
// root used to EXECUTE the dd CLI: it printed the help block to stdout and
// yielded zero named exports (P1 census group B3, measured twice). A regression
// here is silent in every other check — the map would still resolve, the types
// would still emit, and every consumer would still get a CLI run on import.
//
// Two independent claims, because either can regress without the other:
//   1. importing the root WRITES NOTHING to stdout or stderr, and
//   2. it yields the ratified named exports.
// A barrel that re-exported the bin would pass (2) and fail (1).
// ─────────────────────────────────────────────────────────────────────────────
console.log('=== ROOT PURITY (§4.3 regression gate) ===');
{
  // Import the root and print NOTHING ourselves. Anything on stdout/stderr came
  // from the module, which is the measurement.
  const src = `await import('@ai-substrate/dd');`;
  let stdout = '';
  let stderr = '';
  let spawnOk = true;
  try {
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', src], {
      cwd: scratch, encoding: 'utf8',
    });
    stdout = child.stdout ?? '';
    stderr = child.stderr ?? '';
    if (child.status !== 0) spawnOk = false;
  } catch {
    spawnOk = false;
  }

  if (!spawnOk) {
    failures.push('root import did not complete cleanly');
    console.log('FAIL  importing the root did not exit 0');
  }
  const silent = stdout === '' && stderr === '';
  if (!silent) {
    failures.push('root import produced output — the CLI (or something) ran on import');
    console.log(`FAIL  root import wrote ${stdout.length}B stdout / ${stderr.length}B stderr`);
    console.log(`      first bytes: ${JSON.stringify((stdout || stderr).slice(0, 120))}`);
  } else {
    console.log('PASS  importing the root writes nothing — no CLI, no stdout, no side effects');
  }

  const root = probe('.');
  const missing = ROOT_RUNTIME_EXPORTS.filter((name) => !root.exports?.includes(name));
  const extra = (root.exports ?? []).filter((name) => !ROOT_RUNTIME_EXPORTS.includes(name));
  if (missing.length) {
    failures.push(`root barrel is missing: ${missing.join(', ')}`);
    console.log(`FAIL  root barrel missing ${missing.length}: ${missing.join(', ')}`);
  } else {
    console.log(`PASS  root barrel exports all ${ROOT_RUNTIME_EXPORTS.length} ratified runtime symbols`);
  }
  // A surplus runtime symbol is now a FAILURE, not a note. It was a note in T4 on
  // the reasoning that the allowlist is a decision record this script should not
  // overrule — but the P3 review showed what that costs: an unratified symbol
  // reached `dist/` and nothing went red. Reporting loudly is not asserting. The
  // allowlist is still the decision record; this just stops it drifting silently.
  if (extra.length) {
    failures.push(`root barrel exports ${extra.length} symbol(s) beyond the D-1 allowlist: ${extra.join(', ')}`);
    console.log(`FAIL  root barrel exports ${extra.length} symbol(s) beyond the D-1 allowlist: ${extra.join(', ')}`);
    console.log('      Every addition to the root is an API review. If that review happened, update this list.');
  }
}

console.log('\n=== DECLARED SURFACE (exact membership, types included) ===');
// The table's own completeness is a gate. Without this, adding a subpath to the
// exports map and no entry here would publish a whole module unwatched — the
// same hole one level up, and invisible for exactly the same reason: nothing
// asked whether the list was complete. Both sides are hand-maintained, so this
// compares two records rather than deriving one from the other.
{
  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));
  const published = Object.keys(pkg.exports).filter((key) => key !== './package.json');
  const pinned = DECLARED_SURFACE.flatMap((entry) => entry.subpaths);
  const unpinned = published.filter((key) => !pinned.includes(key));
  const stale = pinned.filter((key) => !published.includes(key));
  if (unpinned.length) {
    failures.push(`exports map publishes ${unpinned.length} subpath(s) with no ratified member list: ${unpinned.join(', ')}`);
    console.log(`FAIL  ${unpinned.length} published subpath(s) NOT pinned: ${unpinned.join(', ')}`);
    console.log('      A new subpath publishes its whole module. Add its ratified list below.');
  }
  if (stale.length) {
    failures.push(`DECLARED_SURFACE pins ${stale.length} subpath(s) the exports map no longer publishes: ${stale.join(', ')}`);
    console.log(`FAIL  ${stale.length} pinned subpath(s) no longer published: ${stale.join(', ')}`);
  }
  if (!unpinned.length && !stale.length) {
    console.log(`PASS  all ${published.length} published subpaths have a ratified member list (${DECLARED_SURFACE.length} emitted targets)`);
  }
}
for (const { file, label, authority, names: ratified } of DECLARED_SURFACE) {
  const declPath = join(REPO, file);
  if (!existsSync(declPath)) {
    failures.push(`${file} is missing — the declared surface cannot be read`);
    console.log(`MISSING    ${file} — build first, or the barrel stopped emitting types`);
    continue;
  }
  const parsed = declaredNames(declPath);
  if (parsed.refused) {
    failures.push(`${file}: ${parsed.refused}`);
    console.log(`REFUSED    ${file} — ${parsed.refused}`);
    continue;
  }
  const absent = ratified.filter((name) => !parsed.names.includes(name));
  const surplus = parsed.names.filter((name) => !ratified.includes(name));
  if (absent.length === 0 && surplus.length === 0) {
    console.log(`PASS  ${label.padEnd(18)} declares exactly ${ratified.length} symbol${ratified.length === 1 ? '' : 's'} — ${authority}`);
    continue;
  }
  if (absent.length) {
    failures.push(`${label} no longer declares: ${absent.join(', ')}`);
    console.log(`FAIL  ${label.padEnd(18)} missing ${absent.length}: ${absent.join(', ')}`);
  }
  if (surplus.length) {
    failures.push(`${label} declares ${surplus.length} symbol(s) beyond ${authority}: ${surplus.join(', ')}`);
    console.log(`FAIL  ${label.padEnd(18)} surplus ${surplus.length}: ${surplus.join(', ')}`);
    console.log('      A symbol on a published barrel IS published, types included. Ratify it or drop it.');
  }
}

console.log('\n=== CONSUMED SUBPATHS (must be reachable) ===');
for (const sub of CONSUMED) {
  const r = probe(sub);
  if (r.ok) {
    console.log(
      `reachable  ${sub.padEnd(18)} ${r.names} named exports  [${r.exports.slice(0, 3).join(', ')}…]`,
    );
  } else {
    failures.push(`${sub} is FORBIDDEN but must be reachable (${r.code})`);
    console.log(`FORBIDDEN  ${sub.padEnd(18)} ${r.code}`);
  }
}

console.log('\n=== MOVED SYMBOLS (the P1 floor, at its ratified home) ===');
for (const { spec, name, from } of MOVED_SYMBOLS) {
  const r = probe(spec);
  const label = spec === '.' ? '@ai-substrate/dd' : `…/${spec}`;
  if (r.ok && r.exports.includes(name)) {
    console.log(`reachable  ${name.padEnd(16)} at ${label.padEnd(22)} (was ${from})`);
  } else {
    failures.push(`${name} is not reachable at ${label} — it was in ${from}`);
    console.log(`MISSING    ${name.padEnd(16)} at ${label.padEnd(22)} ${r.ok ? '(subpath resolves, symbol absent)' : `(${r.code})`}`);
  }
}

console.log('\n=== RULED OUT (must STAY forbidden) ===');
for (const { spec, why } of RULED_OUT) {
  const r = probe(spec);
  if (r.ok) {
    failures.push(`${spec} became reachable — ${why}`);
    console.log(`LEAKED     ${spec.padEnd(18)} now reachable. ${why}`);
  } else {
    console.log(`forbidden  ${spec.padEnd(18)} ${r.code}  — ${why}`);
  }
}

if (failures.length) {
  console.log(`\n${failures.length} FAILURE(S):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('\nAll reachability expectations hold.');
