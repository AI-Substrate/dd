import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeClock } from '../../src/adapters/clock/fake-clock.js';
import { buildProgram } from '../../src/app.js';
import type { Envelope } from '../../src/output/envelope.js';
import type { CliIo, Writers } from '../../src/output/output-port.js';

/**
 * The payload `ddocs derive` puts in its envelope. Named here so an assertion
 * reads a FIELD rather than an index into `unknown` — a rollup answer whose
 * counts were asserted through casts is one rename away from asserting nothing.
 */
interface DerivePayload {
  address: string;
  path: string;
  interior: string[];
  schema: string | null;
  gate_terminal: string[];
  rel: string;
  complete: boolean;
  status: 'complete' | 'incomplete';
  terminal: number;
  total: number;
  incomplete: string[];
  children: Array<{ id: string; terminal: number; total: number; incomplete: string[] }>;
  counts: { nodes: number; unresolved: number };
  unresolved: string[];
  issues: unknown[];
}

interface Run {
  envelope: Envelope | null;
  out: string;
  err: string;
  code: number;
}

function deps() {
  return { clock: new FakeClock('2026-08-28T00:00:00.000Z') };
}

async function runDd(argv: string[], io?: Partial<CliIo>): Promise<Run> {
  let out = '';
  let err = '';
  let code = -1;
  const writers: Writers = {
    out: (text) => {
      out += text;
    },
    err: (text) => {
      err += text;
    },
  };
  const resolved: CliIo = { mode: 'json', writers, ...io };
  vi.spyOn(process, 'exit').mockImplementation(((value?: number) => {
    code = value ?? 0;
    throw new Error(`exit:${code}`);
  }) as never);
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  try {
    await buildProgram(resolved, deps()).parseAsync(['node', 'dd', ...argv]);
    code = process.exitCode ?? 0;
  } catch (error) {
    const commanderCode = (error as { code?: string }).code ?? '';
    if (
      !/^exit:\d+$/.test(error instanceof Error ? error.message : '') &&
      !commanderCode.startsWith('commander.')
    ) {
      throw error;
    }
  } finally {
    process.exitCode = previousExitCode;
    vi.restoreAllMocks();
  }
  const trimmed = out.trim();
  return {
    envelope:
      resolved.mode === 'json' && trimmed.startsWith('{')
        ? (JSON.parse(trimmed) as Envelope)
        : null,
    out,
    err,
    code,
  };
}

/** The envelope's payload, with the run named in the failure when it is absent. */
function payloadOf(run: Run): DerivePayload {
  if (!run.envelope) {
    throw new Error(`no envelope — code=${run.code} out=${run.out} err=${run.err}`);
  }
  return run.envelope.data as DerivePayload;
}

/**
 * A plan-shaped schema on the BUILT-IN five, whose two composition edges are
 * declared with `rel: "derives"` — the relation `ddocs derive` composes over.
 * Mirrors the shipped `builder/plan` seam (`phases[].tasks`, `tasks[].done`)
 * without depending on it, so this suite pins the VERB rather than that schema.
 */
const PLAN_SCHEMA = {
  dd_schema: 1,
  description: 'a plan whose phases derive from task files and whose tasks derive from assertions',
  sections: {
    meta: {
      required: true,
      shape: {
        type: 'object',
        required: ['title'],
        fields: { title: { type: 'string' } },
      },
    },
    phases: {
      shape: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'state'],
          fields: {
            id: { type: 'string' },
            title: { type: 'string' },
            state: { type: 'state' },
            note: { type: 'string' },
            tasks: { type: 'link', rel: 'derives' },
            // A NON-derives link, deliberately: it points at a document full of
            // open rows, and every count below is proof it was not followed.
            cites: { type: 'link', rel: 'proven_by' },
          },
        },
      },
    },
    tasks: {
      shape: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'state'],
          fields: {
            id: { type: 'string' },
            title: { type: 'string' },
            state: { type: 'state' },
            note: { type: 'string' },
            done: { type: 'link', rel: 'derives' },
          },
        },
      },
    },
    done_when: {
      shape: {
        type: 'object',
        allowAdditional: true,
        fields: {},
        valuesShape: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'state'],
            fields: {
              id: { type: 'string' },
              assertion: { type: 'text' },
              state: { type: 'state' },
              note: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

/**
 * A schema whose completion vocabulary is its OWN — `approved`/`waived` are
 * terminal and nothing else is.
 *
 * Trap 2 in the brief: a verb tested only against the built-in five proves
 * nothing about ruling 1. Every state value here is outside the built-in five,
 * so an implementation that reached for a hardcoded terminal set cannot score a
 * single terminal row in this document.
 */
const REVIEW_SCHEMA = {
  dd_schema: 1,
  description: 'a review whose completion vocabulary is its own',
  enums: {
    verdict: {
      values: ['draft', 'in-review', 'approved', 'waived'],
      gate_terminal: ['approved', 'waived'],
    },
  },
  sections: {
    meta: {
      required: true,
      shape: { type: 'object', required: ['title'], fields: { title: { type: 'string' } } },
    },
    rows: {
      shape: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'state'],
          fields: {
            id: { type: 'string' },
            state: { type: 'state', enum: 'verdict' },
            note: { type: 'string' },
          },
        },
      },
    },
  },
};

