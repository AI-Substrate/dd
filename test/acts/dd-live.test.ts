import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeClock } from '../../src/adapters/clock/fake-clock.js';
import { buildProgram } from '../../src/app.js';
import type { Envelope } from '../../src/output/envelope.js';
import type { CliIo, Writers } from '../../src/output/output-port.js';

const CHAIN = 'test/services/dd/schema/fixtures/chain/repo/docs';
/** The CLI package dir — the cwd `just test` runs from, and the base `CHAIN` is relative to. */
const CLI_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * ADAPTED: upstream builds a full `VerbActDeps` (exec/fs/env/git/clock/proc)
 * because every harness act shares one dependency container. The dd acts are
 * composition roots in their own right — they construct their own
 * `NodeProcess`/`NodeSchemaFs` — so the clock is the only injected dependency
 * that reaches them, and the other fakes were never consulted on this path.
 */
function deps() {
  return { clock: new FakeClock('2026-08-03T00:00:00.000Z') };
}

/**
 * Drive the REAL act over the REAL fixture files (the house rule permits real fs
 * under `test/**\/fixtures/**`). The act owns its own I/O adapters, exactly like
 * `harness doctor`, so this is the honest end-to-end surface an agent will call.
 */
async function runDd(argv: string[], mode: 'json' | 'human' = 'json') {
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
  const io: CliIo = { mode, writers };
  vi.spyOn(process, 'exit').mockImplementation(((value?: number) => {
    code = value ?? 0;
    throw new Error(`exit:${code}`);
  }) as never);
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  try {
    await buildProgram(io, deps()).parseAsync([
      'node',
      'dd',
      ...(argv[0] === 'dd' ? argv.slice(1) : argv),
    ]);
    // `emitRawAndExit` deliberately returns instead of calling process.exit, so
    // a large piped payload is never truncated — that path lands here.
    code = process.exitCode ?? 0;
  } catch (error) {
    if (!/^exit:\d+$/.test(error instanceof Error ? error.message : '')) throw error;
  } finally {
    process.exitCode = previousExitCode;
    vi.restoreAllMocks();
  }
  return {
    out,
    err,
    code,
    envelope: mode === 'json' ? (JSON.parse(out.trim()) as Envelope) : null,
  };
}

describe('harness dd validate — live body (OD-2 handoff)', () => {
  // `ddocs validate` resolves its document argument against process.cwd() (the house
  // repo-root convention), so CHAIN's relative path only means what it says when
  // cwd is the CLI package. Pin it — the repo also ships a root vitest.config.ts,
  // and vitest's `root` option does NOT set process.cwd().
  let previousCwd = '';

  beforeEach(() => {
    previousCwd = process.cwd();
    process.chdir(CLI_ROOT);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    vi.restoreAllMocks();
  });

  it('walks exactly as far as --depth allows: 3 reaches the bad hop, 2 does not', async () => {
    const shallow = await runDd(['dd', 'validate', `${CHAIN}/a.dd.json`, '--depth', '2']);
    expect(shallow.code).toBe(0);
    expect(shallow.envelope?.status).toBe('ok');

    const deep = await runDd(['dd', 'validate', `${CHAIN}/a.dd.json`, '--depth', '3']);
    expect(deep.code).toBe(1);
    expect(deep.envelope?.status).toBe('error');
    expect(deep.envelope?.error?.code).toBe('E408');
    // The finding is OWNED by the document that must change — four hops away.
    const details = deep.envelope?.error?.details as { issues: { owner: string }[] };
    expect(details.issues[0]?.owner).toContain('d.dd.json');
  });

  it('defaults to depth 3 when --depth is not given', async () => {
    const result = await runDd(['dd', 'validate', `${CHAIN}/a.dd.json`]);
    expect((result.envelope?.error?.details as { depth: number }).depth).toBe(3);
  });

  it('maps WARN-only findings to degraded/exit 0, never to a hard failure', async () => {
    const result = await runDd(['dd', 'validate', `${CHAIN}/warn.dd.json`, '--depth', '0']);
    expect(result.code).toBe(0);
    expect(result.envelope?.status).toBe('degraded');
    const data = result.envelope?.data as {
      counts: { error: number; warn: number };
      issues: { class: string; severity: string; code: string }[];
    };
    expect(data.counts.error).toBe(0);
    expect(data.counts.warn).toBeGreaterThan(0);
    for (const issue of data.issues) {
      expect(issue.severity).toBe('WARN');
      expect(issue.code).toMatch(/^E4\d\d$/);
    }
  });

  it('reports an unresolvable schema as a hard E401', async () => {
    const result = await runDd(['dd', 'validate', `${CHAIN}/unknown.dd.json`, '--depth', '0']);
    expect(result.code).toBe(1);
    expect(result.envelope?.error?.code).toBe('E401');
    expect(result.envelope?.error?.message).toContain('builder/nowhere');
  });

  it('refuses a nonsense --depth instead of guessing one', async () => {
    const result = await runDd(['dd', 'validate', `${CHAIN}/a.dd.json`, '--depth', 'lots']);
    expect(result.code).toBe(1);
    expect(result.envelope?.error?.code).toBe('E108');
  });

  it('says so plainly when the document is missing', async () => {
    const result = await runDd(['dd', 'validate', `${CHAIN}/nope.dd.json`]);
    expect(result.code).toBe(1);
    expect(result.envelope?.error?.code).toBe('E400');
    expect(result.envelope?.error?.message).toContain('missing or unreadable');
  });

  it('never skips a document it was pointed at (OD-1)', async () => {
    // The fixture corpus is exactly what the doctor's sweep excludes; a direct
    // invocation must still fail on it, or `ddocs validate <bad fixture>` is a lie.
    const result = await runDd(['dd', 'validate', `${CHAIN}/d.dd.json`, '--depth', '0']);
    expect(result.code).toBe(1);
    expect(result.envelope?.error?.code).toBe('E408');
  });
});

