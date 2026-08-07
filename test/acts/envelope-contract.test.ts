import { beforeAll, describe, expect, it } from 'vitest';
import {
  type Envelope,
  EXIT_BY_STATUS,
  ensureBuilt,
  parseEnvelope,
  runDd,
} from '../support/run-cli.js';

/**
 * The envelope seam, asserted over EVERY ported verb (plan 001, ac-0004).
 *
 * One table, one set of assertions: each case names the argv a verb is driven
 * with and the status it must answer. The contract checked for every row is the
 * repo's own — `{command, status, data, error?, next_action?, timestamp}`, the
 * status→exit map 0/0/2/1, and `next_action` REQUIRED on any non-ok status.
 *
 * The table grows with each verb slice, and it is deliberately driven through the
 * SHIPPED bin rather than by calling act functions directly: the exit code IS
 * half the contract, and only a real process has one.
 */
interface VerbCase {
  verb: string;
  label: string;
  argv: string[];
  status: Envelope['status'];
  /** Expected `error.code`, asserted when the case is an error case. */
  code?: string;
}

const GOOD_DOC = 'docs/plans/001-dd-extraction/assets/tasks/phase-2/tasks.dd.json';

const VERB_CASES: VerbCase[] = [
  // --- validate ---
  { verb: 'validate', label: 'a clean document', argv: ['validate', GOOD_DOC], status: 'ok' },
  {
    verb: 'validate',
    label: 'a missing document',
    argv: ['validate', 'no/such/file.dd.json'],
    status: 'error',
    code: 'E400',
  },
  {
    verb: 'validate',
    label: 'a non-integer --depth',
    argv: ['validate', GOOD_DOC, '--depth', 'deep'],
    status: 'error',
    code: 'E108',
  },
  // --- schema ---
  { verb: 'schema', label: 'listing resolvable schemas', argv: ['schema', 'list'], status: 'ok' },
  {
    verb: 'schema',
    label: 'showing an unknown schema',
    argv: ['schema', 'show', 'nope/nothing'],
    status: 'error',
    code: 'E410',
  },
  // --- docs ---
  { verb: 'docs', label: 'listing baked docs', argv: ['docs', 'list'], status: 'ok' },
  {
    verb: 'docs',
    label: 'getting an unknown entry',
    argv: ['docs', 'get', 'no-such-entry'],
    status: 'error',
    code: 'E419',
  },
];

describe('envelope contract over every ported verb', () => {
  beforeAll(ensureBuilt);

  for (const testCase of VERB_CASES) {
    describe(`dd ${testCase.verb} — ${testCase.label}`, () => {
      const run = () => runDd(['--json', ...testCase.argv]);

      it(`answers ${testCase.status} and exits ${EXIT_BY_STATUS[testCase.status]}`, () => {
        const { code, stdout } = run();
        const envelope = parseEnvelope(stdout);
        expect(envelope.status).toBe(testCase.status);
        expect(code).toBe(EXIT_BY_STATUS[testCase.status]);
      });

      it('carries the envelope shape', () => {
        const envelope = parseEnvelope(run().stdout);
        expect(typeof envelope.command).toBe('string');
        expect(envelope.command.length).toBeGreaterThan(0);
        expect(envelope.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      it(
        testCase.status === 'ok' ? 'needs no next_action' : 'carries a next_action (required)',
        () => {
          const envelope = parseEnvelope(run().stdout);
          if (testCase.status === 'ok') return;
          expect(envelope.next_action).toBeTruthy();
        },
      );

      if (testCase.code) {
        it(`reports ${testCase.code}`, () => {
          expect(parseEnvelope(run().stdout).error?.code).toBe(testCase.code);
        });
      }
    });
  }
});

describe('the exit map itself', () => {
  it('is 0 / 0 / 2 / 1 for ok / degraded / unconfigured / error', () => {
    expect(EXIT_BY_STATUS).toEqual({ ok: 0, degraded: 0, unconfigured: 2, error: 1 });
  });
});
