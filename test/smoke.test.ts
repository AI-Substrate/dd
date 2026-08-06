import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(repoRoot, 'bin', 'dd.js');

/**
 * The real seam test: spawn the SHIPPED bin the way a consumer or CI would, and
 * assert the envelope contract and the status→exit-code mapping end to end.
 * Ported dd verbs slot in behind this same guarantee.
 */
function runDd(args: string[]) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, DD_JSON: undefined },
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

function parseEnvelope(stdout: string) {
  const line = stdout.trim().split('\n').at(-1) ?? '';
  return JSON.parse(line) as {
    command: string;
    status: string;
    timestamp: string;
    data?: unknown;
    error?: { code: string; message: string };
    next_action?: string;
  };
}

describe('dd bin smoke', () => {
  beforeAll(() => {
    if (!existsSync(join(repoRoot, 'dist', 'index.js'))) {
      execFileSync('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'inherit' });
    }
  });

  it('--version prints the bare version and exits 0', () => {
    const { code, stdout } = runDd(['--version']);
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('--help lists the verbs and exits 0', () => {
    const { code, stdout } = runDd(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('Usage: dd');
    expect(stdout).toContain('status');
  });

  it('a successful verb emits an ok envelope and exits 0', () => {
    const { code, stdout } = runDd(['version']);
    expect(code).toBe(0);
    const env = parseEnvelope(stdout);
    expect(env).toMatchObject({ command: 'version', status: 'ok' });
    expect(env.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('piped output auto-selects JSON without an explicit --json', () => {
    // spawnSync pipes stdout, so this run had no TTY and no DD_JSON set.
    expect(() => parseEnvelope(runDd(['status']).stdout)).not.toThrow();
  });

  it('--no-json forces the human renderer even when piped', () => {
    const { code, stdout, stderr } = runDd(['--no-json', 'status']);
    expect(code).toBe(2);
    expect(stdout.trim()).toBe('status: unconfigured');
    expect(stderr).toContain('→ ');
  });

  it('an unconfigured verb emits next_action and exits 2', () => {
    const { code, stdout } = runDd(['--json', 'status']);
    expect(code).toBe(2);
    const env = parseEnvelope(stdout);
    expect(env.status).toBe('unconfigured');
    expect(env.next_action).toBeTruthy();
  });

  it('an unknown command emits an error envelope and exits 1', () => {
    const { code, stdout } = runDd(['--json', 'no-such-verb']);
    expect(code).toBe(1);
    const env = parseEnvelope(stdout);
    expect(env.status).toBe('error');
    expect(env.error?.code).toBe('E001');
    expect(env.next_action).toBeTruthy();
  });
});
