import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureBuilt, parseEnvelope, runDd } from '../support/run-cli.js';

/**
 * Backlog rows 30 + 31, end to end through the SHIPPED bin: `validate`, `doctor`
 * and `graph` must agree about a link to a row that does not exist.
 *
 * The corpus mirrors the reporter's: a typed `introduces` column and a prose
 * `what` field, each citing the real row `halden` and the typo `haldn`. Exact
 * counts carry both arms: one ERROR (typed haldn), one WARN (inline haldn), and
 * nothing for either halden.
 *
 * A temp directory, not a committed fixture: the doctor's sweep skips
 * `test/**\/fixtures/**` by contract, so a fixture tree would sweep nothing.
 */

const SCHEMAS = {
  't/ent': {
    dd_schema: 1,
    description: 'entities',
    sections: {
      entities: {
        shape: {
          type: 'array',
          items: { type: 'object', required: ['id'], fields: { id: { type: 'string' } } },
        },
      },
    },
  },
  't/ch': {
    dd_schema: 1,
    description: 'chapter',
    sections: {
      beats: {
        shape: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id'],
            fields: {
              id: { type: 'string' },
              what: { type: 'text' },
              introduces: {
                type: 'array',
                items: { type: 'link', target: 't/ent/section/entities' },
              },
            },
          },
        },
      },
    },
  },
};

const WHAT = '$.sections[beats].value[0].what';
const INTRODUCES = '$.sections[beats].value[0].introduces[1]';

interface Finding {
  class: string;
  severity: string;
  location: string;
  code: string;
  reason?: string;
}

let repo = '';

function write(relative: string, value: unknown): void {
  const path = join(repo, relative);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
}

function chapter(what: string, introduces: string[]) {
  return {
    dd: { schema: 't/ch' },
    sections: [{ name: 'beats', value: [{ id: 'b1', what, introduces }] }],
  };
}

function pick(findings: readonly Finding[]) {
  return findings.map(({ class: kind, severity, location, code, reason }) => ({
    class: kind,
    severity,
    location,
    code,
    reason,
  }));
}

beforeAll(() => {
  ensureBuilt();
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'dd-row-interiors-')));
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    write(`.dd/schemas/${name}/schema.json`, schema);
  }
  write('world.dd.json', {
    dd: { schema: 't/ent' },
    sections: [{ name: 'entities', value: [{ id: 'halden' }] }],
  });
  write(
    'ch1.dd.json',
    chapter('[H](world.dd.json#entities/halden) then [H](world.dd.json#entities/haldn)', [
      'world.dd.json#entities/halden',
      'world.dd.json#entities/haldn',
    ]),
  );
  write('ch2.dd.json', chapter('[M](missing.dd.json#entities/halden)', []));
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('ddocs validate, doctor and graph agree about a missing row', () => {
  const expected = [
    {
      class: 'link-unresolved',
      severity: 'ERROR',
      location: INTRODUCES,
      code: 'E430',
      reason: 'id-not-found',
    },
    {
      class: 'link-unresolved',
      severity: 'WARN',
      location: WHAT,
      code: 'E430',
      reason: 'id-not-found',
    },
  ];

  it('validate fails on the typed miss with E430, warns on the inline miss, and passes both real rows', () => {
    const run = runDd(['--json', 'validate', 'ch1.dd.json'], { cwd: repo });
    const envelope = parseEnvelope(run);
    expect(run.code).toBe(1);
    expect(envelope.error?.code).toBe('E430');
    const details = envelope.error?.details as { counts: unknown; issues: Finding[] };
    expect(details.counts).toEqual({ error: 1, warn: 1 });
    expect(pick(details.issues)).toEqual(expected);
  });

  it('doctor reports the same two E430 findings, plus ch2 missing-file WARN, and nothing else', () => {
    const run = runDd(['--json', 'doctor'], { cwd: repo });
    const envelope = parseEnvelope(run);
    expect(envelope.error?.code).toBe('E438');
    const details = envelope.error?.details as { counts: unknown; findings: Finding[] };
    expect(pick(details.findings)).toEqual([
      ...expected,
      {
        class: 'address-target-missing',
        severity: 'WARN',
        location: WHAT,
        code: 'E431',
        reason: undefined,
      },
    ]);
    expect(details.counts).toEqual({ error: 1, warn: 2 });
  });

  it('graph draws both inline links as document edges, not file edges', () => {
    const envelope = parseEnvelope(runDd(['--json', 'graph'], { cwd: repo }));
    const edges = (envelope.data as { edges: Array<Record<string, unknown>> }).edges
      .filter((edge) => edge.location === WHAT && String(edge.address).startsWith('world'))
      .map(({ kind, origin, address }) => ({ kind, origin, address }));
    expect(edges).toEqual([
      { kind: 'document', origin: 'inline', address: 'world.dd.json#entities/halden' },
      { kind: 'document', origin: 'inline', address: 'world.dd.json#entities/haldn' },
    ]);
  });
});

describe('ddocs build keeps its existence check for an inline dd address', () => {
  it('reports exactly one missing-target WARN for [M](missing.dd.json#entities/halden)', () => {
    const envelope = parseEnvelope(runDd(['--json', 'build', 'ch2.dd.json'], { cwd: repo }));
    const findings = (envelope.data as { file_findings: Finding[] }).file_findings;
    expect(
      findings.map(({ class: kind, severity, location, code }) => ({
        kind,
        severity,
        location,
        code,
      })),
    ).toEqual([{ kind: 'address-target-missing', severity: 'WARN', location: WHAT, code: 'E431' }]);
  });
});
