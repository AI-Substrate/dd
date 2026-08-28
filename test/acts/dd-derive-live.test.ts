import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeClock } from '../../src/adapters/clock/fake-clock.js';
import { buildProgram } from '../../src/app.js';
import type { Envelope } from '../../src/output/envelope.js';
import type { CliIo, Writers } from '../../src/output/output-port.js';

/**
 * The ruled recursive wire shape, named here so an assertion reads a FIELD
 * rather than an index into `unknown`. A payload asserted through casts is one
 * rename away from asserting nothing, which is this repo's most-repeated defect.
 */
interface Incomplete {
  id: string;
  address: string;
  section: string;
  state?: string;
}
interface Degradation {
  reason: string;
  address: string;
  detail?: string;
}
interface Node {
  address: string;
  complete: boolean;
  gate_terminal: string[];
  total: number;
  incomplete: Incomplete[];
  nodes: Node[];
  degradations: Degradation[];
}
type Root = Node & { basis: string[] };

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

/** The envelope's payload, with the whole run named in the failure when absent. */
function rootOf(run: Run): Root {
  if (!run.envelope) {
    throw new Error(`no envelope — code=${run.code} out=${run.out} err=${run.err}`);
  }
  return run.envelope.data as Root;
}

/** Every node of the rollup, root first, in traversal order. */
function flatten(node: Node): Node[] {
  return [node, ...node.nodes.flatMap(flatten)];
}

