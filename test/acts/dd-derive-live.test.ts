import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPLETION_RELATIONS } from '../../src/acts/derive.js';
import { FakeClock } from '../../src/adapters/clock/fake-clock.js';
import { buildProgram } from '../../src/app.js';
import type { Envelope } from '../../src/output/envelope.js';
import type { CliIo, Writers } from '../../src/output/output-port.js';

/** This repo's `src/`, resolved from the test file rather than from the cwd — the
 * suite chdirs into a temporary corpus, so a relative path would move. */
const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../src');

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
            // The INBOUND-followed relation. Stored task -> criterion, which is
            // why a criterion's rollup has to walk it backwards.
            satisfies: { type: 'link', rel: 'satisfies' },
            // One cell per NON-followed relation class, so a test can point at a
            // broken neighbour through each of them separately. `implemented_by`
            // is deliberately outside the frozen five: it is the unknown-relation
            // case, and it must be refused by the conservative default rather
            // than by a name appearing in a list.
            proves: { type: 'link', rel: 'proven_by' },
            implements: { type: 'link', rel: 'implemented_by' },
            see: { type: 'link', rel: 'ref' },
          },
        },
      },
    },
    acceptance_criteria: {
      shape: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'state'],
          fields: {
            id: { type: 'string' },
            criterion: { type: 'text' },
            state: { type: 'state' },
            note: { type: 'string' },
            pressure: { type: 'link', rel: 'pressure' },
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

  it('degrades on a completion cycle, names every member and hop, and NEVER reports complete', async () => {
    const run = await runDd(['derive', 'docs/cycle-a.dd.json#phases']);
    const root = rootOf(run);

    expect(run.envelope?.status).toBe('degraded');
    const cycle = root.degradations.find((degradation) => degradation.reason === 'cycle');
    expect(cycle).toBeDefined();
    // The RELATION and DIRECTION of each hop, not just the member list: a loop
    // closed by `derives` and one closed by inbound `satisfies` are different
    // defects, and an author cannot act on a bare list of documents.
    expect(cycle?.detail).toBe(
      'completion cycle: docs/cycle-a.dd.json#phases -[derives outbound]-> docs/cycle-b.dd.json#phases -[derives outbound]-> docs/cycle-a.dd.json#phases',
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

/**
 * A criterion whose OWN row is stored `checked`, and a task in ANOTHER document
 * that points at it with `satisfies`.
 *
 * This is the shape the whole correction exists for, and every part of it is
 * load-bearing. The criterion is stored terminal, so a rollup that believes the
 * stored field reports complete. The constituting work lives in a different
 * file, so a walk that only follows edges FORWARDS never sees it. And the open
 * assertion sits one hop BELOW the task, so the answer is only right if the
 * inbound arm recurses rather than merely attaching a leaf.
 */
function writeSatisfiesCorpus(childState: string): void {
  write('docs/criteria.dd.json', {
    dd: { schema: 'probe/plan' },
    sections: [
      { name: 'meta', value: { title: 'Criteria' } },
      {
        name: 'acceptance_criteria',
        value: [{ id: 'ac-0001', criterion: 'the verb rolls up', state: 'checked' }],
      },
    ],
    references: [],
  });
  write('docs/work.dd.json', {
    dd: { schema: 'probe/plan' },
    sections: [
      { name: 'meta', value: { title: 'Work' } },
      {
        name: 'tasks',
        value: [
          {
            id: 'tk-5001',
            title: 'satisfier',
            state: 'checked',
            satisfies: 'criteria.dd.json#acceptance_criteria/ac-0001',
            done: '#done_when/tk-5001',
          },
        ],
      },
      { name: 'done_when', value: { 'tk-5001': [assertion('as-5001', childState)] } },
    ],
    references: [],
  });
}

describe('ddocs derive — the ruled relation set', () => {
  it('names the followed relations and their directions in exactly one table', () => {
    // The table IS the contract, so it is asserted directly rather than
    // re-derived from behaviour — a behavioural-only pin cannot tell "the table
    // says this" apart from "some call site happens to agree".
    expect(COMPLETION_RELATIONS).toEqual({ derives: 'outbound', satisfies: 'inbound' });

    // Every relation dd knows about is ruled ON or ruled OUT, with nothing
    // undecided: the three excluded built-ins are excluded BY ABSENCE, which is
    // the same mechanism that excludes a relation invented tomorrow.
    for (const rel of ['pressure', 'proven_by', 'ref', 'implemented_by', 'invented-today']) {
      expect(Object.keys(COMPLETION_RELATIONS)).not.toContain(rel);
    }
  });

  it('carries no second relation set anywhere in the verb', () => {
    // The failure mode this closes is a call site that re-states `'derives'` and
    // then drifts from the table. The table's keys are bare identifiers, so a
    // QUOTED relation name in this file can only be a second set — and it would
    // be invisible to every behavioural test until the two disagreed.
    const source = readFileSync(join(SRC_ROOT, 'acts/derive.ts'), 'utf8');
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    for (const rel of ['derives', 'satisfies', 'proven_by', 'pressure', 'ref']) {
      expect([...stripped.matchAll(new RegExp(`['"\`]${rel}['"\`]`, 'g'))], rel).toEqual([]);
    }
    // Not vacuous: the table itself is still there, spelled the one legal way.
    expect(stripped).toContain('COMPLETION_RELATIONS');
    expect(stripped).toMatch(/\n\s+derives: 'outbound',\n\s+satisfies: 'inbound',/);
  });
});

describe('ddocs derive — inbound satisfies is followed, and only inbound', () => {
  it('recursively exposes the inbound satisfier and everything beneath it', async () => {
    writeSatisfiesCorpus('unchecked');

    const run = await runDd(['derive', 'docs/criteria.dd.json#acceptance_criteria/ac-0001']);
    const root = rootOf(run);

    // The criterion's OWN row is stored `checked`. Believing it is exactly the
    // defect this verb exists to catch.
    const stored = read('docs/criteria.dd.json').sections.find(
      (section) => section.name === 'acceptance_criteria',
    );
    expect((stored?.value as Array<{ state: string }>)[0]?.state).toBe('checked');

    expect(run.envelope?.status).toBe('ok');
    expect(root.complete).toBe(false);
    // The child is a NODE, reached across a document boundary, and it carries
    // its own child in turn — a flat attachment would stop one level short.
    expect(root.nodes.map((node) => node.address)).toEqual(['docs/work.dd.json#tasks/tk-5001']);
    expect(root.nodes[0]?.nodes.map((node) => node.address)).toEqual([
      'docs/work.dd.json#done_when/tk-5001',
    ]);
    // 1 criterion row + 1 task row + 1 assertion.
    expect(root.total).toBe(3);
    expect(root.incomplete).toEqual([
      {
        id: 'as-5001',
        address: 'docs/work.dd.json#done_when/tk-5001/as-5001',
        section: 'done_when',
        state: 'unchecked',
      },
    ]);
    expect(root.basis).toEqual(['docs/criteria.dd.json', 'docs/work.dd.json']);
    expect(root.degradations).toEqual([]);
  });

  it('does NOT follow satisfies outbound — a task never rolls up the criterion it serves', async () => {
    writeSatisfiesCorpus('unchecked');

    const run = await runDd(['derive', 'docs/work.dd.json#tasks/tk-5001']);
    const root = rootOf(run);

    // THE DIRECTION FIXTURE. If `satisfies` were followed outbound, the
    // criterion would appear here as a child, the total would be 3 instead of 2,
    // and `criteria.dd.json` would join the basis. Reversing the direction in
    // the table reddens all three of these at once.
    expect(root.nodes.map((node) => node.address)).toEqual(['docs/work.dd.json#done_when/tk-5001']);
    expect(root.total).toBe(2);
    expect(root.basis).toEqual(['docs/work.dd.json']);
    expect(root.incomplete.map((entry) => entry.id)).toEqual(['as-5001']);
    expect(run.envelope?.status).toBe('ok');
  });

  it('flips the parent to complete when ONLY the descendant row is closed', async () => {
    // THE NON-VACUITY PLANT, run as a pair. Nothing about the criterion changes
    // between these two runs — its stored row reads `checked` in both — so the
    // difference can only have come from the descendant.
    writeSatisfiesCorpus('unchecked');
    const before = rootOf(
      await runDd(['derive', 'docs/criteria.dd.json#acceptance_criteria/ac-0001']),
    );
    expect(before.complete).toBe(false);
    expect(before.incomplete.map((entry) => entry.id)).toEqual(['as-5001']);

    writeSatisfiesCorpus('checked');
    const after = rootOf(
      await runDd(['derive', 'docs/criteria.dd.json#acceptance_criteria/ac-0001']),
    );

    expect(after.complete).toBe(true);
    expect(after.incomplete).toEqual([]);
    expect(after.degradations).toEqual([]);
    // The tree is the SAME size — only a state value moved. A run that lost the
    // child would also report complete, and this is what tells them apart.
    expect(after.total).toBe(3);
    expect(after.nodes.map((node) => node.address)).toEqual(['docs/work.dd.json#tasks/tk-5001']);
  });

  it('reaches a section from a citer of a row inside it, but not one row from a citer of the section', async () => {
    writeSatisfiesCorpus('unchecked');
    // A second task cites the SECTION rather than the row.
    write('docs/broad.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Broad' } },
        {
          name: 'tasks',
          value: [
            {
              id: 'tk-5002',
              title: 'cites the section',
              state: 'unchecked',
              satisfies: 'criteria.dd.json#acceptance_criteria',
            },
          ],
        },
      ],
      references: [],
    });

    const row = rootOf(
      await runDd(['derive', 'docs/criteria.dd.json#acceptance_criteria/ac-0001']),
    );
    const section = rootOf(await runDd(['derive', 'docs/criteria.dd.json#acceptance_criteria']));

    // A citation of the SECTION does not constitute one particular row in it.
    expect(row.nodes.map((node) => node.address)).toEqual(['docs/work.dd.json#tasks/tk-5001']);
    // A citation of a ROW does constitute the section that holds it — so the
    // section sees BOTH citers.
    expect(section.nodes.map((node) => node.address)).toEqual([
      'docs/broad.dd.json#tasks/tk-5002',
      'docs/work.dd.json#tasks/tk-5001',
    ]);
    expect(section.incomplete.map((entry) => entry.id)).toEqual(['tk-5002', 'as-5001']);
  });
});

