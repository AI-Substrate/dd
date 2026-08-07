#!/usr/bin/env node
// Runtime reachability probe for @ai-substrate/dd's exports map.
//
// RUN IT:  node scripts/exports-reachability-probe.mjs
// (from a scratch dir with node_modules/@ai-substrate/dd symlinked to this repo —
//  see the header of docs/plans/001-dd-extraction/execution-log.dd.md lg-0006.)
//
// NOT wired into `just checks` yet — that is a deliberate hold, not an oversight:
// wiring a new gate requires the matching ci.yml step (test/ci-parity.test.ts reds
// otherwise), and it should not land while a CI run is in flight.
// Answers the question a barrel-file reading cannot: can a CONSUMER import this
// subpath? An exports map does not merely fail to list a path, it FORBIDS it
// (ERR_PACKAGE_PATH_NOT_EXPORTED), so "the module exports it" and "a consumer can
// import it" are different facts. Method suggested by pij-related-koala.
//
// Every result is paired with a POSITIVE CONTROL: a probe that reports "all
// forbidden" proves nothing if the probe itself is broken.

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

async function probe(sub) {
  const spec = sub === '.' ? '@ai-substrate/dd' : `@ai-substrate/dd/${sub}`;
  try {
    const m = await import(spec);
    const names = Object.keys(m).filter((k) => k !== 'default');
    return { ok: true, names: names.length, sample: names.slice(0, 3) };
  } catch (e) {
    return { ok: false, code: e.code ?? 'UNKNOWN', msg: String(e.message).split('\n')[0].slice(0, 90) };
  }
}

console.log('=== CONTROLS (probe validity) ===');
let controlsPassed = true;
for (const c of CONTROLS) {
  const r = await probe(c.spec);
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
  const r = await probe(sub);
  if (r.ok) {
    console.log(`reachable  ${sub.padEnd(18)} ${r.names} named exports  [${r.sample.join(', ')}...]`);
  } else {
    forbidden.push(sub);
    console.log(`FORBIDDEN  ${sub.padEnd(18)} ${r.code}`);
  }
}
console.log(`\n${CONSUMED.length - forbidden.length}/${CONSUMED.length} reachable`);
if (forbidden.length) console.log(`UNREACHABLE BY A CONSUMER: ${forbidden.join(', ')}`);
