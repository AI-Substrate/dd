import { beforeAll, describe, expect, it } from 'vitest';
import { describeRun, ensureBuilt, parseEnvelope, runDd } from './support/run-cli.js';

/**
 * The real seam test: spawn the SHIPPED bin the way a consumer or CI would, and
 * assert the envelope contract and the status→exit-code mapping end to end.
 * Ported dd verbs slot in behind this same guarantee.
 *
 * THE SPAWN HELPERS ARE THE SHARED ONES, not a private copy. This file used to
 * carry its own `runDd`/`parseEnvelope` pair, and the copies drifted: the shared
 * one already stripped `DD_JSON` with an explicit `delete` while this one passed
 * an `undefined`-valued key, whose handling differs across Node versions. Two
 * implementations of "spawn the bin and read its envelope" means two different
 * failure messages for the same defect, and the weaker one is the one that reds
 * in CI. There is now one, and it reports everything the spawn knows.
 */

describe('dd bin smoke', () => {
  beforeAll(ensureBuilt);

  it('--version prints the bare version and exits 0', () => {
    const run = runDd(['--version']);
    expect(run.code, describeRun(run)).toBe(0);
    expect(run.stdout.trim(), describeRun(run)).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('--help lists the verbs and exits 0', () => {
    const run = runDd(['--help']);
    expect(run.code, describeRun(run)).toBe(0);
    expect(run.stdout, describeRun(run)).toContain('Usage: ddocs');
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
