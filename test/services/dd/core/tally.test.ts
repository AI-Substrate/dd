import { describe, expect, it } from 'vitest';
import type { DdDoc, DdSection, DdShape, ResolvedDdSchema } from '../../../../src/core/model.js';
import { parse } from '../../../../src/core/parse.js';
import { computeTally, refreshSectionTally, tallyMismatches } from '../../../../src/core/tally.js';
import type { SchemaResolveResult, SchemaResolver } from '../../../../src/core/validate.js';
import { validateDocument } from '../../../../src/core/validate.js';
import { renderDd } from '../../../../src/render/renderer.js';
import { parseSchemaDeclaration } from '../../../../src/schema/declarations.js';

const SCHEMA_PATH = '/repo/.dd/schemas/tally/timesheet/schema.json';

/**
 * A timesheet, which is the RIGHT mental model for this feature: the marked
 * columns share a unit, so summing across them means something. An invoice is
 * the wrong one — `qty × price` is not a tally and there is no expression
 * language here.
 */
const TIMESHEET = {
  dd_schema: 1,
  description: 'A timesheet.',
  sections: {
    days: {
      shape: {
        type: 'object',
        fields: {
          task: { type: 'string' },
          mon: { type: 'number', tally: 'in' },
          tue: { type: 'number', tally: 'in' },
          note: { type: 'string' },
          total: { type: 'number', tally: 'total' },
        },
      },
    },
  },
};

function declare(body: unknown) {
  return parseSchemaDeclaration(JSON.stringify(body), 'tally/timesheet', SCHEMA_PATH);
}

function timesheetSchema(): ResolvedDdSchema {
  const result = declare({
    ...TIMESHEET,
    sections: { days: { shape: { type: 'array', items: TIMESHEET.sections.days.shape } } },
  });
  if (!result.ok) throw new Error(`fixture schema failed: ${JSON.stringify(result.issues)}`);
  return result.declaration.schema;
}

class OneSchemaResolver implements SchemaResolver {
  constructor(private readonly schema: ResolvedDdSchema) {}
  resolve(ref: string): SchemaResolveResult {
    return ref === this.schema.name
      ? { ok: true, schema: this.schema }
      : { ok: false, message: `schema not found: ${ref}` };
  }
}

function doc(rows: unknown[], tally?: Record<string, number>): DdDoc {
  const result = parse(
    JSON.stringify({
      dd: { schema: 'tally/timesheet', spec: 'dd@1' },
      sections: [{ name: 'days', value: rows, ...(tally && { tally }) }],
    }),
  );
  if (Array.isArray(result)) throw new Error(`fixture doc failed: ${JSON.stringify(result)}`);
  return result;
}

const ITEM_SHAPE = (): DdShape | undefined => timesheetSchema().sections.days?.shape.items;

