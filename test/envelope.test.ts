import { describe, expect, it } from 'vitest';
import type { Clock } from '../src/adapters/clock/clock-port.js';
import {
  type Envelope,
  formatDegraded,
  formatError,
  formatOk,
  formatUnconfigured,
} from '../src/output/envelope.js';
import { exitCodeFor } from '../src/output/exit.js';

const clock: Clock = { nowIso: () => '2026-01-01T00:00:00.000Z' };

describe('envelope constructors', () => {
  it('formatOk carries data and omits next_action by default', () => {
    expect(formatOk('version', { version: '0.1.0' }, clock)).toEqual({
      command: 'version',
      status: 'ok',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: { version: '0.1.0' },
    });
  });

  it('formatDegraded requires next_action', () => {
    const env = formatDegraded('validate', { warnings: 1 }, 'Review the warning', clock);
    expect(env.status).toBe('degraded');
    expect(env.next_action).toBe('Review the warning');
  });

  it('formatUnconfigured requires next_action and may omit data', () => {
    const env = formatUnconfigured('status', 'Port the verbs', clock);
    expect(env).toEqual({
      command: 'status',
      status: 'unconfigured',
      timestamp: '2026-01-01T00:00:00.000Z',
      next_action: 'Port the verbs',
    });
  });

  it('formatError defaults next_action to the message', () => {
    const env = formatError('dd', 'E001', 'unknown command', clock);
    expect(env.error).toEqual({ code: 'E001', message: 'unknown command' });
    expect(env.next_action).toBe('unknown command');
  });
});

describe('status to exit code mapping', () => {
  it.each([
    ['ok', 0],
    ['degraded', 0],
    ['unconfigured', 2],
    ['error', 1],
  ] as const)('%s maps to exit %i', (status, code) => {
    const env = { command: 'x', status, timestamp: '' } as Envelope;
    expect(exitCodeFor(env)).toBe(code);
  });
});