const PLAN_SCHEMA = {
  dd_schema: 1,
  description: 'a plan whose phases derive from task files and whose tasks derive from assertions',
  sections: {
    meta: {
      required: true,
      shape: { type: 'object', required: ['title'], fields: { title: { type: 'string' } } },
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
            // A NON-derives link, deliberately: every count is proof it was not
            // followed, and the neighbour it reaches is deliberately broken.
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
 * terminal and nothing else is. Every state value is outside the built-in five,
 * so an implementation reaching for a hardcoded set scores zero terminal rows
 * here and cannot reach those assertions by accident.
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

function read(path: string): { sections: Array<{ name: string; value: unknown }> } {
  return JSON.parse(readFileSync(join(repo, path), 'utf8')) as {
    sections: Array<{ name: string; value: unknown }>;
  };
}

function assertion(id: string, state: string) {
  return { id, assertion: `assert ${id}`, state, ...(state === 'na' && { note: 'n/a' }) };
}

function planDoc(phases: unknown[]) {
  return {
    dd: { schema: 'probe/plan' },
    sections: [
      { name: 'meta', value: { title: 'Plan' } },
      { name: 'phases', value: phases },
    ],
    references: [],
  };
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'dd-derive-'));
  previousCwd = process.cwd();
  write('.dd/schemas/probe/plan/schema.json', PLAN_SCHEMA);
  write('.dd/schemas/probe/review/schema.json', REVIEW_SCHEMA);

  write(
    'docs/plan.dd.json',
    planDoc([
      { id: 'ph-0001', title: 'Done phase', state: 'checked', tasks: 'done.dd.json#tasks' },
      { id: 'ph-0002', title: 'Open phase', state: 'checked', tasks: 'open.dd.json#tasks' },
    ]),
  );

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

describe('ddocs derive — the recursive wire contract', () => {
  it('gives every node address, complete, gate_terminal, total, incomplete, nodes and degradations', async () => {
    const root = rootOf(await runDd(['derive', 'docs/plan.dd.json#phases']));

    for (const node of flatten(root)) {
      expect(Object.keys(node).sort(), node.address).toEqual(
        ['address', 'complete', 'degradations', 'gate_terminal', 'incomplete', 'nodes', 'total']
          .concat(node === root ? ['basis'] : [])
          .sort(),
      );
      expect(typeof node.address, node.address).toBe('string');
      expect(typeof node.complete, node.address).toBe('boolean');
      expect(Number.isInteger(node.total), node.address).toBe(true);
      expect(Array.isArray(node.incomplete), node.address).toBe(true);
      expect(Array.isArray(node.nodes), node.address).toBe(true);
      expect(Array.isArray(node.degradations), node.address).toBe(true);
      expect(Array.isArray(node.gate_terminal), node.address).toBe(true);
    }
    // The root echoes the request verbatim; descendants are fully qualified.
    expect(root.address).toBe('docs/plan.dd.json#phases');
    expect(flatten(root).length).toBeGreaterThan(1);
  });

  it('roots a sorted, unique, repo-relative basis that includes the root document', async () => {
    const root = rootOf(await runDd(['derive', 'docs/plan.dd.json#phases']));

    expect(root.basis).toEqual(['docs/done.dd.json', 'docs/open.dd.json', 'docs/plan.dd.json']);
    expect(root.basis).toEqual([...root.basis].sort());
    expect(new Set(root.basis).size).toBe(root.basis.length);
    // Only descendant nodes are consulted; the basis is the closure, not the
    // corpus — and it is a ROOT-only field, which this asserts structurally.
    expect((root.nodes[0] as Partial<Root> | undefined)?.basis).toBeUndefined();
  });
});

describe('ddocs derive — the two arms', () => {
  it('reports complete with empty incomplete AND empty degradations for an all-terminal tree', async () => {
    const run = await runDd(['derive', 'docs/done.dd.json#tasks']);
    const root = rootOf(run);

    expect(run.envelope?.status).toBe('ok');
    expect(run.code).toBe(0);
    expect(root.complete).toBe(true);
    expect(root.incomplete).toEqual([]);
    expect(root.degradations).toEqual([]);
    // The count is what stops "reports incomplete for everything" scoring here.
    expect(root.total).toBe(5);
  });

  it('names exactly the open rows, each with its row-local id and fully qualified address', async () => {
    const run = await runDd(['derive', 'docs/open.dd.json#tasks']);
    const root = rootOf(run);

    expect(run.envelope?.status).toBe('ok');
    expect(root.complete).toBe(false);
    expect(root.total).toBe(5);
    expect(root.incomplete).toEqual([
      {
        id: 'as-0005',
        address: 'docs/open.dd.json#done_when/tk-0003/as-0005',
        section: 'done_when',
        state: 'unchecked',
      },
      {
        id: 'as-0006',
        address: 'docs/open.dd.json#done_when/tk-0004/as-0006',
        section: 'done_when',
        state: 'blocked',
      },
    ]);
    expect(root.degradations).toEqual([]);
  });

  it('reports incomplete for a phase whose own state, and its tasks own states, all read checked', async () => {
    const phases = read('docs/plan.dd.json').sections.find((s) => s.name === 'phases');
    expect((phases?.value as Array<{ state: string }>).map((row) => row.state)).toEqual([
      'checked',
      'checked',
    ]);

    const root = rootOf(await runDd(['derive', 'docs/plan.dd.json#phases']));

    expect(root.complete).toBe(false);
    expect(root.incomplete.map((entry) => entry.id)).toEqual(['as-0005', 'as-0006']);
    // 2 phases + 4 tasks + 6 assertions.
    expect(root.total).toBe(12);
    expect(root.nodes.map((node) => node.address)).toEqual([
      'docs/done.dd.json#tasks',
      'docs/open.dd.json#tasks',
    ]);
  });
});

describe('ddocs derive — ruling 1: gate_terminal is resolved per node', () => {
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
    const root = rootOf(await runDd(['derive', 'docs/review.dd.json#rows']));

    expect(root.gate_terminal).toEqual(['approved', 'waived']);
    // Against the built-in five NONE of these would be terminal: 0/3, not 2/3.
    expect(root.total).toBe(3);
    expect(root.incomplete.map((entry) => entry.id)).toEqual(['rv-0003']);
  });

  it('carries each node its OWN terminal set when one rollup spans two schemas', async () => {
    const plan = read('docs/plan.dd.json');
    (plan.sections.find((s) => s.name === 'phases')?.value as unknown[]).push({
      id: 'ph-0003',
      title: 'Review phase',
      state: 'checked',
      tasks: 'review.dd.json#rows',
    });
    write('docs/plan.dd.json', plan);

    const root = rootOf(await runDd(['derive', 'docs/plan.dd.json#phases']));

    expect(root.gate_terminal).toEqual(['checked', 'human-skipped', 'na']);
    const review = root.nodes.find((node) => node.address === 'docs/review.dd.json#rows');
    expect(review?.gate_terminal).toEqual(['approved', 'waived']);
    // Under the ROOT's set all three review rows would be open. Under its own,
    // exactly one is — and that difference is the whole of ruling 1.
    expect(review?.total).toBe(3);
    expect(review?.incomplete.map((entry) => entry.id)).toEqual(['rv-0003']);
  });
});

