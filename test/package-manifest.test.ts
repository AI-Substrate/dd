import { execFileSync } from 'node:child_process';
import { accessSync, constants, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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
 * `npm pack --dry-run` with scripts ignored: the file LIST is what these rows
 * assert, and running `prepack` here would rebuild `dist/` on every test run for
 * no extra proof. That `prepack` actually builds is proven where it matters —
 * from a clean clone, in `scripts/pack-gate.sh`.
 */
function packDryRun(): PackResult {
  const raw = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return (JSON.parse(raw) as PackResult[])[0];
}

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
