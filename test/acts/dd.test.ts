import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeClock } from '../../src/adapters/clock/fake-clock.js';
import { buildProgram } from '../../src/app.js';
import type { Envelope } from '../../src/output/envelope.js';
import type { CliIo, Writers } from '../../src/output/output-port.js';

/** The CLI package dir — the cwd `just test` runs from, and the base fixture paths assume. */
const CLI_ROOT = fileURLToPath(new URL('../../', import.meta.url));

function deps() {
  return { clock: new FakeClock('2026-08-03T00:00:00.000Z') };
}

async function runDd(argv: string[]): Promise<{ envelope: Envelope; code: number }> {
  let out = '';
  let code = -1;
  const writers: Writers = {
    out: (text) => {
      out += text;
    },
    err: () => {},
  };
  const io: CliIo = { mode: 'json', writers };
  vi.spyOn(process, 'exit').mockImplementation(((value?: number) => {
    code = value ?? 0;
    throw new Error(`exit:${code}`);
  }) as never);
  await expect(
    buildProgram(io, deps()).parseAsync([
      'node',
      'dd',
      ...(argv[0] === 'dd' ? argv.slice(1) : argv),
    ]),
  ).rejects.toThrow(/^exit:/);
  vi.restoreAllMocks();
  return { envelope: JSON.parse(out.trim()) as Envelope, code };
}

