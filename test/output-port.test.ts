import { describe, expect, it } from 'vitest';
import type { Envelope } from '../src/output/envelope.js';
import {
  createOutputPort,
  renderHuman,
  renderJson,
  selectMode,
  type Writers,
} from '../src/output/output-port.js';

const env: Envelope = {
  command: 'status',
  status: 'unconfigured',
  timestamp: '2026-01-01T00:00:00.000Z',
  next_action: 'Port the verbs',
};

function recorder(): Writers & { out_: string[]; err_: string[] } {
  const out_: string[] = [];
  const err_: string[] = [];
  return { out_, err_, out: (t) => out_.push(t), err: (t) => err_.push(t) };
}

describe('selectMode', () => {
  it('honours an explicit --json over everything else', () => {
    expect(selectMode({ json: true }, { DD_JSON: '0' }, true)).toBe('json');
  });

  it('honours an explicit --no-json over env and TTY', () => {
    expect(selectMode({ json: false }, { DD_JSON: '1' }, false)).toBe('human');
  });

  it('falls back to DD_JSON=1 when no flag is given', () => {
    expect(selectMode({}, { DD_JSON: '1' }, true)).toBe('json');
  });

  it('auto-selects JSON when stdout is piped and human when interactive', () => {
    expect(selectMode({}, {}, false)).toBe('json');
    expect(selectMode({}, {}, true)).toBe('human');
  });
});

describe('renderers', () => {
  it('renderJson writes one parseable line to stdout', () => {
    const w = recorder();
    renderJson(env, w);
    expect(w.out_).toHaveLength(1);
    expect(JSON.parse(w.out_[0])).toEqual(env);
    expect(w.err_).toEqual([]);
  });

  it('renderHuman puts next_action on stderr and the summary on stdout', () => {
    const w = recorder();
    renderHuman(env, w);
    expect(w.err_).toEqual(['→ Port the verbs\n']);
    expect(w.out_).toEqual(['status: unconfigured\n']);
  });

  it('createOutputPort dispatches on the resolved mode', () => {
    const w = recorder();
    createOutputPort('json', w).emit(env);
    expect(JSON.parse(w.out_[0])).toEqual(env);
  });
});