describe('tally — the schema marking survives the parser', () => {
  /**
   * THE test. `parseShape` is an allow-list that silently discards keys it does
   * not name, and it has eaten a shape key before. Every other test in this file
   * could pass while the feature shipped completely inert, because they can build
   * a shape in memory and never go through the parser. This one goes through it.
   */
  it('carries tally from the schema file into the resolved shape', () => {
    const items = ITEM_SHAPE();
    expect(items?.fields?.mon?.tally).toBe('in');
    expect(items?.fields?.total?.tally).toBe('total');
    expect(items?.fields?.note?.tally).toBeUndefined();
  });

  it('refuses a tally on a column that cannot be summed', () => {
    const result = declare({
      ...TIMESHEET,
      sections: {
        days: { shape: { type: 'object', fields: { note: { type: 'string', tally: 'in' } } } },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatchObject({
      class: 'package-invalid',
      location: '$.sections.days.shape.fields.note.tally',
    });
  });

  it('refuses a second row-total column, rather than letting key order pick one', () => {
    const result = declare({
      ...TIMESHEET,
      sections: {
        days: {
          shape: {
            type: 'object',
            fields: {
              mon: { type: 'number', tally: 'total' },
              total: { type: 'number', tally: 'total' },
            },
          },
        },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.message).toContain('a row has one total');
  });

  it('refuses a marking outside the vocabulary', () => {
    const result = declare({
      ...TIMESHEET,
      sections: {
        days: { shape: { type: 'object', fields: { mon: { type: 'number', tally: 'yes' } } } },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.message).toBe('tally must be "in" or "total"');
  });
});

describe('tally — the stored sums survive the document parser', () => {
  /**
   * `parseSections` builds a fresh object from the keys it names and
   * `serializeDoc` writes that object back, so a key the parser drops is not
   * merely invisible — it is DESTROYED by the next write.
   */
  it('carries the section tally off the file', () => {
    expect(doc([], { mon: 6 }).sections[0]?.tally).toEqual({ mon: 6 });
  });

  it('refuses a stored sum that is not a finite number', () => {
    const result = parse(
      JSON.stringify({
        dd: { schema: 'tally/timesheet' },
        sections: [{ name: 'days', value: [], tally: { mon: 'six' } }],
      }),
    );
    expect(Array.isArray(result) && result[0]?.location).toBe('$.sections[0].tally.mon');
  });
});

describe('tally — arithmetic', () => {
  const plan = {
    addends: ['mon', 'tue'],
    totalColumn: 'total',
    footerColumns: ['mon', 'tue', 'total'],
  };

  it('sums at the precision the column data carries, so money stays money', () => {
    // Raw doubles give 3.5900000000000003 and 0.30000000000000004 here. Under the
    // storage ruling that noise is not merely rendered, it is the number the next
    // agent reads back with `jq`.
    const { tally, rowTotals } = computeTally(
      [
        { mon: 1.2, tue: 2.39 },
        { mon: 0.1, tue: 0.2 },
      ],
      plan,
    );
    expect(rowTotals).toEqual([3.59, 0.3]);
    expect(tally).toEqual({ mon: 1.3, tue: 2.59, total: 3.89 });
  });

  it('puts the grand total at the intersection of the two axes', () => {
    const { tally } = computeTally(
      [
        { mon: 2, tue: 3 },
        { mon: 4, tue: 1 },
      ],
      plan,
    );
    // Down the total column, and across the footer row, agree.
    expect(tally.total).toBe(10);
    expect((tally.mon ?? 0) + (tally.tue ?? 0)).toBe(tally.total);
  });

  it('skips a cell that is not a number rather than storing NaN', () => {
    const { tally } = computeTally([{ mon: 2, tue: 'oops' }], plan);
    expect(tally.tue).toBe(0);
    expect(Number.isNaN(tally.total)).toBe(false);
  });

  it('leaves an integer column exactly alone', () => {
    const { tally } = computeTally([{ mon: 1 }, { mon: 2 }], {
      addends: ['mon'],
      footerColumns: ['mon'],
    });
    expect(tally.mon).toBe(3);
  });
});

describe('tally — the writer keeps the stored value honest', () => {
  it('refreshes both the row totals and the footer', () => {
    const section: DdSection = {
      name: 'days',
      value: [
        { task: 'triage', mon: 1, tue: 2 },
        { task: 'review', mon: 3, tue: 4 },
      ],
    };
    expect(refreshSectionTally(section, ITEM_SHAPE())).toBe(true);
    expect(section.tally).toEqual({ mon: 4, tue: 6, total: 10 });
    expect((section.value as Record<string, unknown>[]).map((row) => row.total)).toEqual([3, 7]);
  });

  it('reports no change when the stored value already agrees', () => {
    const section: DdSection = { name: 'days', value: [{ mon: 1, tue: 2, total: 3 }] };
    refreshSectionTally(section, ITEM_SHAPE());
    expect(refreshSectionTally(section, ITEM_SHAPE())).toBe(false);
  });

  it('drops a stored tally the schema no longer marks anything for', () => {
    const section: DdSection = { name: 'days', value: [{ mon: 1 }], tally: { mon: 1 } };
    expect(
      refreshSectionTally(section, { type: 'object', fields: { mon: { type: 'number' } } }),
    ).toBe(true);
    expect(section.tally).toBeUndefined();
  });
});

describe('tally — validate recomputes and compares', () => {
  const resolver = () => new OneSchemaResolver(timesheetSchema());

  it('names a hand-edited footer sum, with both numbers', () => {
    const subject = doc([{ task: 'a', mon: 1, tue: 2, total: 3 }], { mon: 99, tue: 2, total: 3 });
    const issues = validateDocument(subject, '/repo/docs/week.dd.json', resolver(), '/repo');
    expect(issues).toContainEqual(
      expect.objectContaining({
        class: 'tally-mismatch',
        severity: 'ERROR',
        location: '$.sections[days].tally.mon',
        message: 'stored tally says 99 but the rows sum to 1',
      }),
    );
  });

  it('names a hand-edited row total', () => {
    const subject = doc([{ task: 'a', mon: 1, tue: 2, total: 42 }], { mon: 1, tue: 2, total: 42 });
    const issues = validateDocument(subject, '/repo/docs/week.dd.json', resolver(), '/repo');
    expect(issues.map((issue) => issue.location)).toContain('$.sections[days].value[0].total');
  });

  it('names a stored column that is not marked at all', () => {
    const subject = doc([{ task: 'a', mon: 1, tue: 2, total: 3 }], {
      mon: 1,
      tue: 2,
      total: 3,
      wed: 7,
    });
    const issues = validateDocument(subject, '/repo/docs/week.dd.json', resolver(), '/repo');
    expect(issues.map((issue) => issue.message)).toContain(
      'stored tally has "wed", which is not a marked column',
    );
  });

  it('is silent when the stored value agrees with the rows', () => {
    const subject = doc([{ task: 'a', mon: 1, tue: 2, total: 3 }], { mon: 1, tue: 2, total: 3 });
    const issues = validateDocument(subject, '/repo/docs/week.dd.json', resolver(), '/repo');
    expect(issues.filter((issue) => issue.class === 'tally-mismatch')).toEqual([]);
  });

  /**
   * The reason recompute-and-compare is REQUIRED rather than nice to have. The
   * markdown is a faithful function of the JSON, so a wrong stored sum renders
   * without contradiction and the drift gate has nothing to report. Storing
   * without this check would ship a lie that every gate in the repo passes.
   */
  it('catches what a faithful render cannot: the markdown agrees with the wrong JSON', () => {
    const wrong = doc([{ task: 'a', mon: 1, tue: 2, total: 3 }], { mon: 99, tue: 2, total: 3 });
    const schema = timesheetSchema();
    const markdown = renderDd(wrong, { schema, path: '/repo/docs/week.dd.json' });
    // The render reflects the stored number, and reflects it correctly — which is
    // exactly why `ddocs build --check` cannot see the defect.
    expect(markdown).toContain('**99**');
    expect(
      validateDocument(wrong, '/repo/docs/week.dd.json', resolver(), '/repo').some(
        (issue) => issue.class === 'tally-mismatch',
      ),
    ).toBe(true);
  });
});

describe('tally — rendering', () => {
  it('adds one footer row, with the grand total under the total column', () => {
    const subject = doc(
      [
        { task: 'triage', mon: 1, tue: 2, total: 3 },
        { task: 'review', mon: 4, tue: 1, total: 5 },
      ],
      { mon: 5, tue: 3, total: 8 },
    );
    const markdown = renderDd(subject, {
      schema: timesheetSchema(),
      path: '/repo/docs/week.dd.json',
    });
    expect(markdown).toContain('| **Tally** | **5** | **3** | — | **8** |');
  });

  it('renders nothing extra when the schema marks no column', () => {
    const plain = parse(
      JSON.stringify({
        dd: { schema: 'tally/plain', spec: 'dd@1' },
        sections: [{ name: 'days', value: [{ task: 'triage', mon: 1 }] }],
      }),
    ) as DdDoc;
    const unmarked = declare({
      dd_schema: 1,
      description: 'no marks',
      sections: {
        days: {
          shape: {
            type: 'array',
            items: {
              type: 'object',
              fields: { task: { type: 'string' }, mon: { type: 'number' } },
            },
          },
        },
      },
    });
    if (!unmarked.ok) throw new Error('fixture schema failed');
    const markdown = renderDd(plain, {
      schema: unmarked.declaration.schema,
      path: '/repo/docs/plain.dd.json',
    });
    expect(markdown).not.toContain('Tally');
    expect(markdown.split('\n').filter((line) => line.startsWith('| '))).toHaveLength(3);
  });
});

describe('tally — mismatch reporting is a report, not a repair', () => {
  it('leaves the document exactly as it found it', () => {
    const section: DdSection = {
      name: 'days',
      value: [{ task: 'a', mon: 1, tue: 2, total: 42 }],
      tally: { mon: 99, tue: 2, total: 42 },
    };
    const before = JSON.stringify(section);
    expect(tallyMismatches(section, ITEM_SHAPE()).length).toBeGreaterThan(0);
    expect(JSON.stringify(section)).toBe(before);
  });
});
