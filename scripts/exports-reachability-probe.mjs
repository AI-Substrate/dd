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

import { execFileSync } from 'node:child_process';
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
  'links', 'render/renderer', 'schema', 'schema/index', 'schema/model',
  'schema/resolve',
  'plan', // OQ-2: consumed by acts/plan/{index,pr-body}.ts, NOT in the map
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
    `process.stdout.write('OK '+n.length+' '+n.slice(0,3).join(','))})` +
    `.catch(e=>process.stdout.write('ERR '+(e.code??'UNKNOWN')))`;
  try {
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', src], {
      cwd: scratch, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const marker = out.lastIndexOf('OK ') >= 0 ? out.slice(out.lastIndexOf('OK ')) : out;
    if (marker.startsWith('OK ')) {
      const [, count, names = ''] = marker.split(' ');
      return { ok: true, names: Number(count), sample: names ? names.split(',') : [] };
    }
    const err = out.slice(out.lastIndexOf('ERR '));
    return { ok: false, code: err.replace('ERR ', '').trim() || 'UNKNOWN' };
  } catch {
    return { ok: false, code: 'SPAWN_FAILED' };
  }
}

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
console.log(controlsPassed
  ? '\nControls pass — probe is trustworthy; results below are real.\n'
  : '\n!! CONTROLS FAILED — every result below is meaningless. Fix the probe.\n');

console.log('=== CONSUMED SUBPATHS (from packet section 2.1) ===');
const forbidden = [];
for (const sub of CONSUMED) {
  const r = probe(sub);
  if (r.ok) {
    console.log(`reachable  ${sub.padEnd(18)} ${r.names} named exports  [${r.sample.join(', ')}...]`);
  } else {
    forbidden.push(sub);
    console.log(`FORBIDDEN  ${sub.padEnd(18)} ${r.code}`);
  }
}
console.log(`\n${CONSUMED.length - forbidden.length}/${CONSUMED.length} reachable`);
if (forbidden.length) console.log(`UNREACHABLE BY A CONSUMER: ${forbidden.join(', ')}`);
