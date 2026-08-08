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
// Answers the question a barrel-file reading cannot: can a CONSUMER import this
// subpath? An exports map does not merely fail to list a path, it FORBIDS it
// (ERR_PACKAGE_PATH_NOT_EXPORTED), so "the module exports it" and "a consumer can
// import it" are different facts. Method suggested by pij-related-koala.
//
// Every result is paired with a POSITIVE CONTROL: a probe that reports "all
// forbidden" proves nothing if the probe itself is broken.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
  { spec: 'plan', why: 'R-2: plan/ does not ship; harness re-implements on primitives' },
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
  // Extra symbols are NOT a failure — they are an API review that did not happen.
  // Reported loudly rather than enforced, because the allowlist is a decision
  // record and this script is not the place to overrule it.
  if (extra.length) {
    console.log(`NOTE  root barrel exports ${extra.length} symbol(s) beyond the D-1 allowlist: ${extra.join(', ')}`);
    console.log('      Every addition to the root is an API review. If that review happened, update this list.');
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
