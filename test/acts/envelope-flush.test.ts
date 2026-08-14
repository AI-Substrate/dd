import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type CliRun,
  describeRun,
  ensureBuilt,
  parseEnvelope,
  repoRoot,
  runDd,
} from '../support/run-cli.js';

/**
 * A LARGE ENVELOPE SURVIVES A PIPE, INTACT.
 *
 * `exitWithEnvelope` writes the envelope and then calls `process.exit`, which
 * does not drain pending stream writes. On a pipe Node's stdout is asynchronous,
 * so the tail of a big envelope was queued and then thrown away by the exit that
 * followed it: `ddocs --json graph` produced 34,316 bytes and a piped consumer
 * received 8,192 on Node 22, ten runs out of ten. Exit code 0, empty stderr,
 * nothing logged — the command reported success while losing its answer, which
 * is why it survived so long.
 *
 * BOTH ROWS CARRY THEIR OWN PAYLOAD, AND THAT IS THE WHOLE DESIGN. Truncation
 * happens at the PIPE BUFFER, and that buffer is not one number: 8 KB or 16 KB
 * on macOS, 64 KB on Linux, and a Node version may enlarge what it flushes
 * before exiting. A row whose payload is smaller than the buffer it runs against
 * PASSES WITH THE DEFECT FULLY RESTORED — it measures the corpus, not the fix.
 * The first version of the second row did exactly that: it drove the repo's own
 * 34 KB sweep, which reds on a developer's Mac and is vacuous on Linux CI and on
 * Node 24 — green by luck of buffer size precisely where the release is decided.
 * So both rows now clear PIPE_CEILING, chosen far above every buffer either
 * platform has, and both assert that they did: a payload that shrinks below it
 * fails loudly instead of passing quietly.
 *
 * THE RED HAS TO NAME ITS CAUSE. Both rows parse through `parseEnvelope` BEFORE
 * they assert anything about size, so a truncated run fails carrying the
 * diagnosis — "exit 0, no error, partial JSON — the TRUNCATION signature" —
 * rather than a bare byte-count mismatch the next reader has to re-investigate
 * from scratch. Asserting size first throws away the one line that says what
 * broke, which is how the original CI red cost a full investigation.
 */

/** Far above every pipe buffer these rows can meet: macOS 8-16 KB, Linux 64 KB. */
const PIPE_CEILING = 400_000;
/** Row 1's chosen payload — the unit driving `exitWithEnvelope` directly. */
const PAYLOAD_BYTES = PIPE_CEILING;
/**
 * Row 2's corpus size. Measured, not guessed: 900 documents with 180-character
 * names produce a 499,668-byte `ddocs graph` envelope under the SHORTEST root these
 * tests can get (`/tmp/dd-flush-corpus-XXXXXX`, the Linux shape). A macOS
 * `/private/var/folders/...` root only makes it bigger, so the floor holds on
 * both with roughly 100 KB to spare.
 */
const CORPUS_DOCS = 900;
const DOC_STEM = 'g'.repeat(180);

const SCHEMA = {
  dd_schema: 1,
  description: 'The corpus this fixture generates exists for one reason: to weigh a lot.',
  sections: {
    meta: {
      required: true,
      shape: { type: 'object', required: ['title'], fields: { title: { type: 'string' } } },
    },
  },
};
const DOCUMENT = JSON.stringify({
  dd: { schema: 'demo/bulk' },
  sections: [{ name: 'meta', value: { title: 't' } }],
  references: [],
});

let workspace: string;
let driver: string;
let corpusRoot: string;

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

  // A GENERATED corpus, because the repo's own is the wrong instrument: its
  // weight is whatever the plan happened to write this month, and it is already
  // too light for a Linux pipe. Generating it makes the payload a decision this
  // file states and can defend on every platform it runs on.
  corpusRoot = mkdtempSync(join(tmpdir(), 'dd-flush-corpus-'));
  const schemaDir = join(corpusRoot, '.dd', 'schemas', 'demo', 'bulk');
  mkdirSync(schemaDir, { recursive: true });
  writeFileSync(join(schemaDir, 'schema.json'), JSON.stringify(SCHEMA), 'utf8');
  for (let index = 0; index < CORPUS_DOCS; index += 1) {
    writeFileSync(
      join(corpusRoot, `${DOC_STEM}-${String(index).padStart(4, '0')}.dd.json`),
      DOCUMENT,
      'utf8',
    );
  }
});

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
  rmSync(corpusRoot, { recursive: true, force: true });
});

/**
 * Present the driver spawn as a `CliRun`, so it fails through the SAME
 * diagnostics as every other spawn in this repo. `runDd` is not used to launch
 * it — this row deliberately drives `exitWithEnvelope` rather than a verb — but
 * a red here is exactly the shape `parseEnvelope` was taught to name, and
 * re-describing that locally is the drift the shared helper exists to end.
 */
function runDriver(script: string): CliRun {
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  return {
    argv: ['(flush probe driver)', script],
    code: result.status,
    signal: result.signal,
    spawnError: result.error,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

describe('a piped envelope is never truncated by the exit that follows it', () => {
  it('delivers a payload larger than any pipe buffer, whole', () => {
    // spawnSync pipes stdout — the exact shape a consumer or CI gets.
    const run = runDriver(driver);
    const context = describeRun(run);

    // Parse FIRST: with the defect restored this throws NAMING the truncation
    // signature, instead of failing a byte count that says nothing about why.
    const envelope = parseEnvelope(run);
    const data = envelope.data as { pad: string };

    expect(run.code, context).toBe(0);
    // Non-vacuity: a guard against truncation proves nothing unless the payload
    // it carries is bigger than the buffer that would do the truncating.
    expect(Buffer.byteLength(run.stdout), context).toBeGreaterThan(PIPE_CEILING);
    expect(data.pad.length, context).toBe(PAYLOAD_BYTES);
  });

  it('keeps the shipped bin honest on the same seam', () => {
    const run = runDd(['--json', 'graph'], { cwd: corpusRoot });
    const context = describeRun(run);

    const envelope = parseEnvelope(run);

    expect(run.code, context).toBe(0);
    expect(envelope.status, context).toBe('ok');
    // The generated corpus has to stay above every pipe buffer this can run
    // against. If it ever falls below, this row has stopped being a truncation
    // guard, and it says so here rather than passing on the platform where the
    // defect would be invisible.
    expect(Buffer.byteLength(run.stdout), context).toBeGreaterThan(PIPE_CEILING);
    expect((envelope.data as { counts: { nodes: number } }).counts.nodes, context).toBe(
      CORPUS_DOCS,
    );
  });
});