describe('ddocs derive — unfollowed relations never touch the answer', () => {
  /** The neighbour every unfollowed cell points at: unreadable AND unchecked. */
  function writeRubble(): void {
    write('docs/rubble.dd.json', {
      dd: { schema: 'nobody/knows' },
      sections: [{ name: 'tasks', value: [{ id: 'tk-6666', state: 'unchecked' }] }],
      references: [],
    });
  }

  it.each([
    ['proven_by', 'proves'],
    ['implemented_by', 'implements'],
    ['ref', 'see'],
  ])('leaves a broken %s neighbour out of nodes, basis and totals', async (_rel, field) => {
    writeRubble();
    write('docs/holder.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Holder' } },
        {
          name: 'tasks',
          value: [
            {
              id: 'tk-6001',
              title: 'points sideways',
              state: 'checked',
              [field]: 'rubble.dd.json#tasks',
            },
          ],
        },
      ],
      references: [],
    });

    const run = await runDd(['derive', 'docs/holder.dd.json#tasks']);
    const root = rootOf(run);

    // The neighbour is BOTH unreadable and open. Following it would degrade the
    // envelope AND add an incomplete row, so `ok` + `complete` + a basis of one
    // is three independent proofs it was not followed.
    expect(run.envelope?.status).toBe('ok');
    expect(root.complete).toBe(true);
    expect(root.total).toBe(1);
    expect(root.nodes).toEqual([]);
    expect(root.degradations).toEqual([]);
    expect(root.basis).toEqual(['docs/holder.dd.json']);
  });

  it('leaves a broken pressure neighbour out, and tolerates the not-applicable sentinel beside it', async () => {
    writeRubble();
    write('docs/pressured.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Pressured' } },
        {
          name: 'acceptance_criteria',
          value: [
            {
              id: 'ac-6001',
              criterion: 'measured',
              state: 'checked',
              pressure: 'rubble.dd.json#tasks',
            },
            // The non-address sentinel, sitting in a followed rollup. It is not
            // an address, and a table that treated `pressure` as followable
            // would have to decide what to do with it.
            {
              id: 'ac-6002',
              criterion: 'unmeasured',
              state: 'checked',
              pressure: 'not-applicable',
            },
          ],
        },
      ],
      references: [],
    });

    const run = await runDd(['derive', 'docs/pressured.dd.json#acceptance_criteria']);
    const root = rootOf(run);

    expect(run.envelope?.status).toBe('ok');
    expect(root.complete).toBe(true);
    expect(root.total).toBe(2);
    expect(root.nodes).toEqual([]);
    expect(root.basis).toEqual(['docs/pressured.dd.json']);
  });

  it('ignores an unfollowed edge that points back INTO the rollup, so it cannot double-count', async () => {
    writeSatisfiesCorpus('unchecked');
    // A `proven_by` citer of the criterion, carrying an open row of its own. If
    // the inbound arm keyed on "any edge that reaches me" instead of on the
    // relation table, this row would join the total.
    write('docs/evidence.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Evidence' } },
        {
          name: 'tasks',
          value: [
            {
              id: 'tk-6002',
              title: 'evidences it',
              state: 'unchecked',
              proves: 'criteria.dd.json#acceptance_criteria/ac-0001',
            },
          ],
        },
      ],
      references: [],
    });

    const root = rootOf(
      await runDd(['derive', 'docs/criteria.dd.json#acceptance_criteria/ac-0001']),
    );

    expect(root.total).toBe(3);
    expect(root.nodes.map((node) => node.address)).toEqual(['docs/work.dd.json#tasks/tk-5001']);
    expect(root.incomplete.map((entry) => entry.id)).toEqual(['as-5001']);
    expect(root.basis).not.toContain('docs/evidence.dd.json');
  });
});

