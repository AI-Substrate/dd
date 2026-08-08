#!/usr/bin/env node
/**
 * trial-fixture-run — the §5.1 acceptance gate: dd proven as an INSTALLED package.
 *
 * WHAT THIS PROVES THAT NOTHING ELSE DOES. Every other gate in this repo reasons
 * about `src/` or about `dist/` reached by self-name resolution. Both are blind
 * to the question a consumer actually asks: *after `npm install @ai-substrate/dd`,
 * can I import these symbols and do they work?* Between "the code is right" and
 * "a consumer can use it" sit the `exports` map, the `files` allowlist, the
 * `prepack` build, the runtime dependencies and Node's own resolver — and a unit
 * test cannot redden on any of them.
 *
 * So this gate takes a real tarball, installs it into a throwaway project with a
 * real `npm install <tgz>` (never a `file:` link, never a workspace — a link
 * would resolve back into this checkout and quietly prove nothing), copies the
 * fixture and a committed dd corpus in beside it, compiles the fixture in Node's
 * OWN `NodeNext` resolution mode, and runs it.
 *
 * TWO RESOLUTION MODES, DELIBERATELY. `just typecheck` compiles the same fixture
 * in-repo under `Bundler` resolution against local `dist/`. That is the fast
 * inner-loop half. This gate compiles it under `NodeNext` against installed
 * `node_modules` — the strictest, most consumer-accurate model, and the only one
 * that can fail on a condition the tarball got wrong.
 *
 * IT DOES NOT DUPLICATE THE PACK GATE. `scripts/pack-gate.sh` already clones HEAD
 * clean, packs, and installs into a consumer; when it calls this script it hands
 * over the tarball and that consumer, so the expensive half happens ONCE. Run
 * standalone, this script packs and installs for itself so it stays runnable on
 * its own — a gate you cannot run by hand is a gate nobody debugs.
 *
 * EVERY FAILURE NAMES ITS CLAUSE. That is the C-6 lesson made structural: a red
 * that does not say what failed teaches the reader to re-run it.
 *
 * Usage:
 *   node scripts/trial-fixture-run.mjs                          # pack + install for itself
 *   node scripts/trial-fixture-run.mjs --tarball X --consumer Y # reuse the pack gate's work
 *   node scripts/trial-fixture-run.mjs --keep                   # leave the temp tree behind
 *
 * Exit 0 = the published surface is consumable and behaves. Any other exit names
 * the clause that refused.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const flag = (name) => {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
};
const KEEP = argv.includes('--keep');
let tarball = flag('--tarball');
let consumer = flag('--consumer');

/** A clause refused. The name travels with the reason, always. */
function fail(clause, message) {
  console.error(`\ntrial-fixture-run FAILED [${clause}]`);
  console.error(`  ${message}`);
  process.exit(1);
}

function step(text) {
  process.stdout.write(`\n=== ${text}\n`);
}

function run(clause, command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: 'pipe', ...options });
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim();
    fail(clause, `\`${command} ${args.join(' ')}\` exited ${error.status}\n${output}`);
  }
}

// ---------------------------------------------------------------------------
// Workspace. Owned by whoever created it: a caller-supplied consumer is the
// caller's to clean up, so this script only removes what it made itself.
// ---------------------------------------------------------------------------
const OWN_WORK = consumer === undefined || tarball === undefined;
const work = OWN_WORK ? mkdtempSync(join(tmpdir(), 'dd-trial-fixture.')) : undefined;

process.on('exit', () => {
  if (work !== undefined && !KEEP) rmSync(work, { recursive: true, force: true, maxRetries: 3 });
  if (work !== undefined && KEEP) console.log(`--- kept: ${work}`);
});

// ---------------------------------------------------------------------------
step('T1.1  a real tarball');
// ---------------------------------------------------------------------------
if (tarball === undefined) {
  // `npm pack` runs `prepack`, which builds `dist/`. Standalone mode does not
  // re-clone: clean-clone discipline is `pack-gate.sh`'s proof and duplicating it
  // here would mean two gates asserting the same thing and drifting apart.
  const packed = run('T1.1 pack', 'npm', ['pack', '--json', '--silent'], { cwd: REPO_ROOT });
  const entry = JSON.parse(packed)[0];
  if (!entry?.filename?.endsWith('.tgz')) {
    fail('T1.1 pack', `npm pack did not name a tarball: ${packed.slice(0, 300)}`);
  }
  tarball = join(REPO_ROOT, entry.filename);
  // Packing into the repo root is npm's behaviour, not a choice; move it out so a
  // stray .tgz can never be committed or swept into somebody's staged set.
  const moved = join(work, entry.filename);
  cpSync(tarball, moved);
  rmSync(tarball, { force: true });
  tarball = moved;
}
if (!existsSync(tarball)) fail('T1.1 pack', `no tarball at ${tarball}`);
console.log(`    ${tarball}`);

