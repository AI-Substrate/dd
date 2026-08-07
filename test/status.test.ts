import { describe, expect, it } from 'vitest';
import { buildStatusEnvelope, PLANNED_VERBS } from '../src/acts/status.js';
import { FakeClock } from '../src/adapters/clock/fake-clock.js';

const deps = { clock: new FakeClock('2026-01-01T00:00:00.000Z') };

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
    const env = buildStatusEnvelope([...PLANNED_VERBS], deps);
    expect(env.status).toBe('ok');
    expect(env.next_action).toBeUndefined();
    expect(env.data).toMatchObject({ remaining: [] });
  });
});
