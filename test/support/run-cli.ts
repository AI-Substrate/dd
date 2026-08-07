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

export interface Envelope {
  command: string;
  status: 'ok' | 'degraded' | 'unconfigured' | 'error';
  timestamp: string;
  data?: unknown;
  error?: { code: string; message: string };
  next_action?: string;
}

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