let repo: string;
let previousCwd: string;

function write(path: string, value: unknown): void {
  const full = join(repo, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function read(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(repo, path), 'utf8')) as Record<string, unknown>;
}

/** One `done_when` assertion row. */
function assertion(id: string, state: string) {
  return { id, assertion: `assert ${id}`, state, ...(state === 'na' && { note: 'n/a' }) };
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'dd-derive-'));
  previousCwd = process.cwd();
  write('.dd/schemas/probe/plan/schema.json', PLAN_SCHEMA);
  write('.dd/schemas/probe/review/schema.json', REVIEW_SCHEMA);

  // The plan: two phases, both STORED as `checked`, deriving from two task files.
  write('docs/plan.dd.json', {
    dd: { schema: 'probe/plan' },
    sections: [
      { name: 'meta', value: { title: 'Plan' } },
      {
        name: 'phases',
        value: [
          { id: 'ph-0001', title: 'Done phase', state: 'checked', tasks: 'done.dd.json#tasks' },
          { id: 'ph-0002', title: 'Open phase', state: 'checked', tasks: 'open.dd.json#tasks' },
        ],
      },
    ],
    references: [],
  });

  // Every row terminal, across three DIFFERENT terminal states.
  write('docs/done.dd.json', {
    dd: { schema: 'probe/plan' },
    sections: [
      { name: 'meta', value: { title: 'Done' } },
      {
        name: 'tasks',
        value: [
          { id: 'tk-0001', title: 'A', state: 'checked', done: '#done_when/tk-0001' },
          { id: 'tk-0002', title: 'B', state: 'human-skipped', done: '#done_when/tk-0002' },
        ],
      },
      {
        name: 'done_when',
        value: {
          'tk-0001': [assertion('as-0001', 'checked'), assertion('as-0002', 'na')],
          'tk-0002': [assertion('as-0003', 'human-skipped')],
        },
      },
    ],
    references: [],
  });

  // Task rows STORED as `checked` over assertions that are not.
  write('docs/open.dd.json', {
    dd: { schema: 'probe/plan' },
    sections: [
      { name: 'meta', value: { title: 'Open' } },
      {
        name: 'tasks',
        value: [
          { id: 'tk-0003', title: 'C', state: 'checked', done: '#done_when/tk-0003' },
          { id: 'tk-0004', title: 'D', state: 'checked', done: '#done_when/tk-0004' },
        ],
      },
      {
        name: 'done_when',
        value: {
          'tk-0003': [assertion('as-0004', 'checked'), assertion('as-0005', 'unchecked')],
          'tk-0004': [assertion('as-0006', 'blocked')],
        },
      },
    ],
    references: [],
  });

  process.chdir(repo);
});

afterEach(() => {
  process.chdir(previousCwd);
  rmSync(repo, { recursive: true, force: true });
});

describe('ddocs derive — the two arms', () => {
  it('reports complete with an EMPTY incomplete list, and counts every row, for an all-terminal tree', async () => {
    const run = await runDd(['derive', 'docs/done.dd.json#tasks']);
    const data = payloadOf(run);

    expect(run.envelope?.status).toBe('ok');
    expect(run.code).toBe(0);
    expect(data.complete).toBe(true);
    expect(data.status).toBe('complete');
    // The arm that catches "reports incomplete for everything": an empty list is
    // only meaningful beside a total that proves rows were actually read.
    expect(data.incomplete).toEqual([]);
    expect(data.total).toBe(5);
    expect(data.terminal).toBe(5);
  });

  it('names EXACTLY the open ids — and not the terminal siblings beside them — for a mixed tree', async () => {
    const run = await runDd(['derive', 'docs/open.dd.json#tasks']);
    const data = payloadOf(run);

    expect(run.envelope?.status).toBe('ok');
    // Exactly, and in full: `as-0004` is checked and `tk-0003`/`tk-0004` are
    // stored checked, so an implementation that reported "everything open"
    // would name five ids here and an implementation that reported the SECTION
    // only would name none.
    expect(data.incomplete).toEqual(['as-0005', 'as-0006']);
    expect(data.complete).toBe(false);
    expect(data.status).toBe('incomplete');
    expect(data.total).toBe(5);
    expect(data.terminal).toBe(3);
  });
});

