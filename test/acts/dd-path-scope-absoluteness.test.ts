import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FakeClock } from '../../src/adapters/clock/fake-clock.js';
import { buildProgram } from '../../src/app.js';
import type { Envelope } from '../../src/output/envelope.js';
import type { CliIo, Writers } from '../../src/output/output-port.js';
import { toPosix } from '../../src/shared/posix-path.js';

/**
 * S-1 · F2 — absoluteness detection, at the two ACT sites.
 *
 * `ddocs doctor --path` and `ddocs graph --path` carried two IDENTICAL hand-rolled
 * copies of `resolveScope`: `path.startsWith('/') ? path : ${repoRoot}/${path}`.
 * A Windows drive-letter path never starts with `/`, so it was read as RELATIVE
 * and glued onto the repo root — measured before the fix:
 *
 *   resolveScope('C:\\repo\\docs', '/repo') -> '/repo/C:\\repo\\docs'
 *   resolveScope('C:/repo/docs',  '/repo') -> '/repo/C:/repo/docs'
 *
 * a directory that cannot exist, so the sweep/graph silently scoped to nothing.
 * Fixed by DELETING both copies in favour of the existing `resolveInRepo` —
 * removing a duplicated grammar rather than adding a third.
 *
 * NOT a separator bug, and the forward-slash row is what proves it: the old
 * check accepted forward slashes just as badly as backslashes. What it could
 * not see was drive-letter ABSOLUTENESS.
 *
 * The lowercase-drive row is mandatory (S-1 carried constraint): `toPosix`
 * upper-cases a drive letter and `core/address.ts`'s `normalizeFilePath` does
 * not, so which spelling reaches an identity comparison depends on which
 * normaliser ran first. This row pins the act half of that; the core half is
 * pinned in `test/services/dd/core/path-identity.test.ts`.
 *
 * Drive-letter and backslash inputs are just strings — every row below fails on
 * a POSIX host with the fix reverted, so no Windows host is needed.
 */

function deps() {
  return { clock: new FakeClock('2026-08-03T00:00:00.000Z') };
}

/** Drive the REAL acts, exactly as `dd-links-live.test.ts` does. */
async function runDd(argv: string[]): Promise<{ envelope: Envelope; code: number }> {
  let out = '';
  let code = -1;
  const writers: Writers = {
    out: (text) => {
      out += text;
    },
    err: () => {},
  };
  const io: CliIo = { mode: 'json', writers };
  vi.spyOn(process, 'exit').mockImplementation(((value?: number) => {
    code = value ?? 0;
    throw new Error(`exit:${code}`);
  }) as never);
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  try {
    await buildProgram(io, deps()).parseAsync([
      'node',
      'dd',
      ...(argv[0] === 'dd' ? argv.slice(1) : argv),
    ]);
    code = process.exitCode ?? 0;
  } catch (error) {
    if (!/^exit:\d+$/.test(error instanceof Error ? error.message : '')) throw error;
  } finally {
    process.exitCode = previousExitCode;
    vi.restoreAllMocks();
  }
  return { envelope: JSON.parse(out.trim()) as Envelope, code };
}

/** Both verbs report the resolved scope as `data.root` — the observable under test. */
async function scopeOf(verb: string, path: string): Promise<{ root: string; code: number }> {
  const run = await runDd(['dd', verb, '--path', path]);
  return { root: (run.envelope.data as { root: string }).root, code: run.code };
}

let repo = '';
let repoRoot = '';
let previousCwd = '';

beforeAll(() => {
  previousCwd = process.cwd();
  repo = mkdtempSync(join(tmpdir(), 'dd-path-scope-'));
  mkdirSync(join(repo, 'docs'), { recursive: true });
  process.chdir(repo);
  // AFTER the chdir: on macOS the temp dir is reached through a symlink, so the
  // repo root the act computes is `cwd()`, not the path `mkdtempSync` returned.
  repoRoot = toPosix(process.cwd());
});

afterAll(() => {
  process.chdir(previousCwd);
  rmSync(repo, { recursive: true, force: true });
});

describe('ddocs doctor / ddocs graph --path — S-1 F2 absoluteness detection', () => {
  it.each([
    ['doctor', 'C:\\repo\\docs'],
    ['graph', 'C:\\repo\\docs'],
    ['doctor', 'C:/repo/docs'],
    ['graph', 'C:/repo/docs'],
    ['doctor', 'c:/repo/docs'],
    ['graph', 'c:/repo/docs'],
  ])(
    'dd %s --path %s passes the drive-letter root through instead of re-anchoring it',
    async (verb, path) => {
      const { root, code } = await scopeOf(verb, path);
      // One logical scope for all three spellings: this is about recognising a
      // drive-letter root as absolute, not about slash direction or drive case.
      expect(root).toBe('C:/repo/docs');
      expect(root.startsWith(repoRoot)).toBe(false);
      expect(code).toBe(0);
    },
  );

  it.each(['doctor', 'graph'])(
    'dd %s --path <posix-absolute> still passes through unchanged (regression)',
    async (verb) => {
      const { root, code } = await scopeOf(verb, `${repoRoot}/docs`);
      expect(root).toBe(`${repoRoot}/docs`);
      expect(code).toBe(0);
    },
  );

  it.each(['doctor', 'graph'])(
    'dd %s --path <relative> still re-anchors under the repo root (regression)',
    async (verb) => {
      const { root, code } = await scopeOf(verb, 'docs');
      expect(root).toBe(`${repoRoot}/docs`);
      expect(code).toBe(0);
    },
  );
});
