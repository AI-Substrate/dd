import { beforeAll, describe, expect, it } from 'vitest';
import { type Envelope, ensureBuilt, parseEnvelope, runDd } from '../support/run-cli.js';

/**
 * Postfix `--json` on every verb (plan 001, ac-0005).
 *
 * The plan recorded the wart precisely: `dd status --json` answered
 * `E002 unknown option` and exited 1, while `dd --json status` worked. `--json` is
 * a program-level option and `enablePositionalOptions()` gives every option after
 * the verb to the verb, which never declared it.
 *
 * These tests bind ac-0005 ONLY — the envelope/exit contract itself is
 * `envelope-contract.test.ts` (ac-0004). What is asserted here is narrower and
 * exact: **both spellings produce the same envelope and the same exit code**, for
 * every verb the ledger reports as ported. Sameness is the whole claim, so each
 * case runs the verb twice and compares, rather than re-testing the verb.
 */
const GOOD_DOC = 'docs/plans/001-dd-extraction/assets/tasks/phase-2/tasks.dd.json';

/** One invocation per ported verb, chosen to need no writes. */
const INVOCATIONS: Array<{ verb: string; argv: string[] }> = [
  { verb: 'status', argv: ['status'] },
  { verb: 'version', argv: ['version'] },
  { verb: 'validate', argv: ['validate', GOOD_DOC] },
  { verb: 'schema', argv: ['schema', 'list'] },
  { verb: 'docs', argv: ['docs', 'list'] },
  { verb: 'build', argv: ['build', GOOD_DOC, '--check'] },
  { verb: 'address', argv: ['address', 'validate', `${GOOD_DOC}#tasks/tk-0001`] },
  { verb: 'link', argv: ['link', 'resolve', `${GOOD_DOC}#tasks/tk-0001`] },
  { verb: 'links', argv: ['links', GOOD_DOC] },
  { verb: 'graph', argv: ['graph'] },
  { verb: 'doctor', argv: ['doctor'] },
  { verb: 'write', argv: ['get', `${GOOD_DOC}#tasks/tk-0001/state`] },
];

/** Timestamps differ run to run; everything else must match exactly. */
function comparable(envelope: Envelope): Omit<Envelope, 'timestamp'> {
  const { timestamp: _timestamp, ...rest } = envelope;
  return rest;
}

describe('postfix --json is accepted by every verb', () => {
  beforeAll(ensureBuilt);

  it('the plan’s E002 repro (`dd status --json`) now exits per status', () => {
    const { code, stdout } = runDd(['status', '--json']);
    const envelope = parseEnvelope(stdout);
    expect(envelope.error?.code).toBeUndefined();
    expect(envelope.status).toBe('ok');
    expect(code).toBe(0);
  });

  for (const { verb, argv } of INVOCATIONS) {
    it(`dd ${verb}: postfix and prefix agree on envelope and exit`, () => {
      const postfix = runDd([...argv, '--json']);
      const prefix = runDd(['--json', ...argv]);

      expect(postfix.code, `${verb} exit code`).toBe(prefix.code);
      expect(comparable(parseEnvelope(postfix.stdout))).toEqual(
        comparable(parseEnvelope(prefix.stdout)),
      );
    });
  }

  it('postfix --no-json still selects the human renderer', () => {
    const { code, stdout } = runDd(['status', '--no-json']);
    expect(code).toBe(0);
    expect(stdout.trim().split('\n').at(0)).toBe('status: ok');
    expect(() => JSON.parse(stdout)).toThrow();
  });

  it('an error verb keeps exit 1 when the flag is written postfix', () => {
    const { code, stdout } = runDd(['get', `${GOOD_DOC}#tasks/tk-9999/state`, '--json']);
    expect(code).toBe(1);
    expect(parseEnvelope(stdout).status).toBe('error');
  });

  it('covers every verb the ledger reports as ported', () => {
    const status = parseEnvelope(runDd(['--json', 'status']).stdout);
    const ported = (status.data as { ported: string[] }).ported;
    const covered = new Set(INVOCATIONS.map((invocation) => invocation.verb));
    expect(ported.filter((verb) => !covered.has(verb))).toEqual([]);
  });
});