describe('ddocs derive — a degradation outranks completeness', () => {
  it('degrades on a MISSING descendant document, counts it incomplete, and flips when the world is repaired', async () => {
    write(
      'docs/broken.dd.json',
      planDoc([
        { id: 'ph-9001', title: 'Points nowhere', state: 'checked', tasks: 'gone.dd.json#tasks' },
      ]),
    );

    const before = await runDd(['derive', 'docs/broken.dd.json#phases']);
    const broken = rootOf(before);
    expect(before.envelope?.status).toBe('degraded');
    expect(before.code).toBe(0);
    expect(before.envelope?.next_action).toBeTruthy();
    expect(broken.complete).toBe(false);
    expect(broken.degradations).toEqual([
      {
        reason: 'descendant-unreadable',
        address: 'docs/gone.dd.json#tasks',
        detail: expect.stringContaining('gone.dd.json'),
      },
    ]);
    // COUNTED, not skipped: the unreachable subtree is one incomplete row, and
    // it carries NO `state` because none was readable.
    expect(broken.total).toBe(2);
    expect(broken.incomplete.map((entry) => entry.address)).toContain('docs/gone.dd.json#tasks');
    expect(broken.incomplete.at(-1)).not.toHaveProperty('state');

    // Repair the WORLD, not the assertion.
    write('docs/gone.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Found' } },
        { name: 'tasks', value: [{ id: 'tk-9999', title: 'now here', state: 'checked' }] },
      ],
      references: [],
    });

    const after = await runDd(['derive', 'docs/broken.dd.json#phases']);
    const repaired = rootOf(after);
    expect(after.envelope?.status).toBe('ok');
    expect(repaired.complete).toBe(true);
    expect(repaired.degradations).toEqual([]);
    expect(repaired.incomplete).toEqual([]);
    expect(repaired.total).toBe(2);
  });

  it('degrades SEPARATELY on a descendant whose schema will not resolve, and flips when the schema is repaired', async () => {
    write(
      'docs/host.dd.json',
      planDoc([
        {
          id: 'ph-9002',
          title: 'Bad schema below',
          state: 'checked',
          tasks: 'stranger.dd.json#tasks',
        },
      ]),
    );
    write('docs/stranger.dd.json', {
      dd: { schema: 'nobody/knows' },
      sections: [{ name: 'tasks', value: [{ id: 'tk-8888', state: 'checked' }] }],
      references: [],
    });

    const before = await runDd(['derive', 'docs/host.dd.json#phases']);
    const unresolved = rootOf(before);
    expect(before.envelope?.status).toBe('degraded');
    expect(unresolved.complete).toBe(false);
    expect(unresolved.degradations.map((degradation) => degradation.reason)).toEqual([
      'descendant-schema-unresolved',
    ]);
    expect(unresolved.degradations[0]?.address).toBe('docs/stranger.dd.json#tasks');
    // No schema resolved there, so there is no terminal vocabulary to report.
    const stranger = unresolved.nodes.find((n) => n.address === 'docs/stranger.dd.json#tasks');
    expect(stranger?.gate_terminal).toEqual([]);
    expect(stranger?.total).toBe(1);

    // Repair the WORLD: give the document a schema that resolves.
    write('docs/stranger.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Stranger' } },
        { name: 'tasks', value: [{ id: 'tk-8888', title: 'known', state: 'checked' }] },
      ],
      references: [],
    });

    const after = await runDd(['derive', 'docs/host.dd.json#phases']);
    const repaired = rootOf(after);
    expect(after.envelope?.status).toBe('ok');
    expect(repaired.complete).toBe(true);
    expect(repaired.degradations).toEqual([]);
    expect(repaired.nodes[0]?.gate_terminal).toEqual(['checked', 'human-skipped', 'na']);
  });

  it('refuses complete for an all-terminal tree that carries a degradation, with incomplete empty', async () => {
    // Every readable row is terminal; only the unreachable branch is not. This
    // is the `complete:false, incomplete:[]` shape the contract makes legal
    // ONLY when degradations is non-empty — asserted together, so neither can
    // drift without the other noticing.
    write(
      'docs/mixed.dd.json',
      planDoc([
        { id: 'ph-9003', title: 'terminal but blind', state: 'checked', tasks: 'nowhere.dd.json' },
      ]),
    );

    const root = rootOf(await runDd(['derive', 'docs/mixed.dd.json#phases']));

    expect(root.complete).toBe(false);
    expect(root.degradations.length).toBeGreaterThan(0);
    expect(root.incomplete.every((entry) => entry.state === undefined)).toBe(true);
  });
});

