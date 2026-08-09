import { describe, expect, it } from 'vitest';
import { type RollbackFs, restoreSource } from '../../src/acts/build.js';

/**
 * wl-0026 — the ROLLBACK write is staged, like the forward writes already are.
 *
 * `writeDocumentWithSibling` promises either-both-or-neither, and stages both
 * forward writes (`.tmp` then `rename`) to keep that promise across a crash. The
 * recovery path used a plain `writeText`, which is not atomic — so a crash partway
 * through a ROLLBACK left the live source neither previous nor mutated. A third
 * state, in the one routine whose entire job is to guarantee there are only two.
 *
 * ⚠️ THE CRASH ITSELF IS NOT SIMULATED, AND THIS TEST DOES NOT CLAIM IT IS.
 * A process cannot be killed mid-`rename` to order from inside vitest. What is
 * asserted is the MECHANISM: that the rollback writes to a staged path and
 * renames it into place, which is structural equivalence with the forward path
 * whose crash-safety is the thing already relied upon. **A crash-safety fix
 * claiming a tested crash would be the same defect it is fixing, in its own
 * test** — so the claim is deliberately the narrower, true one.
 */

type Call = { op: string; args: string[] };

function recorder(overrides: { readBack?: string; failOn?: string } = {}): {
  fs: RollbackFs;
  calls: Call[];
} {
  const calls: Call[] = [];
  const guard = (op: string, first: string) => {
    if (overrides.failOn === op) throw new Error(`${op} refused`);
    calls.push({ op, args: [first] });
  };
  const fs: RollbackFs = {
    writeText: (path: string, text: string) => {
      guard('writeText', path);
      void text;
    },
    rename: (from: string, to: string) => {
      if (overrides.failOn === 'rename') throw new Error('rename refused');
      calls.push({ op: 'rename', args: [from, to] });
    },
    readText: (path: string) => {
      calls.push({ op: 'readText', args: [path] });
      return overrides.readBack ?? 'PREVIOUS';
    },
    deleteFile: (path: string) => {
      calls.push({ op: 'deleteFile', args: [path] });
    },
  } as RollbackFs;
  return { fs, calls };
}

const LIVE = '/repo/docs/plan.dd.json';

describe('wl-0026 — the rollback is staged, not written in place', () => {
  it('writes to a STAGED path and renames it over the live file', () => {
    const { fs, calls } = recorder();
    expect(restoreSource(fs, LIVE, 'PREVIOUS')).toBe(true);

    const write = calls.find((c) => c.op === 'writeText');
    const rename = calls.find((c) => c.op === 'rename');

    // The live file is never the target of the write itself — that is the defect.
    expect(write?.args[0]).not.toBe(LIVE);
    expect(write?.args[0]).toMatch(/\.tmp$/);
    // …and the staged file is what gets renamed INTO the live path.
    expect(rename?.args).toEqual([write?.args[0], LIVE]);
    // Order matters: staged write, then rename, then the read-back.
    expect(calls.map((c) => c.op)).toEqual(['writeText', 'rename', 'readText']);
  });

  it('does not contend with the FORWARD write for the same temp name', () => {
    // The forward path stages at `<path>.tmp`. A rollback that reused it could
    // collide with a staged write that failed and has not been cleaned up.
    const { fs, calls } = recorder();
    restoreSource(fs, LIVE, 'PREVIOUS');
    expect(calls.find((c) => c.op === 'writeText')?.args[0]).not.toBe(`${LIVE}.tmp`);
  });

  it('drops the staged scrap when the rollback fails, and reports false', () => {
    const { fs, calls } = recorder({ failOn: 'rename' });
    expect(restoreSource(fs, LIVE, 'PREVIOUS')).toBe(false);
    expect(calls.some((c) => c.op === 'deleteFile')).toBe(true);
  });

  it('CONTROL — still reports false when the bytes do not read back', () => {
    // The read-back is a SEPARATE guarantee from atomicity and must survive the
    // change. koala reported this half as missing; it was already here.
    const { fs } = recorder({ readBack: 'SOMETHING ELSE' });
    expect(restoreSource(fs, LIVE, 'PREVIOUS')).toBe(false);
  });
});