// ---------------------------------------------------------------------------
step('T1.2  install it into a scratch consumer (real install, never a link)');
// ---------------------------------------------------------------------------
if (consumer === undefined) {
  consumer = join(work, 'consumer');
  mkdirSync(consumer, { recursive: true });
  run('T1.2 install', 'npm', ['init', '-y'], { cwd: consumer });
  // --omit=dev is the consumer's install: every dependency the SDK needs at
  // RUNTIME must resolve without this repo's devDependencies existing anywhere.
  run('T1.2 install', 'npm', ['install', '--silent', '--no-audit', '--no-fund', '--omit=dev', tarball], {
    cwd: consumer,
  });
}

const installed = join(consumer, 'node_modules/@ai-substrate/dd');
if (!existsSync(installed)) fail('T1.2 install', `the package did not install into ${installed}`);
// Repo-absence. If the consumer could reach this checkout, every clause below
// would be a statement about our source tree rather than about the tarball.
for (const leak of ['src', 'test', 'scripts']) {
  if (existsSync(join(installed, leak))) {
    fail('T1.2 install', `the installed package contains ${leak}/ — repo leakage`);
  }
}
console.log(`    installed at ${installed} (no src/, test/ or scripts/)`);

// ---------------------------------------------------------------------------
step('T2.1  stage the fixture and the committed corpus beside it');
// ---------------------------------------------------------------------------
const fixtureDir = join(consumer, 'trial');
mkdirSync(fixtureDir, { recursive: true });
cpSync(join(REPO_ROOT, 'test/trial-fixture/fixture.ts'), join(fixtureDir, 'fixture.ts'));
cpSync(join(REPO_ROOT, 'test/trial-fixture/fixtures/corpus'), join(fixtureDir, 'corpus'), {
  recursive: true,
});

// The consumer is ESM, like the package. Written rather than assumed: `npm init
// -y` produces a CommonJS package.json, and under NodeNext that changes what the
// fixture's own imports MEAN.
writeFileSync(
  join(fixtureDir, 'package.json'),
  `${JSON.stringify({ name: 'dd-trial-fixture', private: true, type: 'module' }, null, 2)}\n`,
);

/**
 * NodeNext, strict, verbatim — a real Node ESM consumer's compiler settings.
 *
 * `typeRoots` points back at this repo for `@types/node` and the compiler itself
 * is this repo's `tsc`. Both are TOOLS; neither participates in resolving
 * `@ai-substrate/dd`, which is what is under test and which resolves from the
 * consumer's own `node_modules` because that is where the importing file lives.
 * Installing a second TypeScript into the scratch project would cost a network
 * round-trip to prove nothing extra.
 */
writeFileSync(
  join(fixtureDir, 'tsconfig.json'),
  `${JSON.stringify(
    {
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        lib: ['ES2022'],
        strict: true,
        verbatimModuleSyntax: true,
        skipLibCheck: true,
        outDir: 'out',
        types: ['node'],
        typeRoots: [join(REPO_ROOT, 'node_modules/@types')],
      },
      include: ['fixture.ts'],
    },
    null,
    2,
  )}\n`,
);
console.log('    fixture.ts + corpus staged; consumer is ESM under NodeNext');

// ---------------------------------------------------------------------------
step('T2.2  compile the fixture in NODE\u2019s resolution mode');
// ---------------------------------------------------------------------------
// This is the import-list measurement (§5.1 clause 3). A subpath the `exports`
// map does not admit fails HERE, as TS2307, naming the specifier — which is the
// same failure a consumer would meet, reported before anything runs.
const tsc = join(REPO_ROOT, 'node_modules/typescript/bin/tsc');
if (!existsSync(tsc)) fail('T2.2 compile', `no tsc at ${tsc} — run \`npm ci\` first`);
run('T2.2 compile', process.execPath, [tsc, '-p', join(fixtureDir, 'tsconfig.json')]);
console.log('    compiled — every import resolved through the published exports map');

// ---------------------------------------------------------------------------
step('T2.3  RUN it against the corpus');
// ---------------------------------------------------------------------------
const compiled = join(fixtureDir, 'out/fixture.js');
if (!existsSync(compiled)) fail('T2.3 run', `tsc emitted nothing at ${compiled}`);
try {
  const output = execFileSync(process.execPath, [compiled, join(fixtureDir, 'corpus')], {
    encoding: 'utf8',
    cwd: fixtureDir,
    stdio: 'pipe',
  });
  process.stdout.write(output);
} catch (error) {
  process.stdout.write(`${error.stdout ?? ''}`);
  process.stderr.write(`${error.stderr ?? ''}`);
  fail('T2.3 run', `the fixture exited ${error.status} — the failing clause is named above`);
}

console.log('\ntrial-fixture-run PASSED — the published surface is consumable and behaves.');
