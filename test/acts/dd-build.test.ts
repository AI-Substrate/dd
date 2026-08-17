import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { autoRegenerateSibling, siblingPath } from '../../src/acts/build.js';
import { FakeClock } from '../../src/adapters/clock/fake-clock.js';
import { buildProgram } from '../../src/app.js';
import type { Envelope } from '../../src/output/envelope.js';
import type { CliIo, Writers } from '../../src/output/output-port.js';

/** The CLI package dir — the cwd `just test` runs from, and the base fixture paths assume. */
const CLI_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURES = 'test/services/dd/render/fixtures';

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
 * Drive the REAL act over REAL files. `ddocs build` owns its own I/O adapters (the
 * `harness doctor` precedent, followed by every dd act), so this is the honest
 * end-to-end surface an agent calls — and it means the act resolves paths against
 * the PROCESS cwd, which every test here pins explicitly.
 */
async function runDd(argv: string[]): Promise<{ envelope: Envelope; code: number; err: string }> {
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
  return { envelope: JSON.parse(out.trim()) as Envelope, code, err };
}

describe('harness dd build — read-only checking', () => {
  let previousCwd = '';

  /**
   * Check mode never writes, so these run directly against the COMMITTED corpus —
   * a much stronger proof than a temp copy: it pins the goldens themselves. The
   * cwd is the fixture's own `repo/` because that is where its `.dd/schemas` live,
   * exactly as a real consumer repo's schemas sit at its git root.
   */
  function enter(fixtureCase: string): void {
    process.chdir(join(CLI_ROOT, FIXTURES, fixtureCase, 'repo'));
  }

  beforeEach(() => {
    previousCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(previousCwd);
    vi.restoreAllMocks();
  });

  it('reports no drift when the committed sibling is the render', async () => {
    enter('showcase');
    const result = await runDd(['dd', 'build', 'docs/showcase.dd.json', '--check']);
    expect(result.code).toBe(0);
    expect(result.envelope.status).toBe('ok');
    expect(result.envelope.data).toMatchObject({ schema: 'render/showcase', drift: false });
    // The showcase's live basis is deliberately out of date: a moved basis is
    // REPORTED, never a degradation — the view is still correct.
    const data = result.envelope.data as { refreshed_bases: { recorded: string }[] };
    expect(data.refreshed_bases.map((basis) => basis.recorded)).toEqual(['sha-other']);
  });

  it('renders every committed golden in the corpus without drift', async () => {
    for (const [fixtureCase, document] of [
      ['showcase', 'docs/other.dd.json'],
      ['chain', 'docs/source.dd.json'],
      ['chain', 'docs/consumer.dd.json'],
      ['limits', 'docs/limits.dd.json'],
    ] as const) {
      enter(fixtureCase);
      const result = await runDd(['dd', 'build', document, '--check']);
      expect({ document, status: result.envelope.status, code: result.code }).toEqual({
        document,
        status: 'ok',
        code: 0,
      });
    }
  });

  it('fails with the frozen drift code when a human edited the generated sibling', async () => {
    enter('drift');
    const result = await runDd(['dd', 'build', 'docs/drift.dd.json', '--check']);
    expect(result.code).toBe(1);
    expect(result.envelope.status).toBe('error');
    expect(result.envelope.error?.code).toBe('E422');
    expect(result.envelope.next_action).toContain('ddocs build');
  });

  it('is degraded — never failed — by adapter issues, and names every one', async () => {
    enter('adapters');
    const result = await runDd(['dd', 'build', 'docs/adapters.dd.json', '--check']);
    expect(result.code).toBe(0);
    expect(result.envelope.status).toBe('degraded');
    const data = result.envelope.data as {
      drift: boolean;
      adapter_warnings: { type: string; code: string }[];
    };
    expect(data.drift).toBe(false);
    expect(data.adapter_warnings.map((warning) => warning.code).sort()).toEqual([
      'E423',
      'E424',
      'E424',
      'E425',
      'E426',
    ]);
  });

  it('never writes in check mode', async () => {
    const sibling = join(CLI_ROOT, FIXTURES, 'drift/repo/docs/drift.dd.md');
    const before = readFileSync(sibling, 'utf8');
    enter('drift');
    await runDd(['dd', 'build', 'docs/drift.dd.json', '--check']);
    expect(readFileSync(sibling, 'utf8')).toEqual(before);
  });

  it('maps every input failure to its frozen code', async () => {
    enter('drift');
    const missing = await runDd(['dd', 'build', 'docs/absent.dd.json', '--check']);
    expect(missing.code).toBe(1);
    expect(missing.envelope.error?.code).toBe('E429');

    const notADocument = await runDd([
      'dd',
      'build',
      '.dd/schemas/render/simple/schema.json',
      '--check',
    ]);
    expect(notADocument.code).toBe(1);
    expect(notADocument.envelope.error?.code).toBe('E429');
  });
});

