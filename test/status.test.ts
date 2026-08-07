import { describe, expect, it } from 'vitest';
import { buildStatusEnvelope, PLANNED_VERBS } from '../src/acts/status.js';
import { FakeClock } from '../src/adapters/clock/fake-clock.js';

const deps = { clock: new FakeClock('2026-01-01T00:00:00.000Z') };

/**
 * The command names a fully-ported program actually registers. Nine planned
 * verbs register their own name; the writer family registers get/set/add/rm.
 */
const REGISTERED_COMMANDS = [
  'validate',
  'schema',
  'docs',
  'build',
  'address',
  'link',
  'links',
  'graph',
  'doctor',
  'get',
  'set',
  'add',
  'rm',
] as const;

describe('buildStatusEnvelope', () => {
  it('is unconfigured while dd verbs are still unported', () => {
    const env = buildStatusEnvelope(['version', 'status'], deps);
    expect(env.status).toBe('unconfigured');
    expect(env.next_action).toContain('validate');
    expect(env.data).toMatchObject({ ported: [], planned: PLANNED_VERBS.length });
  });

  it('reports partial progress as verbs land', () => {
    const env = buildStatusEnvelope(['version', 'status', 'validate'], deps);
    expect(env.status).toBe('unconfigured');
    expect(env.data).toMatchObject({ ported: ['validate'] });
    expect(env.next_action).not.toContain('validate,');
  });

  it('flips to ok once every planned verb is registered', () => {
    const env = buildStatusEnvelope([...REGISTERED_COMMANDS], deps);
    expect(env.status).toBe('ok');
    expect(env.next_action).toBeUndefined();
    expect(env.data).toMatchObject({ remaining: [] });
  });

  it('holds `write` unported until ALL FOUR writer commands are registered', () => {
    // The writer family registers get/set/add/rm and nothing called `write`, so
    // a partially-landed family must not be claimed as a ported verb.
    const partial = buildStatusEnvelope(
      [...REGISTERED_COMMANDS].filter((command) => command !== 'rm'),
      deps,
    );
    expect(partial.status).toBe('unconfigured');
    expect((partial.data as { remaining: string[] }).remaining).toEqual(['write']);
  });
});
