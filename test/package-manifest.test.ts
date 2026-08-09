import { execFileSync } from 'node:child_process';
import {
  accessSync,
  constants,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { repoRoot } from './support/run-cli.js';

/**
 * The package manifest, asserted rather than assumed (plan 001 tk-0004, ac-0007).
 *
 * Everything here is a fact about the ARTIFACT a consumer receives, which unit
 * tests structurally cannot see: they import from `src/`, so they stay green
 * against a `files` map that ships nothing. These rows read the manifest and the
 * real `npm pack` output instead.
 *
 * What is deliberately NOT asserted here: the `exports` map. It is FROZEN in a
 * separate task (tk-0002) that is HELD pending an unruled decision, and writing
 * even a partial expectation of its shape here would decide by accident what is
 * being deliberately left open.
 */

interface PackedFile {
  path: string;
}
interface PackResult {
  name: string;
  version: string;
  files: PackedFile[];
}

const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

/**
 * Entries a pack never reads, and copying them would cost seconds: npm's own
 * install tree, the git directory (a FILE in a worktree), and the coverage
 * output. Everything else is copied so the ignore rules are exercised over the
 * same tree the repo actually has.
 */
const NOT_COPIED = new Set(['node_modules', '.git', 'coverage']);

let packRoot: string | undefined;
let packed: PackResult | undefined;

/**
 * `npm pack --dry-run`, run against a THROWAWAY COPY of the repo — never
 * against the repo itself.
 *
 * `--ignore-scripts` alone is NOT enough here, and the previous comment's claim
 * that it was cost a CI investigation. npm 10.9.2 — the npm bundled with node
 * 22, which is this package's `engines` floor and a CI matrix leg — runs
 * `prepare` on `npm pack --dry-run` ANYWAY; npm 11 (node 24) honours the flag.
 * Measured both ways: under node 22's npm the live `dist/` mtime moves, under
 * node 24's it does not. `prepare` is `npm run build`, and `tsc` overwrites
 * `dist/` IN PLACE, so on node 22 these rows rebuilt the shipped output four
 * times per suite run while sibling tests were spawning the bin out of that
 * same directory — a window in which a module is half-written and a spawn fails
 * for a reason no assertion here is about.
 *
 * Packing from a copy removes the race by construction rather than by flag:
 * npm's cwd is the copy, so whatever lifecycle scripts npm decides to run write
 * THERE. `prepack`/`prepare` are stripped from the copied manifest as well, so
 * the copy needs no `node_modules` and the pack cannot shell `tsc` at all;
 * `--ignore-scripts` stays as the second layer, no longer as the only one.
 *
 * What is still proven: the file LIST, from the real `npm pack`, over a tree
 * carrying the same `files` field and the same ignore rules. That `prepack`
 * actually builds is proven where it matters — from a clean clone, in
 * `scripts/pack-gate.sh`.
 *
 * The result is packed ONCE and shared: all four rows below assert facts about
 * the same artifact, and four identical spawns proved nothing four times.
 */
function packDryRun(): PackResult {
  if (packed) return packed;

  packRoot = mkdtempSync(join(tmpdir(), 'dd-pack-manifest-'));
  const tree = join(packRoot, 'repo');
  cpSync(repoRoot, tree, {
    recursive: true,
    filter: (source) => {
      const path = relative(repoRoot, source);
      if (path === '') return true;
      return !NOT_COPIED.has(path.split(sep)[0]) && !path.endsWith('.tgz');
    },
  });

  const copiedManifest = JSON.parse(readFileSync(join(tree, 'package.json'), 'utf8'));
  copiedManifest.scripts = Object.fromEntries(
    Object.entries(copiedManifest.scripts as Record<string, string>).filter(
      ([name]) => name !== 'prepack' && name !== 'prepare',
    ),
  );
  writeFileSync(join(tree, 'package.json'), `${JSON.stringify(copiedManifest, null, 2)}\n`);

  // The copy carries whatever `dist/` the repo has. If there is none, these rows
  // are about an artifact that was never built — say so, rather than letting it
  // surface as a missing-path assertion that reads like a packaging defect.
  if (!existsSync(join(tree, 'dist', 'index.js'))) {
    throw new Error(
      'dist/ is not built, so there is no artifact to pack — run `npm run build` first ' +
        '(these rows deliberately do NOT build it: that is what caused the mid-suite rebuild race)',
    );
  }

  const raw = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: tree,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  packed = (JSON.parse(raw) as PackResult[])[0];
  return packed;
}

afterAll(() => {
  if (packRoot) rmSync(packRoot, { recursive: true, force: true });
});

describe('package manifest', () => {
  it('keeps package.json and the release-please manifest on the same version', () => {
    const released = JSON.parse(
      readFileSync(join(repoRoot, '.release-please-manifest.json'), 'utf8'),
    );
    // release-please bumps BOTH; a mismatch means a hand-edit got in between and
    // the next release would be cut from the wrong number.
    expect(manifest.version).toBe(released['.']);
  });

  it('declares the release-please root package this repo actually is', () => {
    const config = JSON.parse(readFileSync(join(repoRoot, 'release-please-config.json'), 'utf8'));
    expect(config['release-type']).toBe('node');
    expect(Object.keys(config.packages)).toEqual(['.']);
  });

  it('ships exactly bin + dist + LICENSE', () => {
    expect(manifest.files).toEqual(['bin', 'dist', 'LICENSE']);
  });

  it('builds dist on pack, so a clean clone self-builds', () => {
    // Without this, `npm pack` from a fresh clone produces a tarball whose
    // `dist/` is whatever happened to be lying around — usually nothing.
    expect(manifest.scripts.prepack).toBe('npm run build');
  });

  it('points bin at a committed, executable wrapper', () => {
    expect(manifest.bin).toEqual({ dd: './bin/dd.js' });
    const binPath = join(repoRoot, 'bin', 'dd.js');
    expect(readFileSync(binPath, 'utf8').startsWith('#!/usr/bin/env node')).toBe(true);
    // The execute bit is part of the artifact: npm preserves it from the mode
    // git has recorded, and a 644 wrapper installs as an unrunnable `dd`.
    expect(() => accessSync(binPath, constants.X_OK)).not.toThrow();
    expect(statSync(binPath).mode & 0o111).not.toBe(0);
  });

  it('declares only the two runtime dependencies the port is allowed', () => {
    expect(Object.keys(manifest.dependencies).sort()).toEqual(['commander', 'jiti']);
  });
});

describe('the packed tarball', () => {
  it('carries the bin, the build output and the licence, and nothing else', {
    timeout: 60_000,
  }, () => {
    const packed = packDryRun();
    const roots = [...new Set(packed.files.map((file) => file.path.split('/')[0]))].sort();
    // `package.json` and `LICENSE` are included by npm regardless of `files`;
    // README joins them once it exists. Anything OUTSIDE this set is leakage.
    const allowed = new Set(['LICENSE', 'README.md', 'bin', 'dist', 'package.json']);
    expect(roots.filter((root) => !allowed.has(root))).toEqual([]);
    expect(roots).toContain('bin');
    expect(roots).toContain('dist');
    expect(roots).toContain('LICENSE');
  });

  it('leaks no sources, tests, fixtures or repo furniture', { timeout: 60_000 }, () => {
    const packed = packDryRun();
    const forbidden = packed.files
      .map((file) => file.path)
      .filter((path) =>
        /^(src|test|scripts|docs|\.dd|\.github|\.harness|\.agents|\.flow-pair)\//.test(path),
      );
    expect(forbidden).toEqual([]);
  });

  it('packs the entry point and the bin a consumer resolves', { timeout: 60_000 }, () => {
    const paths = new Set(packDryRun().files.map((file) => file.path));
    expect(paths.has('bin/dd.js')).toBe(true);
    expect(paths.has('dist/index.js')).toBe(true);
    expect(paths.has('dist/index.d.ts')).toBe(true);
  });

  it('publishes under the scoped name, to the public registry', { timeout: 60_000 }, () => {
    expect(packDryRun().name).toBe('@ai-substrate/dd');
    expect(manifest.publishConfig).toEqual({
      registry: 'https://registry.npmjs.org',
      access: 'public',
    });
  });
});
