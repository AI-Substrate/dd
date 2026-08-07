import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const bin = join(repoRoot, 'bin', 'dd.js');

export interface CliRun {
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * The REAL envelope type, re-exported rather than re-described. A local copy
 * drifted immediately: it omitted `error.details`, which ported tests assert on.
 */
export type { Envelope } from '../../src/output/envelope.js';

import type { Envelope } from '../../src/output/envelope.js';

/** Build the bin once per suite if a previous step has not already. */
export function ensureBuilt(): void {
  if (!existsSync(join(repoRoot, 'dist', 'index.js'))) {
    execFileSync('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'inherit' });
  }
}

/**
 * Spawn the SHIPPED bin the way a consumer or CI would. `DD_JSON` is stripped so
 * a developer's exported preference can never decide what these assertions see.
 */
export function runDd(args: string[], options: { cwd?: string } = {}): CliRun {
  const env = { ...process.env };
  delete env.DD_JSON;
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    env,
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** The envelope is the LAST stdout line, so any preamble cannot confuse it. */
export function parseEnvelope(stdout: string): Envelope {
  const line = stdout.trim().split('\n').at(-1) ?? '';
  return JSON.parse(line) as Envelope;
}

/** Status → exit code, per the repo contract: ok/degraded 0, unconfigured 2, error 1. */
export const EXIT_BY_STATUS: Record<Envelope['status'], number> = {
  ok: 0,
  degraded: 0,
  unconfigured: 2,
  error: 1,
};

/**
 * ---------------------------------------------------------------------------
 * In-process driver, for the PORTED upstream act tests.
 * ---------------------------------------------------------------------------
 *
 * Upstream's `test/support/run-cli.ts` builds the program in-process and drives
 * it with a full `VerbActDeps` (exec/fs/env/git/clock/proc), because there every
 * act shares one dependency container. Here the dd acts are composition roots in
 * their own right — they construct their own `NodeProcess`/`NodeSchemaFs` — so
 * the only injected dependency that matters is the clock.
 *
 * The other adaptation is argv. Upstream the verbs live under a `dd`
 * sub-command, so its tests spell them `runCli(['dd', 'validate', …])`. Here the
 * binary IS `dd` and the verbs are top level, so a leading `dd` token is dropped.
 * Doing it HERE keeps every ported test body byte-verbatim, instead of editing
 * that token at hundreds of call sites.
 */
export async function runCli(argv: string[], mode: 'json' | 'human' = 'json'): Promise<CliRun2> {
  const { buildProgram } = await import('../../src/app.js');
  const { FakeClock } = await import('../../src/adapters/clock/fake-clock.js');
  const { vi } = await import('vitest');

  // `['dd', 'validate', …]` upstream is `['validate', …]` here.
  const args = argv[0] === 'dd' ? argv.slice(1) : argv;

  let out = '';
  let err = '';
  let code = -1;
  const writers = {
    out: (text: string) => {
      out += text;
    },
    err: (text: string) => {
      err += text;
    },
  };
  const io = { mode, writers };
  vi.spyOn(process, 'exit').mockImplementation(((value?: number) => {
    code = value ?? 0;
    throw new Error(`exit:${code}`);
  }) as never);
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  try {
    await buildProgram(io, { clock: new FakeClock('2026-08-04T00:00:00.000Z') }).parseAsync([
      'node',
      'dd',
      ...args,
    ]);
    code = process.exitCode ?? 0;
  } catch (error) {
    if (!/^exit:\d+$/.test(error instanceof Error ? error.message : '')) throw error;
  } finally {
    process.exitCode = previousExitCode;
    vi.restoreAllMocks();
  }
  return {
    out,
    err,
    code,
    envelope:
      mode === 'json' && out.trim().length > 0 ? (JSON.parse(out.trim()) as Envelope) : null,
  };
}

export interface CliRun2 {
  out: string;
  err: string;
  code: number;
  envelope: Envelope | null;
}