describe('harness dd build — writing the sibling', () => {
  let previousCwd = '';
  let repo = '';

  beforeEach(() => {
    previousCwd = process.cwd();
    // A self-contained repo shape in a temp dir: the act anchors on the process
    // cwd, so this makes the temp dir the repo root and keeps every write off the
    // committed corpus — the fixtures stay the spec, never a scratch pad.
    repo = mkdtempSync(join(tmpdir(), 'dd-build-'));
    cpSync(join(CLI_ROOT, FIXTURES, 'drift/repo'), repo, { recursive: true });
    process.chdir(repo);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    rmSync(repo, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('regenerates a hand-edited sibling, and the regenerated file then checks clean', async () => {
    const written = await runDd(['dd', 'build', 'docs/drift.dd.json']);
    expect(written.code).toBe(0);
    expect(written.envelope.status).toBe('ok');
    expect(written.envelope.evidence?.[0]?.label).toBe('rendered markdown');

    const expected = readFileSync(
      join(CLI_ROOT, FIXTURES, 'drift/repo/docs/drift.expected.md'),
      'utf8',
    );
    expect(readFileSync(join(repo, 'docs/drift.dd.md'), 'utf8')).toEqual(expected);

    const rechecked = await runDd(['dd', 'build', 'docs/drift.dd.json', '--check']);
    expect(rechecked.code).toBe(0);
    expect(rechecked.envelope.status).toBe('ok');
  });

  it('renders byte-identically on a second run', async () => {
    await runDd(['dd', 'build', 'docs/drift.dd.json']);
    const first = readFileSync(join(repo, 'docs/drift.dd.md'), 'utf8');
    await runDd(['dd', 'build', 'docs/drift.dd.json']);
    expect(readFileSync(join(repo, 'docs/drift.dd.md'), 'utf8')).toEqual(first);
  });

  it('reports an unresolvable schema rather than writing a half-rendered file', async () => {
    writeFileSync(
      join(repo, 'docs/orphan.dd.json'),
      JSON.stringify({ dd: { schema: 'render/no-such' }, sections: [], references: [] }),
    );
    const result = await runDd(['dd', 'build', 'docs/orphan.dd.json']);
    expect(result.code).toBe(1);
    expect(result.envelope.error?.code).toBe('E401');
    expect(result.envelope.next_action).toContain('ddocs schema list');
  });

  it('refuses a document outside the repository root', async () => {
    const outside = join(previousCwd, 'package.json');
    const result = await runDd(['dd', 'build', outside, '--check']);
    expect(result.code).toBe(1);
    expect(result.envelope.error?.code).toBe('E429');
    expect(result.envelope.error?.message).toContain('outside the repository root');
  });
});

describe('autoRegenerateSibling — the mutating-verb seam', () => {
  let previousCwd = '';
  let repo = '';
  const warnings: string[] = [];
  const io: CliIo = {
    mode: 'json',
    writers: {
      out: () => {},
      err: (text) => {
        warnings.push(text);
      },
    },
  };

  beforeEach(() => {
    previousCwd = process.cwd();
    repo = mkdtempSync(join(tmpdir(), 'dd-regen-'));
    cpSync(join(CLI_ROOT, FIXTURES, 'drift/repo'), repo, { recursive: true });
    warnings.length = 0;
  });

  afterEach(() => {
    process.chdir(previousCwd);
    rmSync(repo, { recursive: true, force: true });
  });

  it('regenerates the sibling after a mutation', async () => {
    const result = await autoRegenerateSibling(`${repo}/docs/drift.dd.json`, repo, io);
    expect(result.regenerated).toBe(true);
    expect(warnings).toEqual([]);
    expect(readFileSync(join(repo, 'docs/drift.dd.md'), 'utf8')).toEqual(
      readFileSync(join(CLI_ROOT, FIXTURES, 'drift/repo/docs/drift.expected.md'), 'utf8'),
    );
  });

  it('warns and keeps going when the render cannot happen — a mutation is never rolled back', async () => {
    const result = await autoRegenerateSibling(`${repo}/docs/gone.dd.json`, repo, io);
    expect(result.regenerated).toBe(false);
    expect(result.reason).toContain('missing or unreadable');
    expect(warnings.join('')).toContain('warning: dd sibling not regenerated');
  });

  it('puts the sibling beside the document, whatever the document is called', () => {
    expect(siblingPath('/a/b/plan.dd.json')).toBe('/a/b/plan.dd.md');
    expect(siblingPath('/a/b/plain.json')).toBe('/a/b/plain.md');
  });
});

/**
 * The present / remove / restore arm, over a REAL nested corpus.
 *
 * The subject is a claim about the world, so the world is what moves: the target
 * file is deleted and put back on disk, and no assertion is edited between the
 * arms. A test that reached its red by changing what it expected would prove
 * only that the expectation is editable.
 */
describe('harness dd build — ordinary file targets', () => {
  let previousCwd = '';
  let repo = '';
  const DOCUMENT = 'docs/plans/nested/notes.dd.json';
  /** Repo-root anchored, exactly as the structured cell declares it. */
  const STRUCTURED = 'src/library.ts';
  /** Document-relative, exactly as the Markdown href in the `notes` cell reads. */
  const INCIDENTAL = 'docs/plans/handbook.md';

  interface FileFinding {
    class: string;
    severity: string;
    location: string;
    message: string;
    owner: string;
    code: string;
  }

  function findings(envelope: Envelope): FileFinding[] {
    return (envelope.data as { file_findings: FileFinding[] }).file_findings;
  }

  beforeEach(() => {
    previousCwd = process.cwd();
    repo = mkdtempSync(join(tmpdir(), 'dd-filelinks-'));
    cpSync(join(CLI_ROOT, FIXTURES, 'filelinks/repo'), repo, { recursive: true });
    process.chdir(repo);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    rmSync(repo, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('renders working sibling-relative hrefs and reports nothing when both targets are there', async () => {
    const result = await runDd(['dd', 'build', DOCUMENT, '--check']);
    expect(result.code).toBe(0);
    expect(result.envelope.status).toBe('ok');
    expect(findings(result.envelope)).toEqual([]);

    // The committed golden IS the href contract; `--check` passing means the
    // renderer produced those exact bytes. Then follow the href from the sibling's
    // own directory and prove it lands on a file that exists — a link that
    // resolves is the only definition of "working" that matters to a reader.
    const sibling = join(repo, 'docs/plans/nested/notes.dd.md');
    const markdown = readFileSync(sibling, 'utf8');
    const structured = markdown.match(/\[src\/library\.ts\]\(([^)]+)\)/)?.[1];
    const incidental = markdown.match(/\[handbook\]\(([^)]+)\)/)?.[1];
    expect(structured).toBe('../../../src/library.ts');
    expect(incidental).toBe('../handbook.md');
    expect(existsSync(join(repo, 'docs/plans/nested', structured ?? ''))).toBe(true);
    expect(existsSync(join(repo, 'docs/plans/nested', incidental ?? ''))).toBe(true);
  });

  it('degrades with exit 0 and exactly one WARN naming the authored path and owner', async () => {
    rmSync(join(repo, STRUCTURED));
    const missing = await runDd(['dd', 'build', DOCUMENT, '--check']);
    expect(missing.code).toBe(0);
    expect(missing.envelope.status).toBe('degraded');
    expect(findings(missing.envelope)).toEqual([
      {
        class: 'address-target-missing',
        severity: 'WARN',
        location: '$.sections[tasks].value[0].implemented_by',
        message: `file link target is missing: ${STRUCTURED}`,
        // `realpathSync`, because macOS hands `mkdtemp` a `/var` symlink and the
        // act reports the resolved path it actually read.
        owner: join(realpathSync(repo), DOCUMENT),
        code: 'E431',
      },
    ]);
    expect(missing.envelope.next_action).toContain('file link');
  });

  it('warns for the document-relative Markdown href on its own terms', async () => {
    rmSync(join(repo, INCIDENTAL));
    const missing = await runDd(['dd', 'build', DOCUMENT, '--check']);
    expect(missing.envelope.status).toBe('degraded');
    // The finding quotes what the AUTHOR wrote, not the absolute path dd
    // computed: `../handbook.md` is the string to go and fix.
    expect(findings(missing.envelope)).toEqual([
      expect.objectContaining({
        class: 'address-target-missing',
        message: 'file link target is missing: ../handbook.md',
        location: '$.sections[tasks].value[0].notes',
      }),
    ]);
  });

  it('clears the warning when the target is restored, with nothing else edited', async () => {
    const target = join(repo, STRUCTURED);
    const contents = readFileSync(target, 'utf8');
    rmSync(target);
    expect((await runDd(['dd', 'build', DOCUMENT, '--check'])).envelope.status).toBe('degraded');
    writeFileSync(target, contents);
    const restored = await runDd(['dd', 'build', DOCUMENT, '--check']);
    expect(restored.envelope.status).toBe('ok');
    expect(findings(restored.envelope)).toEqual([]);
  });

  it('keeps drift an error even while a file target is missing', async () => {
    // Precedence, stated as an ordering rather than assumed: a WARN degrades, and
    // drift still fails, so a degraded render can never mask stale committed
    // markdown.
    rmSync(join(repo, STRUCTURED));
    writeFileSync(join(repo, 'docs/plans/nested/notes.dd.md'), 'hand-edited\n');
    const result = await runDd(['dd', 'build', DOCUMENT, '--check']);
    expect(result.code).toBe(1);
    expect(result.envelope.status).toBe('error');
    expect(result.envelope.error?.code).toBe('E422');
  });

  it('degrades the WRITING path too, and still writes the sibling', async () => {
    rmSync(join(repo, STRUCTURED));
    const written = await runDd(['dd', 'build', DOCUMENT]);
    expect(written.code).toBe(0);
    expect(written.envelope.status).toBe('degraded');
    expect(findings(written.envelope)).toHaveLength(1);
    expect(readFileSync(join(repo, 'docs/plans/nested/notes.dd.md'), 'utf8')).toContain(
      '../../../src/library.ts',
    );
  });

  it('stays silent for a URL, a bare prose path, a fragment and an image', async () => {
    // All four live in the `summary` section of the same document, so this row is
    // green in every arm above as well — it is stated once, alone, so a failure
    // names the negative population instead of the positive one.
    rmSync(join(repo, STRUCTURED));
    rmSync(join(repo, INCIDENTAL));
    const result = await runDd(['dd', 'build', DOCUMENT, '--check']);
    expect(
      findings(result.envelope)
        .map((finding) => finding.location)
        .sort(),
    ).toEqual(['$.sections[tasks].value[0].implemented_by', '$.sections[tasks].value[0].notes']);
  });
});
