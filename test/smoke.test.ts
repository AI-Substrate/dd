import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(repoRoot, 'bin', 'dd.js');

type DdRun = {
  readonly argv: readonly string[];
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly spawnError: Error | undefined;
  readonly stdout: string;
  readonly stderr: string;
};

/**
 * The real seam test: spawn the SHIPPED bin the way a consumer or CI would, and
 * assert the envelope contract and the status→exit-code mapping end to end.
 * Ported dd verbs slot in behind this same guarantee.
 *
 * EVERYTHING THE SPAWN REPORTS IS KEPT, deliberately. This helper used to return
 * `{code, stdout, stderr}` and the envelope parser took a bare string, so a run
 * that produced no parseable output failed as `SyntaxError: Unexpected end of
 * JSON input` and nothing else — a red that cannot say whether the bin crashed,
 * was killed by a signal, never spawned at all (`spawnSync` reports EAGAIN in
 * `error`, not in the exit code), or wrote output that was truncated in flight.
 * That happened for real in CI on the node-22 leg and the log could not
 * attribute it. Exit code, signal, spawn error and BOTH streams now travel with
 * the run and are printed on any parse failure, so the next instance names its
 * own cause instead of costing an investigation.
 */
function runDd(args: string[]): DdRun {
  // Explicit delete rather than `DD_JSON: undefined`: an env object holding an
  // `undefined` value is handled differently across Node versions, and the mode
  // this test measures is exactly the one env can override.
  const env = { ...process.env };
  delete env.DD_JSON;
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: repoRoot,
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

/** Everything known about a spawn, in one line a CI log can be read from. */
function describeRun(run: DdRun): string {
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

function parseEnvelope(run: DdRun) {
  const line = run.stdout.trim().split('\n').at(-1) ?? '';
  try {
    return JSON.parse(line) as {
      command: string;
      status: string;
      timestamp: string;
      data?: unknown;
      error?: { code: string; message: string };
      next_action?: string;
    };
  } catch (cause) {
    throw new Error(`dd emitted no parseable envelope — ${describeRun(run)}`, { cause });
  }
}

describe('dd bin smoke', () => {
  beforeAll(() => {
    if (!existsSync(join(repoRoot, 'dist', 'index.js'))) {
      execFileSync('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'inherit' });
    }
  });

  it('--version prints the bare version and exits 0', () => {
    const run = runDd(['--version']);
    expect(run.code, describeRun(run)).toBe(0);
    expect(run.stdout.trim(), describeRun(run)).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('--help lists the verbs and exits 0', () => {
    const run = runDd(['--help']);
    expect(run.code, describeRun(run)).toBe(0);
    expect(run.stdout, describeRun(run)).toContain('Usage: dd');
    expect(run.stdout, describeRun(run)).toContain('status');
  });

  it('a successful verb emits an ok envelope and exits 0', () => {
    const run = runDd(['version']);
    expect(run.code, describeRun(run)).toBe(0);
    const env = parseEnvelope(run);
    expect(env).toMatchObject({ command: 'version', status: 'ok' });
    expect(env.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('piped output auto-selects JSON without an explicit --json', () => {
    // spawnSync pipes stdout, so this run had no TTY and no DD_JSON set.
    // Parsed rather than `.not.toThrow()`: a bare throw-assertion reports only
    // the SyntaxError, discarding the exit code, signal and stderr that say WHY
    // there was nothing to parse. `parseEnvelope` carries them into the message.
    const run = runDd(['status']);
    const env = parseEnvelope(run);
    expect(env, describeRun(run)).toMatchObject({ command: 'status' });
  });

  it('--no-json forces the human renderer even when piped', () => {
    const run = runDd(['--no-json', 'status']);
    expect(run.code, describeRun(run)).toBe(0);
    expect(run.stdout.trim().split('\n').at(0), describeRun(run)).toBe('status: ok');
  });

  it('reports a complete port: every planned verb registered, exit 0', () => {
    // Phase 2 landed all ten verbs, so the ledger reads `ok`. It stays honest by
    // construction — `data.ported` is derived from the registered commands, so
    // this flips straight back to `unconfigured`/2 if a registration is lost.
    const run = runDd(['--json', 'status']);
    expect(run.code, describeRun(run)).toBe(0);
    const env = parseEnvelope(run);
    expect(env.status).toBe('ok');
    expect(env.next_action).toBeUndefined();
    expect((env.data as { remaining: string[]; ported: string[] }).remaining).toEqual([]);
    expect((env.data as { ported: string[] }).ported).toHaveLength(10);
  });

  it('an unknown command emits an error envelope and exits 1', () => {
    const run = runDd(['--json', 'no-such-verb']);
    expect(run.code, describeRun(run)).toBe(1);
    const env = parseEnvelope(run);
    expect(env.status).toBe('error');
    expect(env.error?.code).toBe('E001');
    expect(env.next_action).toBeTruthy();
  });
});