describe('ddocs derive — conservative failure on a FOLLOWED inbound path', () => {
  it('degrades when a document below an inbound satisfier is missing, and flips when it appears', async () => {
    write('docs/ac-host.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Host' } },
        {
          name: 'acceptance_criteria',
          value: [{ id: 'ac-7001', criterion: 'reachable', state: 'checked' }],
        },
      ],
      references: [],
    });
    write('docs/worker.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Worker' } },
        {
          name: 'tasks',
          value: [
            {
              id: 'tk-7001',
              title: 'satisfier with a hole below it',
              state: 'checked',
              satisfies: 'ac-host.dd.json#acceptance_criteria/ac-7001',
              done: 'absent.dd.json#tasks',
            },
          ],
        },
      ],
      references: [],
    });

    const before = await runDd(['derive', 'docs/ac-host.dd.json#acceptance_criteria/ac-7001']);
    const broken = rootOf(before);

    // The failure is two hops away and reached THROUGH the inbound arm, so this
    // proves the arm propagates degradations rather than merely attaching nodes.
    expect(before.envelope?.status).toBe('degraded');
    expect(before.code).toBe(0);
    expect(broken.complete).toBe(false);
    expect(broken.degradations).toEqual([
      {
        reason: 'descendant-unreadable',
        address: 'docs/absent.dd.json#tasks',
        detail: expect.stringContaining('absent.dd.json'),
      },
    ]);
    expect(broken.incomplete.map((entry) => entry.address)).toContain('docs/absent.dd.json#tasks');
    expect(broken.incomplete.at(-1)).not.toHaveProperty('state');
    // The consulted-but-missing path is in the basis: creating it changes this
    // answer, so a consumer keying re-derivation on the basis must watch it.
    expect(broken.basis).toEqual([
      'docs/absent.dd.json',
      'docs/ac-host.dd.json',
      'docs/worker.dd.json',
    ]);

    write('docs/absent.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Present' } },
        { name: 'tasks', value: [{ id: 'tk-7002', title: 'here now', state: 'checked' }] },
      ],
      references: [],
    });

    const after = await runDd(['derive', 'docs/ac-host.dd.json#acceptance_criteria/ac-7001']);
    const repaired = rootOf(after);
    expect(after.envelope?.status).toBe('ok');
    expect(repaired.complete).toBe(true);
    expect(repaired.degradations).toEqual([]);
    expect(repaired.total).toBe(3);
  });

  it('degrades SEPARATELY, with its own reason, when a document below an inbound satisfier will not resolve its schema', async () => {
    write('docs/ac-host2.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Host' } },
        {
          name: 'acceptance_criteria',
          value: [{ id: 'ac-7003', criterion: 'reachable', state: 'checked' }],
        },
      ],
      references: [],
    });
    write('docs/worker2.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Worker' } },
        {
          name: 'tasks',
          value: [
            {
              id: 'tk-7004',
              title: 'satisfier over a stranger',
              state: 'checked',
              satisfies: 'ac-host2.dd.json#acceptance_criteria/ac-7003',
              done: 'alien.dd.json#tasks',
            },
          ],
        },
      ],
      references: [],
    });
    write('docs/alien.dd.json', {
      dd: { schema: 'nobody/knows' },
      sections: [{ name: 'tasks', value: [{ id: 'tk-7005', state: 'checked' }] }],
      references: [],
    });

    const run = await runDd(['derive', 'docs/ac-host2.dd.json#acceptance_criteria/ac-7003']);
    const root = rootOf(run);

    expect(run.envelope?.status).toBe('degraded');
    expect(root.complete).toBe(false);
    // A DIFFERENT reason from the missing-document case — collapsing the two
    // would tell an author to create a file that already exists.
    expect(root.degradations.map((degradation) => degradation.reason)).toEqual([
      'descendant-schema-unresolved',
    ]);
    expect(root.degradations[0]?.address).toBe('docs/alien.dd.json#tasks');
    const alien = root.nodes[0]?.nodes.find((node) => node.address === 'docs/alien.dd.json#tasks');
    expect(alien?.gate_terminal).toEqual([]);
  });
});