describe('ddocs derive — the derived summary contradicts the stored field', () => {
  it('reports incomplete for a phase whose own state, and its tasks own states, all read checked', async () => {
    const stored = read('docs/plan.dd.json');
    const phases = (stored.sections as Array<{ name: string; value: unknown }>).find(
      (section) => section.name === 'phases',
    );
    // The premise, asserted rather than assumed: every stored state on the path
    // from the seed to the open rows claims done.
    expect((phases?.value as Array<{ state: string }>).map((row) => row.state)).toEqual([
      'checked',
      'checked',
    ]);

    const run = await runDd(['derive', 'docs/plan.dd.json#phases']);
    const data = payloadOf(run);

    expect(data.complete).toBe(false);
    expect(data.incomplete).toEqual(['as-0005', 'as-0006']);
    // 2 phases + 4 tasks + 6 assertions.
    expect(data.total).toBe(12);
    expect(data.terminal).toBe(10);
  });

  it('composes the tree across document boundaries rather than answering about one section', async () => {
    const run = await runDd(['derive', 'docs/plan.dd.json#phases']);
    const data = payloadOf(run);

    // Section-only would be 2/2 and childless. The children ARE the composition,
    // and their ids are the addresses the walk resolved.
    expect(data.children.map((child) => child.id)).toEqual([
      'docs/done.dd.json#tasks',
      'docs/open.dd.json#tasks',
    ]);
    expect(data.counts.nodes).toBe(7);
    expect(data.rel).toBe('derives');
  });
});

describe('ddocs derive — ruling 1: the gate-terminal set comes from the resolved schema', () => {
  beforeEach(() => {
    write('docs/review.dd.json', {
      dd: { schema: 'probe/review' },
      sections: [
        { name: 'meta', value: { title: 'Review' } },
        {
          name: 'rows',
          value: [
            { id: 'rv-0001', state: 'approved' },
            { id: 'rv-0002', state: 'waived' },
            { id: 'rv-0003', state: 'in-review' },
          ],
        },
      ],
      references: [],
    });
  });

  it('judges a custom-enum document by its own terminal set, not the built-in five', async () => {
    const run = await runDd(['derive', 'docs/review.dd.json#rows']);
    const data = payloadOf(run);

    expect(data.gate_terminal).toEqual(['approved', 'waived']);
    // Against the built-in five NONE of these three would be terminal, so a
    // hardcoded set scores 0/3 here and cannot reach this row by accident.
    expect(data.terminal).toBe(2);
    expect(data.total).toBe(3);
    expect(data.incomplete).toEqual(['rv-0003']);
  });

  it('applies each document its OWN terminal set when one rollup spans two schemas', async () => {
    const plan = read('docs/plan.dd.json') as {
      sections: Array<{ name: string; value: Array<Record<string, unknown>> }>;
    };
    const phases = plan.sections.find((section) => section.name === 'phases');
    phases?.value.push({
      id: 'ph-0003',
      title: 'Review phase',
      state: 'checked',
      tasks: 'review.dd.json#rows',
    });
    write('docs/plan.dd.json', plan);

    const run = await runDd(['derive', 'docs/plan.dd.json#phases']);
    const data = payloadOf(run);

    // The SEED resolves `probe/plan`, whose terminal set is the built-in five.
    expect(data.gate_terminal).toEqual(['checked', 'human-skipped', 'na']);
    const review = data.children.find((child) => child.id === 'docs/review.dd.json#rows');
    // If the seed's set had been applied to the whole tree, `approved` and
    // `waived` would both be non-terminal and this child would be 0/3 with all
    // three ids named. That it is 2/3 naming only `rv-0003` is the difference.
    expect(review).toBeDefined();
    expect(review?.terminal).toBe(2);
    expect(review?.total).toBe(3);
    expect(review?.incomplete).toEqual(['rv-0003']);
  });
});

describe('ddocs derive — ruling 3: never fake success', () => {
  it('degrades, refuses to report complete, and NAMES the descendant it could not read', async () => {
    write('docs/broken.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Broken' } },
        {
          name: 'phases',
          value: [
            {
              id: 'ph-9001',
              title: 'Points nowhere',
              state: 'checked',
              tasks: 'gone.dd.json#tasks',
            },
          ],
        },
      ],
      references: [],
    });

    const run = await runDd(['derive', 'docs/broken.dd.json#phases']);
    const data = payloadOf(run);

    expect(run.envelope?.status).toBe('degraded');
    // Every stored state in that document reads `checked`. A rollup that trusted
    // what it could reach would say complete; this one cannot.
    expect(data.complete).toBe(false);
    expect(data.unresolved).toEqual(['docs/gone.dd.json#tasks']);
    expect(data.incomplete).toContain('docs/gone.dd.json#tasks');
    expect(data.counts.unresolved).toBe(1);
    // The envelope contract: `next_action` is REQUIRED on any non-ok status.
    expect(run.envelope?.next_action).toBeTruthy();
  });

  it('errors, and does not emit a rollup at all, when the seed address does not resolve', async () => {
    const run = await runDd(['derive', 'docs/plan.dd.json#phases/ph-nope']);

    expect(run.envelope?.status).toBe('error');
    expect(run.code).toBe(1);
    expect(run.envelope?.data).toBeUndefined();
    expect(run.envelope?.next_action).toBeTruthy();
  });
});