describe('ddocs derive — cycles', () => {
  beforeEach(() => {
    write(
      'docs/cycle-a.dd.json',
      planDoc([
        { id: 'ph-aaaa', title: 'loops', state: 'checked', tasks: 'cycle-b.dd.json#phases' },
        { id: 'ph-side', title: 'side branch', state: 'checked', tasks: 'side.dd.json#tasks' },
      ]),
    );
    write(
      'docs/cycle-b.dd.json',
      planDoc([
        { id: 'ph-bbbb', title: 'back', state: 'checked', tasks: 'cycle-a.dd.json#phases' },
      ]),
    );
    write('docs/side.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Side' } },
        { name: 'tasks', value: [{ id: 'tk-side', title: 's', state: 'checked' }] },
      ],
      references: [],
    });
  });

  it('degrades on a derives cycle, names every member, and NEVER reports complete', async () => {
    const run = await runDd(['derive', 'docs/cycle-a.dd.json#phases']);
    const root = rootOf(run);

    expect(run.envelope?.status).toBe('degraded');
    const cycle = root.degradations.find((degradation) => degradation.reason === 'cycle');
    expect(cycle).toBeDefined();
    expect(cycle?.detail).toBe(
      'derives cycle: docs/cycle-a.dd.json#phases -> docs/cycle-b.dd.json#phases -> docs/cycle-a.dd.json#phases',
    );
    // EVERY row in this corpus is `checked`, so a walk that merely terminated
    // would report complete with an empty incomplete list. That is precisely
    // the defect: a cycle means a node's completeness is defined by itself.
    expect(root.incomplete).toEqual([]);
    expect(root.complete).toBe(false);
  });

  it('terminates only the looping branch and keeps the independent one', async () => {
    const root = rootOf(await runDd(['derive', 'docs/cycle-a.dd.json#phases']));

    expect(root.nodes.map((node) => node.address)).toEqual([
      'docs/cycle-b.dd.json#phases',
      'docs/side.dd.json#tasks',
    ]);
    // The side branch was fully walked and its rows counted: 2 phase rows +
    // 1 cycle-b phase row + 1 side task.
    const side = root.nodes.find((node) => node.address === 'docs/side.dd.json#tasks');
    expect(side?.total).toBe(1);
    expect(side?.degradations).toEqual([]);
    expect(root.total).toBe(4);
    // The looping branch stops AT cycle-b: it has no children of its own.
    expect(root.nodes[0]?.nodes).toEqual([]);
  });
});

describe('ddocs derive — an empty subtree is exact, not a failure', () => {
  it('reports complete true, total 0 and empty arrays for a section carrying no assertion', async () => {
    write('docs/empty.dd.json', planDoc([]));

    const run = await runDd(['derive', 'docs/empty.dd.json#phases']);
    const root = rootOf(run);

    expect(run.envelope?.status).toBe('ok');
    expect(root.complete).toBe(true);
    expect(root.total).toBe(0);
    expect(root.incomplete).toEqual([]);
    expect(root.nodes).toEqual([]);
    expect(root.degradations).toEqual([]);
  });
});