describe('harness dd schema / docs — live bodies', () => {
  // `ddocs schema list`/`show` resolve from the repo root by convention (the house
  // cwd rule), so this group runs there — the suite's own cwd is `harness/cli`.
  const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
  let previousCwd = '';

  beforeEach(() => {
    previousCwd = process.cwd();
    process.chdir(REPO_ROOT);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    vi.restoreAllMocks();
  });

  it('reserves dd and keeps the family registered while the bodies go live', () => {
    // ADAPTED: upstream asserts `RESERVED_NAMES.has('dd')` — the extensions
    // registry refusing to let a third-party verb shadow `harness dd`. There is
    // no extension registry in this package, and nothing can shadow the family
    // because `dd` IS the binary. What survives is the half that still means
    // something here: the whole family is registered on the program.
    const program = buildProgram(
      { mode: 'json', writers: { out: () => {}, err: () => {} } },
      deps(),
    );
    const registered = program.commands.map((command) => command.name());
    for (const verb of ['validate', 'schema', 'docs', 'build', 'address', 'link', 'links']) {
      expect(registered, verb).toContain(verb);
    }
  });

  it('shows a resolved schema with its path, sections, enums and terminal set', async () => {
    const result = await runDd(['dd', 'schema', 'show', 'builder/plan']);
    expect(result.code).toBe(0);
    const data = result.envelope?.data as {
      path: string;
      root: string;
      gate_terminal: string[];
      sections: { name: string }[];
      enums: { name: string }[];
    };
    expect(data.path).toContain('/.dd/schemas/builder/plan/schema.json');
    expect(data.root).toBe('gitroot');
    expect(data.gate_terminal).toEqual(['checked', 'human-skipped', 'na']);
    expect(data.sections.map((section) => section.name)).toEqual(
      expect.arrayContaining(['meta', 'acceptance_criteria', 'phases', 'tasks', 'done_when']),
    );
    expect(data.enums.map((declared) => declared.name)).toEqual(
      expect.arrayContaining(['plan_status', 'complexity']),
    );
  });

  it('renders a human listing rather than a bare status line', async () => {
    const result = await runDd(['dd', 'schema', 'list'], 'human');
    expect(result.code).toBe(0);
    expect(result.out).toContain('ddocs schema — resolved schemas');
    expect(result.out).toContain('Roots searched (precedence order):');
  });

  it('dumps a baked doc verbatim in human mode, envelope-free', async () => {
    const result = await runDd(['dd', 'docs', 'get', 'dd-overview'], 'human');
    expect(result.code).toBe(0);
    expect(result.out.startsWith('# Deterministic documents (dd)')).toBe(true);
    expect(result.out).not.toContain('"status"');
  });
});

/**
 * F002: the acts must be wired to a `SchemaFs` that distinguishes "found
 * nothing" from "could not look". Proving that at the act boundary is the point
 * — a unit test of the adapter passes even if someone re-wires the act back to
 * the shared `NodeFs`, whose `readdir` swallows every error.
 */
describe('harness dd schema — an unscannable root is reported, not silently empty (F002)', () => {
  let tmp = '';
  let previousCwd = '';
  let previousHome: string | undefined;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'dd-act-loop-'));
    const root = join(tmp, '.dd');
    const pkg = join(root, 'schemas', 'builder', 'plan');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, 'schema.json'),
      JSON.stringify({ dd_schema: 1, description: 'probe', sections: {} }),
      'utf8',
    );
    // The root HAS the schema being asked for. Only the loop stops the scan
    // reaching it — so a swallowed error yields the worst possible answer: a
    // confident "no such schema" about a schema that is right there.
    symlinkSync('.', join(root, 'loop'));
  });

  afterAll(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  beforeEach(() => {
    previousCwd = process.cwd();
    previousHome = process.env.HOME;
    // Keep the scan hermetic: the home root must not wander into the real ~/.dd.
    process.env.HOME = join(tmp, 'home');
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    vi.restoreAllMocks();
  });

  it('reports E416 scan-failed, never a confident E410 not-found', async () => {
    const result = await runDd(['dd', 'schema', 'show', 'builder/plan']);

    expect(result.code).toBe(1);
    expect(result.envelope?.status).toBe('error');
    expect(result.envelope?.error?.code).toBe('E416');
  });
});