describe('ddocs derive — cycles across mixed directions', () => {
  beforeEach(() => {
    write('docs/loop-ac.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Loop AC' } },
        {
          name: 'acceptance_criteria',
          value: [{ id: 'ac-9001', criterion: 'loops back', state: 'checked' }],
        },
      ],
      references: [],
    });
    // satisfies INBOUND to the criterion, then derives OUTBOUND straight back to
    // it: the loop only exists if BOTH directions are followed, so it cannot be
    // found by a walker that follows one.
    write('docs/loop-task.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Loop task' } },
        {
          name: 'tasks',
          value: [
            {
              id: 'tk-9001',
              title: 'satisfies and derives from the same row',
              state: 'checked',
              satisfies: 'loop-ac.dd.json#acceptance_criteria/ac-9001',
              done: 'loop-ac.dd.json#acceptance_criteria/ac-9001',
            },
          ],
        },
      ],
      references: [],
    });
    write('docs/loop-side.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Side' } },
        {
          name: 'tasks',
          value: [
            {
              id: 'tk-9002',
              title: 'independent satisfier',
              state: 'checked',
              satisfies: 'loop-ac.dd.json#acceptance_criteria/ac-9001',
              done: '#done_when/tk-9002',
            },
          ],
        },
        { name: 'done_when', value: { 'tk-9002': [assertion('as-9002', 'checked')] } },
      ],
      references: [],
    });
  });

  it('names every member AND the relation and direction of every hop', async () => {
    const run = await runDd(['derive', 'docs/loop-ac.dd.json#acceptance_criteria/ac-9001']);
    const root = rootOf(run);

    expect(run.envelope?.status).toBe('degraded');
    const cycle = root.degradations.find((degradation) => degradation.reason === 'cycle');
    expect(cycle?.detail).toBe(
      'completion cycle: docs/loop-ac.dd.json#acceptance_criteria/ac-9001' +
        ' -[satisfies inbound]-> docs/loop-task.dd.json#tasks/tk-9001' +
        ' -[derives outbound]-> docs/loop-ac.dd.json#acceptance_criteria/ac-9001',
    );
  });

  it('never reports complete even though every readable row is terminal, and keeps the side branch', async () => {
    const root = rootOf(
      await runDd(['derive', 'docs/loop-ac.dd.json#acceptance_criteria/ac-9001']),
    );

    // EVERY row in this corpus is terminal. A walk that merely stopped at the
    // loop would report complete with an empty incomplete list — which is the
    // defect, because a node whose completeness is defined by itself has no
    // trustworthy answer.
    expect(root.incomplete).toEqual([]);
    expect(root.complete).toBe(false);
    // Only the CYCLIC branch was cut. The independent satisfier was walked to
    // the bottom: 1 criterion + 2 task rows + 1 assertion.
    expect(root.nodes.map((node) => node.address)).toEqual([
      'docs/loop-side.dd.json#tasks/tk-9002',
      'docs/loop-task.dd.json#tasks/tk-9001',
    ]);
    const side = root.nodes.find((node) => node.address.includes('loop-side'));
    expect(side?.degradations).toEqual([]);
    expect(side?.nodes.map((node) => node.address)).toEqual([
      'docs/loop-side.dd.json#done_when/tk-9002',
    ]);
    expect(root.total).toBe(4);
  });
});