describe('ddocs derive — the walk', () => {
  it('follows derives edges only, leaving a broken proven_by neighbour out of the answer entirely', async () => {
    // The neighbour is BROKEN as well as non-derives: its schema does not
    // resolve. If the rollup consulted anything outside the derives closure it
    // would degrade here, and it must not.
    write('docs/log.dd.json', {
      dd: { schema: 'nobody/knows' },
      sections: [{ name: 'tasks', value: [{ id: 'tk-9001', state: 'unchecked' }] }],
      references: [],
    });
    write(
      'docs/citer.dd.json',
      planDoc([
        { id: 'ph-cite', title: 'cites a log', state: 'checked', cites: 'log.dd.json#tasks' },
      ]),
    );

    const run = await runDd(['derive', 'docs/citer.dd.json#phases']);
    const root = rootOf(run);

    expect(run.envelope?.status).toBe('ok');
    expect(root.complete).toBe(true);
    expect(root.degradations).toEqual([]);
    expect(root.total).toBe(1);
    expect(root.basis).toEqual(['docs/citer.dd.json']);
  });

  it('gives the same counts at document scope as at section scope, counting no row twice', async () => {
    const section = rootOf(await runDd(['derive', 'docs/open.dd.json#tasks']));
    const document = rootOf(await runDd(['derive', 'docs/open.dd.json']));

    expect(document.total).toBe(section.total);
    expect(document.incomplete.map((entry) => entry.id)).toEqual(
      section.incomplete.map((entry) => entry.id),
    );
    // Shape DOES differ, and saying so keeps the claim above honest rather than
    // accidentally true because both runs did the same thing.
    expect(flatten(section).length).toBe(3);
    expect(flatten(document).length).toBe(1);
  });

  it('errors, and emits no rollup at all, when the seed address does not resolve', async () => {
    const run = await runDd(['derive', 'docs/plan.dd.json#phases/ph-nope']);

    expect(run.envelope?.status).toBe('error');
    expect(run.code).toBe(1);
    expect(run.envelope?.data).toBeUndefined();
    expect(run.envelope?.next_action).toBeTruthy();
  });
});

describe('ddocs derive — determinism', () => {
  it('emits byte-identical output for two runs over an unchanged corpus', async () => {
    const first = await runDd(['derive', 'docs/plan.dd.json#phases']);
    const second = await runDd(['derive', 'docs/plan.dd.json#phases']);

    expect(second.out).toBe(first.out);
    // Not vacuous: prove the bytes are a real payload, not two empty strings.
    expect(first.out.length).toBeGreaterThan(200);
    expect(rootOf(first).total).toBe(12);
  });
});

describe('ddocs derive — the program contract', () => {
  it('accepts the output flag before AND after the verb', async () => {
    const before = await runDd(['--json', 'derive', 'docs/open.dd.json#tasks']);
    const after = await runDd(['derive', 'docs/open.dd.json#tasks', '--json']);

    expect(rootOf(before).total).toBe(5);
    expect(rootOf(after).total).toBe(5);
  });

  it('leaves `ddocs status` reporting ten of ten ported verbs', async () => {
    const run = await runDd(['status']);
    const data = run.envelope?.data as { ported: string[]; planned: number; remaining: string[] };

    expect(run.envelope?.status).toBe('ok');
    expect(data.planned).toBe(10);
    expect(data.ported).toHaveLength(10);
    expect(data.remaining).toEqual([]);
    expect(data.ported).not.toContain('derive');
  });

  it('puts the headline count on stdout and the open rows on stderr in human mode', async () => {
    const run = await runDd(['derive', 'docs/open.dd.json#tasks'], { mode: 'human' });

    expect(run.out.trim()).toBe('[ ] docs/open.dd.json#tasks 3/5');
    expect(run.err).toContain('open: as-0005');
    expect(run.err).toContain('open: as-0006');
  });
});
