import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureBuilt, parseEnvelope, repoRoot, runDd } from '../support/run-cli.js';

/**
 * A LARGE ENVELOPE SURVIVES A PIPE, INTACT.
 *
 * `exitWithEnvelope` writes the envelope and then calls `process.exit`, which
 * does not drain pending stream writes. On a pipe Node's stdout is asynchronous,
 * so the tail of a big envelope was queued and then thrown away by the exit that
 * followed it: `dd --json graph` produced 34,316 bytes and a piped consumer
 * received 8,192 on Node 22, ten runs out of ten. Exit code 0, empty stderr,
 * nothing logged — the command reported success while losing its answer, which
 * is why it survived so long.
 *
 * THE SIZE IS CHOSEN, NOT INHERITED. Driving this through a real verb would pin
 * the guard to whatever this repo's corpus happens to weigh, and the truncation
 * point is the PIPE BUFFER — 8 KB or 16 KB on macOS, 64 KB on Linux. A 34 KB
 * verb envelope therefore reds on a developer's Mac and passes on CI by luck of
 * buffer size, guarding nothing where it matters most. Driving
 * `exitWithEnvelope` directly with a payload far above every one of those
 * buffers makes the guard hold on every platform and every Node version.
 *
 * The second case keeps a real verb in the loop, because a unit that flushes
 * while the shipped bin does not would be a guard over the wrong thing.
 */

const PAYLOAD_BYTES = 400_000;

let workspace: string;
let driver: string;

beforeAll(() => {
  ensureBuilt();
  workspace = mkdtempSync(join(tmpdir(), 'dd-flush-'));
  driver = join(workspace, 'emit-big-envelope.mjs');
  const exitUrl = pathToFileURL(join(repoRoot, 'dist', 'output', 'exit.js')).href;
  const portUrl = pathToFileURL(join(repoRoot, 'dist', 'output', 'output-port.js')).href;
  writeFileSync(
    driver,
    [
      `import { exitWithEnvelope } from ${JSON.stringify(exitUrl)};`,
      `import { createOutputPort } from ${JSON.stringify(portUrl)};`,
      `const pad = 'x'.repeat(${PAYLOAD_BYTES});`,
      `const env = {`,
      `  command: 'flush-probe',`,
      `  status: 'ok',`,
      `  data: { pad },`,
      `  timestamp: '2026-08-08T00:00:00.000Z',`,
      `};`,
      `exitWithEnvelope(env, createOutputPort('json'));`,
    ].join('\n'),
    'utf8',
  );
});

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('a piped envelope is never truncated by the exit that follows it', () => {
  it('delivers a payload larger than any pipe buffer, whole', () => {
    // spawnSync pipes stdout — the exact shape a consumer or CI gets.
    const result = spawnSync(process.execPath, [driver], { encoding: 'utf8' });
    const stdout = result.stdout ?? '';
    const context = `exit=${result.status} signal=${result.signal ?? 'none'} stdoutBytes=${Buffer.byteLength(stdout)} stderr=${JSON.stringify((result.stderr ?? '').slice(0, 300))}`;

    expect(result.status, context).toBe(0);
    // Non-vacuity: a guard against truncation proves nothing unless the payload
    // it carries is bigger than the buffer that would do the truncating.
    expect(Buffer.byteLength(stdout), context).toBeGreaterThan(PAYLOAD_BYTES);

    const parsed = JSON.parse(stdout.trim()) as { data: { pad: string } };
    expect(parsed.data.pad.length, context).toBe(PAYLOAD_BYTES);
  });

  it('keeps the shipped bin honest on the same seam', () => {
    const run = runDd(['--json', 'graph']);
    const context = `exit=${run.code} stdoutBytes=${Buffer.byteLength(run.stdout)} stderr=${JSON.stringify(run.stderr.slice(0, 300))}`;

    expect(run.code, context).toBe(0);
    // The repo's own sweep is comfortably past the smallest pipe buffer this
    // runs on (8 KB). If the corpus ever shrinks below it this row stops being
    // a truncation guard, so it says so here rather than passing quietly.
    expect(Buffer.byteLength(run.stdout), context).toBeGreaterThan(8_229);
    expect(() => parseEnvelope(run.stdout), context).not.toThrow();
    expect(parseEnvelope(run.stdout).status, context).toBe('ok');
  });
});
