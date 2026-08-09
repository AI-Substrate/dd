import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const bin = join(repoRoot, 'bin', 'dd.js');

export interface CliRun {
  /** The argv the bin was given — a red that cannot say WHICH run failed is half a red. */
  argv: readonly string[];
  code: number | null;
  signal: NodeJS.Signals | null;
  /** `spawnSync` reports a failure to START (EAGAIN, ENOMEM) here, NOT in `code`. */
  spawnError: Error | undefined;
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
 *
 * EVERY FIELD THE SPAWN REPORTS IS KEPT. This returned `{code, stdout, stderr}`
 * and `parseEnvelope` took a bare string, so a run that produced nothing
 * parseable failed as `SyntaxError: Unexpected end of JSON input` and NOTHING
 * else — a red that cannot distinguish a crash from a signal from a spawn that
 * never happened from output truncated in flight. That is not hypothetical: it
 * cost a full CI investigation on the node-22 leg, where the log could name the
 * assertion but not the cause. 24 call sites across 7 files share this helper,
 * so the blindness was shared too.
 */
export function runDd(args: string[], options: { cwd?: string } = {}): CliRun {
  const env = { ...process.env };
  delete env.DD_JSON;
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    env,
  });
  return {
    argv: args,
    code: result.status,
    signal: result.signal,
    spawnError: result.error,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * Name the shape of a run that produced no envelope, when the shape is known.
 *
 * A clean exit with no error whose last line is a PARTIAL JSON object is the
 * signature of TRUNCATION and of nothing else: the command believed it
 * succeeded, so the bytes were lost after it stopped caring. Saying so in the
 * failure message is the difference between a fixed bug and a re-run.
 *
 * The partial-JSON test is what keeps that claim honest. Output that never
 * looked like an envelope — a human-mode summary, a stack trace — is a
 * different fault entirely, and a diagnosis that called it truncation would be
 * this helper committing the same sin it exists to expose: a confident wrong
 * answer where the truth was "I cannot tell".
 */
function diagnose(run: CliRun, line: string): string {
  if (run.spawnError !== undefined) return 'the bin never ran — spawn itself failed';
  if (run.signal !== null) return `the bin was killed by ${run.signal}`;
  if (run.stdout.trim() === '') {
    return run.code === 0
      ? 'the bin exited 0 and wrote NOTHING to stdout'
      : 'the bin wrote nothing to stdout and exited non-zero — read stderr';
  }
  if (line.startsWith('{')) {
    return run.code === 0
      ? 'exit 0, no error, partial JSON — the TRUNCATION signature (output lost after the command succeeded)'
      : 'partial JSON and a non-zero exit — the bin died mid-write';
  }
  return 'stdout is not JSON at all — was this run in human mode, or is something else writing to stdout?';
}

/** Everything known about a spawn, on one line a CI log can be read from. */
export function describeRun(run: CliRun): string {
  const spawnError =
    run.spawnError === undefined
      ? 'none'
      : `${(run.spawnError as NodeJS.ErrnoException).code ?? 'Error'}: ${run.spawnError.message}`;
  return [
    `dd ${run.argv.join(' ')}`,
    `exit=${run.code}`,
    `signal=${run.signal ?? 'none'}`,
    `spawnError=${spawnError}`,
    `stdoutBytes=${Buffer.byteLength(run.stdout)}`,
    `stderrBytes=${Buffer.byteLength(run.stderr)}`,
    `stdout=${JSON.stringify(run.stdout.slice(0, 400))}`,
    `stderr=${JSON.stringify(run.stderr.slice(0, 400))}`,
  ].join(' | ');
}

/**
 * The envelope is the LAST stdout line, so any preamble cannot confuse it.
 *
 * Pass the RUN, not `run.stdout`: a bare string cannot say why it is empty, and
 * every accepted-string call site is one that will waste an investigation the
 * day it fails. The string overload exists only for output this helper did not
 * produce.
 */
export function parseEnvelope(source: CliRun | string): Envelope {
  const stdout = typeof source === 'string' ? source : source.stdout;
  const line = stdout.trim().split('\n').at(-1) ?? '';
  try {
    return JSON.parse(line) as Envelope;
  } catch (cause) {
    const detail =
      typeof source === 'string'
        ? `stdoutBytes=${Buffer.byteLength(stdout)} | stdout=${JSON.stringify(stdout.slice(0, 400))} | (caller passed a bare string, so exit code, signal and stderr are unknown here)`
        : `${diagnose(source, line)} — ${describeRun(source)}`;
    throw new Error(`dd emitted no parseable envelope: ${detail}`, { cause });
  }
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
