import { describe, expect, it } from 'vitest';
import {
  type DdAddress,
  formatAddress,
  isAddressFailure,
  normalizeAddress,
  parseAddress,
} from '../../../../src/core/address.js';

const WORKED_EXAMPLES = [
  'plan.dd.json#preamble',
  'plan.dd.json#phases',
  'plan.dd.json#phases/ph-3f2a',
  'plan.dd.json#phases/ph-3f2a/brief',
  'plan.dd.json#phases/ph-3f2a/tasks/tk-9f2a',
  '../other/backpressure.dd.json#evidence/bp-7f3a',
  '#phase-2-evidence/tk-9f2a',
  '#phase-2-evidence/task-payment',
  'plan.dd.json#phases/ph-3f2a/tasks/tk-9f2a/done/dw-11c2',
];

function parsed(raw: string): DdAddress {
  const result = parseAddress(raw);
  expect(isAddressFailure(result)).toBe(false);
  return result as DdAddress;
}

function cycle<T>(values: readonly [T, ...T[]], index: number): T {
  return values[index % values.length] ?? values[0];
}

describe('dd-core address grammar', () => {
  it.each(WORKED_EXAMPLES)('round-trips workshop form %s', (raw) => {
    expect(formatAddress(parsed(raw))).toBe(raw);
  });

  it('marks alternating schema-name and instance-id descent', () => {
    expect(parsed('plan.dd.json#phases/ph-3f2a/tasks/tk-9f2a').segments).toEqual([
      { kind: 'name', value: 'phases' },
      { kind: 'id', value: 'ph-3f2a' },
      { kind: 'name', value: 'tasks' },
      { kind: 'id', value: 'tk-9f2a' },
    ]);
  });

  it('normalizes only the file path and preserves the interior grammar', () => {
    expect(formatAddress(normalizeAddress(parsed('./docs/../plan.dd.json#phases/ph-3f2a')))).toBe(
      'plan.dd.json#phases/ph-3f2a',
    );
    expect(formatAddress(normalizeAddress(parsed('..\\other.dd.json#tasks/tk-a1b2')))).toBe(
      '../other.dd.json#tasks/tk-a1b2',
    );
  });

  it('parses the bare path as the whole-file form and round-trips it undecorated', () => {
    for (const raw of ['src/search/index.ts', 'notes.md', '../other/backpressure.dd.json']) {
      const address = parsed(raw);
      expect(address).toEqual({ file: raw, segments: [] });
      // No trailing "#": the author never wrote a fragment, so formatting must
      // not invent one — an empty interior is the spelling this grammar refuses.
      expect(formatAddress(address)).toBe(raw);
    }
  });

  /**
   * BRIEF ruling 4: `file#method` is out of scope and must stay POSSIBLE. It is
   * asserted here rather than left to the CLI because "we did not foreclose it"
   * is exactly the kind of claim that decays silently — nothing else in the
   * suite would fail if the fragment namespace were taken.
   */
  it('keeps file#method syntax-valid and leaves the fragment free', () => {
    expect(parsed('src/foo.ts#parseThing')).toEqual({
      file: 'src/foo.ts',
      segments: [{ kind: 'name', value: 'parseThing' }],
    });
  });

  it('normalizes a whole-file path with no interior to walk through', () => {
    expect(formatAddress(normalizeAddress(parsed('./docs/../src/a.ts')))).toBe('src/a.ts');
    expect(formatAddress(normalizeAddress(parsed('..\\other\\notes.md')))).toBe(
      '../other/notes.md',
    );
  });

  it('rejects malformed, positional, or reserved forms without throwing', () => {
    for (const raw of [
      '',
      'plan.dd.json#',
      '#',
      'plan.dd.json#phases//tasks',
      'plan.dd.json#phases/2/tasks',
      'plan.dd.json#phases/@sha',
      'plan.dd.json#phases/has space',
      'plan.dd.json#phases#other',
    ]) {
      expect(isAddressFailure(parseAddress(raw))).toBe(true);
    }
  });

  it('property: parse(format(address)) is identity for canonical addresses', () => {
    const names = ['preamble', 'phases', 'tasks', 'done', 'evidence'] as const;
    const ids = ['ph-0001', 'tk-9f2a', 'task-payment', 'dw-abcd'] as const;
    for (let i = 0; i < 250; i += 1) {
      const depth = 1 + (i % 6);
      const segments = Array.from({ length: depth }, (_, index) => ({
        kind: index % 2 === 0 ? ('name' as const) : ('id' as const),
        value: index % 2 === 0 ? cycle(names, i + index) : cycle(ids, i * 3 + index),
      }));
      const address: DdAddress = {
        file: i % 3 === 0 ? null : i % 3 === 1 ? 'plan.dd.json' : '../other/tasks.dd.json',
        segments,
      };
      expect(parseAddress(formatAddress(address))).toEqual(address);
    }
  });
});