describe('ddocs derive — cycles the rollup tree cannot see', () => {
  /**
   * The CROSS-EDGE shape, and the one a spanning tree is blind to.
   *
   * `dia-root` has two inbound `satisfies` citers, `dia-a` and `dia-b`; both
   * derive from `dia-c`; and when `closesLoop`, `dia-c` derives back to `dia-b`.
   *
   * Every row is terminal, so nothing here is open. The loop `dia-b -> dia-c ->
   * dia-c` is invisible to the tree for two compounding reasons: the tree keeps
   * one parent per node, so `dia-c` hangs off `dia-a` and the `dia-b -> dia-c`
   * edge is never a tree edge; and the double-count guard then SUPPRESSES that
   * second edge outright, discarding the evidence before the question is asked.
   * The answer was `ok` / `complete: true` / `total: 4` / no degradations.
   */
  function writeDiamond(closesLoop: boolean): void {
    write('docs/dia-root.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'Diamond root' } },
        {
          name: 'acceptance_criteria',
          value: [{ id: 'ac-000d', criterion: 'two citers', state: 'checked' }],
        },
      ],
      references: [],
    });
    const citer = (id: string) => ({
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: id } },
        {
          name: 'tasks',
          value: [
            {
              id,
              title: id,
              state: 'checked',
              satisfies: 'dia-root.dd.json#acceptance_criteria/ac-000d',
              done: 'dia-c.dd.json#tasks/tk-000c',
            },
          ],
        },
      ],
      references: [],
    });
    write('docs/dia-a.dd.json', citer('tk-000a'));
    write('docs/dia-b.dd.json', citer('tk-000b'));
    write('docs/dia-c.dd.json', {
      dd: { schema: 'probe/plan' },
      sections: [
        { name: 'meta', value: { title: 'shared target' } },
        {
          name: 'tasks',
          value: [
            {
              id: 'tk-000c',
              title: 'tk-000c',
              state: 'checked',
              ...(closesLoop && { done: 'dia-b.dd.json#tasks/tk-000b' }),
            },
          ],
        },
      ],
      references: [],
    });
  }

  it('degrades on a cycle closed by a CROSS edge, though every readable row is terminal', async () => {
    writeDiamond(true);

    const run = await runDd(['derive', 'docs/dia-root.dd.json#acceptance_criteria/ac-000d']);
    const root = rootOf(run);

    // Nothing is open anywhere in this corpus, so `incomplete` is empty and the
    // ONLY thing that can refuse completeness is the loop. A rollup that decides
    // cycles from its own tree reports ok/true/4 here.
    expect(run.envelope?.status).toBe('degraded');
    expect(root.incomplete).toEqual([]);
    expect(root.complete).toBe(false);
    expect(root.degradations).toEqual([
      {
        reason: 'cycle',
        // The row whose cell CLOSES the loop — the one an author can change.
        address: 'docs/dia-b.dd.json#tasks/tk-000b',
        detail:
          'completion cycle: docs/dia-c.dd.json#tasks/tk-000c' +
          ' -[derives outbound]-> docs/dia-b.dd.json#tasks/tk-000b' +
          ' -[derives outbound]-> docs/dia-c.dd.json#tasks/tk-000c',
      },
    ]);
    // ONE rollup tree still, with the same totals and the same flattening: the
    // cycle pass reports, it does not re-shape or double-count.
    expect(root.total).toBe(4);
    expect(root.nodes.map((node) => node.address)).toEqual([
      'docs/dia-a.dd.json#tasks/tk-000a',
      'docs/dia-b.dd.json#tasks/tk-000b',
    ]);
    // The pre-pass reads the graph but must not widen what the answer rests on.
    expect(root.basis).toEqual([
      'docs/dia-a.dd.json',
      'docs/dia-b.dd.json',
      'docs/dia-c.dd.json',
      'docs/dia-root.dd.json',
    ]);
  });

  it('leaves a plain diamond alone — a shared target is not a loop', async () => {
    // THE GUARD ON THE GUARD. Break only the closing edge and everything else
    // stays identical: same four documents, same two citers, same shared target,
    // same totals. If this also degraded, the test above would be passing for
    // the wrong reason — "any node reached twice" rather than "a cycle".
    writeDiamond(false);

    const run = await runDd(['derive', 'docs/dia-root.dd.json#acceptance_criteria/ac-000d']);
    const root = rootOf(run);

    expect(run.envelope?.status).toBe('ok');
    expect(root.complete).toBe(true);
    expect(root.degradations).toEqual([]);
    expect(root.total).toBe(4);
  });

  it('reports a cross-edge cycle once, deterministically, however many runs', async () => {
    writeDiamond(true);
    const first = await runDd(['derive', 'docs/dia-root.dd.json#acceptance_criteria/ac-000d']);
    const second = await runDd(['derive', 'docs/dia-root.dd.json#acceptance_criteria/ac-000d']);

    expect(second.out).toBe(first.out);
    // Exactly ONE degradation: a back edge can be reached by several DFS paths,
    // and reporting the same loop twice would double-count the defect.
    expect(rootOf(first).degradations).toHaveLength(1);
  });
});

describe('ddocs derive — determinism', () => {
  it('emits byte-identical output for two runs over an unchanged inbound rollup', async () => {
    writeSatisfiesCorpus('unchecked');
    const first = await runDd(['derive', 'docs/criteria.dd.json#acceptance_criteria/ac-0001']);
    const second = await runDd(['derive', 'docs/criteria.dd.json#acceptance_criteria/ac-0001']);

    expect(second.out).toBe(first.out);
    expect(first.out.length).toBeGreaterThan(200);
    expect(rootOf(first).total).toBe(3);
  });

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