describe('ddocs derive — the walk', () => {
  it('terminates on a derives cycle and counts each document in it exactly once', async () => {
    write('docs/cycle-a.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'A' } },
        {
          name: 'phases',
          value: [
            { id: 'ph-aaaa', state: 'unchecked', title: 'A', tasks: 'cycle-b.dd.json#phases' },
          ],
        },
      ],
      references: [],
    });
    write('docs/cycle-b.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'B' } },
        {
          name: 'phases',
          value: [{ id: 'ph-bbbb', state: 'checked', title: 'B', tasks: 'cycle-a.dd.json#phases' }],
        },
      ],
      references: [],
    });

    const run = await runDd(['derive', 'docs/cycle-a.dd.json#phases']);
    const data = payloadOf(run);

    expect(run.envelope?.status).toBe('ok');
    // Two nodes, two rows. A walk without the breaker never returns; a walk that
    // re-entered the cycle once would report 4 rows and a doubled total.
    expect(data.counts.nodes).toBe(2);
    expect(data.total).toBe(2);
    expect(data.terminal).toBe(1);
    expect(data.incomplete).toEqual(['ph-aaaa']);
  });

  it('gives the same counts at document scope as at section scope, counting no row twice', async () => {
    const section = payloadOf(await runDd(['derive', 'docs/open.dd.json#tasks']));
    const document = payloadOf(await runDd(['derive', 'docs/open.dd.json']));

    // The document node structurally contains `done_when`, which the `done`
    // links also point at. The arithmetic must not notice: same rows, counted
    // once, whichever way the tree was shaped to reach them.
    expect(document.total).toBe(section.total);
    expect(document.terminal).toBe(section.terminal);
    expect(document.incomplete).toEqual(section.incomplete);
    // Shape DOES differ, and saying so keeps the claim above honest rather than
    // accidentally true because both runs did the same thing.
    expect(section.counts.nodes).toBe(3);
    expect(document.counts.nodes).toBe(1);
  });

  it('follows derives edges only, leaving a proven_by neighbour out of the total', async () => {
    write('docs/log.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Log' } },
        {
          name: 'tasks',
          value: [
            { id: 'tk-9001', title: 'open', state: 'unchecked' },
            { id: 'tk-9002', title: 'open', state: 'unchecked' },
          ],
        },
      ],
      references: [],
    });
    const plan = read('docs/plan.dd.json') as {
      sections: Array<{ name: string; value: Array<Record<string, unknown>> }>;
    };
    plan.sections
      .find((section) => section.name === 'phases')
      ?.value.push({
        id: 'ph-0004',
        title: 'Cites a log',
        state: 'checked',
        cites: 'log.dd.json#tasks',
      });
    write('docs/plan.dd.json', plan);

    const run = await runDd(['derive', 'docs/plan.dd.json#phases']);
    const data = payloadOf(run);

    // 12 as before, +1 for the new phase row itself and NOTHING for the two open
    // rows it cites. Following `proven_by` would make this 15 and would name
    // tk-9001/tk-9002 among the open ids.
    expect(data.total).toBe(13);
    expect(data.incomplete).toEqual(['as-0005', 'as-0006']);
    expect(data.children.map((child) => child.id)).not.toContain('docs/log.dd.json#tasks');
  });
});

describe('ddocs derive — ruling 4: the port ledger is untouched', () => {
  it('leaves `ddocs status` reporting ten of ten ported verbs', async () => {
    const run = await runDd(['status']);
    const data = run.envelope?.data as { ported: string[]; planned: number; remaining: string[] };

    expect(run.envelope?.status).toBe('ok');
    expect(data.planned).toBe(10);
    expect(data.ported).toHaveLength(10);
    expect(data.remaining).toEqual([]);
    // `derive` is native, not ported: it must not appear in the ledger at all.
    expect(data.ported).not.toContain('derive');
  });
});

describe('ddocs derive — human mode', () => {
  it('puts the headline count on stdout and the open ids on stderr', async () => {
    const run = await runDd(['derive', 'docs/open.dd.json#tasks'], { mode: 'human' });

    expect(run.out.trim()).toBe('[ ] docs/open.dd.json#tasks 3/5');
    expect(run.err).toContain('open: as-0005');
    expect(run.err).toContain('open: as-0006');
  });
});