describe('harness dd act surface', () => {
  // The two live `ddocs validate` rows below hand the act repo-relative fixture
  // paths, and the act resolves them against process.cwd() (house repo-root
  // convention). Pin cwd to the CLI package so this suite means the same thing
  // under `just test` (which cds to harness/cli) and under the repo's own root
  // vitest.config.ts — vitest's `root` option does NOT set process.cwd(). The
  // stub rows are cwd-agnostic, so the shared pin changes nothing they assert.
  let previousCwd = '';

  beforeEach(() => {
    previousCwd = process.cwd();
    process.chdir(CLI_ROOT);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    vi.restoreAllMocks();
  });

  it('registers the full frozen family and reserves ddocs from extensions', () => {
    const program = buildProgram(
      { mode: 'json', writers: { out: () => {}, err: () => {} } },
      deps(),
    );
    // ADAPTED: upstream the family hangs off a `dd` sub-command of `harness`.
    // Here the binary IS `ddocs`, so the program itself is the family root — and
    // `version`/`status` are this package's own verbs, which upstream has no
    // equivalent of, so the frozen family is asserted as a SUBSET in order.
    const dd = program;
    const family = dd.commands
      .map((command) => command.name())
      .filter((name) => name !== 'version' && name !== 'status');
    expect(family).toEqual([
      'validate',
      'schema',
      'docs',
      'build',
      'address',
      'link',
      'links',
      'graph',
      'doctor',
      // The writer family, added by the plan 070 Phase 1 surface renegotiation.
      'get',
      'set',
      'add',
      'rm',
    ]);
    expect(
      dd.commands.find((command) => command.name() === 'schema')?.commands.map((c) => c.name()),
    ).toEqual(['list', 'show']);
    expect(
      dd.commands.find((command) => command.name() === 'docs')?.commands.map((c) => c.name()),
    ).toEqual(['list', 'get']);
    expect(
      dd.commands.find((command) => command.name() === 'address')?.commands.map((c) => c.name()),
    ).toEqual(['generate', 'validate']);
    expect(
      dd.commands.find((command) => command.name() === 'link')?.commands.map((c) => c.name()),
    ).toEqual(['resolve', 'verify-basis']);
    // Upstream also asserts `RESERVED_NAMES.has('dd')` — the extensions registry
    // refusing to let a third-party verb shadow `harness dd`. This package has no
    // extension registry, and nothing can shadow the family because `dd` IS the
    // binary, so that half has no meaning here and is deliberately not ported.
  });

  // Every stub row is gone: Phase 2 filled five bodies, Phase 4 seven, and Phase 3
  // the last one (`ddocs build`), so the `unconfigured` table has no rows left to
  // assert and was removed with them. Each verb below must now answer with real
  // behaviour and its phase's exit mapping.
  it('ddocs validate runs live against a real document', async () => {
    const result = await runDd([
      'dd',
      'validate',
      'test/services/dd/schema/fixtures/chain/repo/docs/a.dd.json',
      '--depth',
      '0',
    ]);
    expect(result.code).toBe(0);
    expect(result.envelope.status).toBe('ok');
    expect(result.envelope.data).toMatchObject({
      schema: 'builder/plan',
      depth: 0,
      counts: { error: 0, warn: 0 },
    });
  });

  it('ddocs validate maps an ERROR-class finding to error/exit 1 with a frozen code', async () => {
    const result = await runDd([
      'dd',
      'validate',
      'test/services/dd/schema/fixtures/chain/repo/docs/d.dd.json',
      '--depth',
      '0',
    ]);
    expect(result.code).toBe(1);
    expect(result.envelope.status).toBe('error');
    expect(result.envelope.error?.code).toBe('E408');
  });

  it('ddocs schema list resolves live and always reports the roots it searched', async () => {
    const result = await runDd(['dd', 'schema', 'list']);
    expect(result.code).toBe(0);
    expect(['ok', 'degraded']).toContain(result.envelope.status);
    const data = result.envelope.data as { roots: { kind: string }[] };
    expect(data.roots.map((root) => root.kind)).toEqual(
      expect.arrayContaining(['gitroot', 'harness']),
    );
  });

  it('ddocs schema show reports an absent qualified name as E410', async () => {
    const result = await runDd(['dd', 'schema', 'show', 'builder/no-such-schema-p2']);
    expect(result.code).toBe(1);
    expect(result.envelope.status).toBe('error');
    expect(result.envelope.error?.code).toBe('E410');
  });

  it('ddocs docs list enumerates the baked corpus', async () => {
    const result = await runDd(['dd', 'docs', 'list']);
    expect(result.code).toBe(0);
    expect(result.envelope.status).toBe('ok');
    const data = result.envelope.data as { docs: { id: string; summary: string }[] };
    expect(data.docs.map((doc) => doc.id)).toEqual([
      'dd-overview',
      'how-to-add-a-schema',
      'how-to-use-and-extend-the-sdk',
      'deterministic-documents',
    ]);
    for (const doc of data.docs) expect(doc.summary.length).toBeGreaterThan(20);
  });

  it('ddocs docs get returns one baked doc, and E419 for an unknown id', async () => {
    const found = await runDd(['dd', 'docs', 'get', 'how-to-add-a-schema']);
    expect(found.code).toBe(0);
    expect((found.envelope.data as { content: string }).content).toContain('How to add a schema');

    const missing = await runDd(['dd', 'docs', 'get', 'not-a-doc']);
    expect(missing.code).toBe(1);
    expect(missing.envelope.error?.code).toBe('E419');
  });

  // Phase 3 filled this one body. The end-to-end behaviour lives in
  // `dd-build.test.ts` (drift, writing, adapters, refresh, the mutating-verb seam);
  // what this row holds is the act surface itself — that `build` answers, and
  // answers with the T006(b) exit mapping.
  it('ddocs build checks a rendered sibling for drift without writing', async () => {
    // This suite pins cwd to the CLI package, but a dd document resolves its
    // schema from ITS OWN repo root — and the render fixtures are real repo
    // shapes, with `.dd/schemas` at the fixture's root rather than inside `docs/`.
    // So this row enters that root; the describe's afterEach restores cwd either way.
    process.chdir(`${CLI_ROOT}test/services/dd/render/fixtures/limits/repo`);
    const result = await runDd(['dd', 'build', 'docs/limits.dd.json', '--check']);
    expect(result.code).toBe(0);
    expect(result.envelope.status).toBe('ok');
    expect(result.envelope.data).toMatchObject({ schema: 'render/limits', drift: false });
  });

  // Phase 4 filled these seven bodies. The end-to-end behaviour lives in
  // `dd-links-live.test.ts` (a real corpus in a temp directory); what these rows
  // hold is the act surface itself — that each command answers, and answers with
  // the frozen exit contract.
  it('ddocs address generate returns the canonical bare-# form', async () => {
    const result = await runDd(['dd', 'address', 'generate', 'phases/ph-a1b2']);
    expect(result.code).toBe(0);
    expect(result.envelope.status).toBe('ok');
    expect(result.envelope.data).toMatchObject({
      address: '#phases/ph-a1b2',
      form: 'bare',
      segments: ['phases', 'ph-a1b2'],
    });
  });

  it('ddocs address validate checks syntax, and says it has not classified anything', async () => {
    const result = await runDd(['dd', 'address', 'validate', '#phases/ph-a1b2']);
    expect(result.code).toBe(0);
    expect(result.envelope.data).toMatchObject({ classified: false, form: 'bare' });

    const malformed = await runDd(['dd', 'address', 'validate', 'no-hash-here']);
    expect(malformed.code).toBe(1);
    expect(malformed.envelope.error?.code).toBe('E405');
  });

  it('ddocs link resolve refuses to invent a base document for a bare-# address', async () => {
    const result = await runDd(['dd', 'link', 'resolve', '#phases/ph-a1b2']);
    expect(result.code).toBe(1);
    expect(result.envelope.error?.code).toBe('E430');
    expect(result.envelope.next_action).toContain('<path>#<interior>');
  });

  it('ddocs link verify-basis resolves before it compares', async () => {
    const result = await runDd([
      'dd',
      'link',
      'verify-basis',
      '#phases/ph-a1b2',
      '--sha',
      'abc123',
    ]);
    expect(result.code).toBe(1);
    expect(result.envelope.error?.code).toBe('E430');
  });

  it('ddocs links reports a named document even when the sweep excludes it (OD-1)', async () => {
    const result = await runDd([
      'dd',
      'links',
      'test/services/dd/schema/fixtures/chain/repo/docs/b.dd.json',
    ]);
    expect(result.code).toBe(0);
    const data = result.envelope.data as {
      counts: { inbound: number; outbound: number };
      outbound: { address: string }[];
    };
    // Named on the command line, so its own edges are reported…
    expect(data.outbound.map((edge) => edge.address)).toEqual(['c.dd.json#meta']);
    // …while the inbound scan is a sweep, which skips fixture paths — so the
    // citer in the same folder is deliberately not counted.
    expect(data.counts.inbound).toBe(0);
  });

  it('ddocs graph emits mermaid directly, with no renderer in the path', async () => {
    const result = await runDd(['dd', 'graph']);
    expect(result.code).toBe(0);
    const mermaid = (result.envelope.data as { mermaid: string }).mermaid;
    expect(mermaid.startsWith('flowchart LR\n')).toBe(true);
  });

  it('ddocs doctor sweeps this package clean, excluding the committed fixture corpus', async () => {
    const result = await runDd(['dd', 'doctor']);
    expect(result.code).toBe(0);
    expect(result.envelope.status).toBe('ok');
    const data = result.envelope.data as {
      discovered: number;
      swept: number;
      counts: { error: number; warn: number };
    };
    // AC-15 in miniature: the corpus is discovered and then excluded, so a
    // repository can keep known-bad documents committed and still run green.
    //
    // ADAPTED: upstream asserts `swept === 0`, which holds there because every dd
    // document under `harness/cli` is a test fixture. This package is different —
    // it also holds REAL dd documents (this plan), which are swept for real. The
    // claim is therefore asserted the way it is actually true here, and this form
    // is the stronger one: `discovered > swept` proves exclusion happened, rather
    // than inferring it from a zero that a repo with no real documents would give
    // for free.
    expect(data.discovered).toBeGreaterThan(0);
    expect(data.swept).toBeGreaterThan(0);
    expect(data.discovered).toBeGreaterThan(data.swept);
    expect(data.counts).toEqual({ error: 0, warn: 0 });
  });
});
