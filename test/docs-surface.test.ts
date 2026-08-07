import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureBuilt, parseEnvelope, repoRoot, runDd } from './support/run-cli.js';

/**
 * The README and the ported `docs/how/dd/` reference (plan 001 tk-0006, ac-000a).
 *
 * Documentation rots silently, which is the whole reason it is asserted here
 * rather than reviewed once. The strongest row is the last: the README's quick
 * start is EXTRACTED FROM THE README ITSELF and executed against the shipped
 * bin, so an example that stops working stops the build.
 */

const README = readFileSync(join(repoRoot, 'README.md'), 'utf8');
const BAKED = ['dd-overview', 'how-to-add-a-schema'] as const;

describe('README', () => {
  it('covers the four things a standalone reader needs', () => {
    // Section presence, not prose: each of these is a promise tk-0006 made.
    expect(README).toContain('## Install');
    expect(README).toContain('npm install -g @ai-substrate/dd');
    expect(README).toContain('## Quick start');
    expect(README).toContain('## The envelope contract');
    expect(README).toContain('## The `.dd` resolution ladder');
  });

  it('states the envelope contract with its exit-code map', () => {
    for (const status of ['ok', 'degraded', 'unconfigured', 'error']) {
      expect(README).toContain(`\`${status}\``);
    }
    // The two rules the code enforces — a reader must not have to discover them.
    expect(README).toMatch(/next_action.*REQUIRED/s);
    expect(README).toContain('Never fake success');
  });

  it('lists the resolution ladder in precedence order', () => {
    const ladder = README.slice(README.indexOf('## The `.dd` resolution ladder'));
    const order = ["document's own folder", '<gitroot>/.dd', '<gitroot>/.harness/.dd', '~/.dd'];
    let cursor = -1;
    for (const root of order) {
      const at = ladder.indexOf(root);
      expect(at, `resolution root missing or out of order: ${root}`).toBeGreaterThan(cursor);
      cursor = at;
    }
    expect(ladder).toContain('first hit wins');
  });

  it('shows the binary’s own name in every command example', () => {
    // The rename (tk-0003) is worthless if the README teaches the old form.
    expect(README).not.toContain('harness dd');
  });

  it('resolves every relative link it makes', () => {
    const pages = [
      'README.md',
      'docs/how/dd/README.md',
      ...BAKED.map((id) => `docs/how/dd/${id}.md`),
    ];
    const broken: string[] = [];
    for (const page of pages) {
      const text = readFileSync(join(repoRoot, page), 'utf8');
      for (const [, , target] of text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const path = target.split('#')[0];
        if (!path) continue;
        if (!existsSync(resolve(repoRoot, dirname(page), path))) broken.push(`${page} → ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('docs/how/dd', () => {
  it('carries both baked entries, byte-verbatim beneath their header', () => {
    for (const id of BAKED) {
      const ported = readFileSync(join(repoRoot, 'docs', 'how', 'dd', `${id}.md`), 'utf8');
      const source = readFileSync(join(repoRoot, 'src', 'docs', 'content', `${id}.md`), 'utf8');
      // A port, not a rewrite: the copy is a header plus the source, unchanged.
      expect(ported.endsWith(source)).toBe(true);
      expect(ported.startsWith('<!--')).toBe(true);
      expect(ported).toContain(`dd docs get ${id}`);
    }
  });

  it('serves the same ids the CLI does, so the two cannot diverge silently', () => {
    const listed = parseEnvelope(runDd(['docs', 'list', '--json']).stdout);
    const ids = (listed.data as { docs: { id: string }[] }).docs.map((doc) => doc.id).sort();
    expect(ids).toEqual([...BAKED].sort());
    for (const id of ids) {
      expect(existsSync(join(repoRoot, 'docs', 'how', 'dd', `${id}.md`))).toBe(true);
    }
  });
});

/**
 * Pull the README's own quick-start out of the README and run it. Everything
 * below comes from the document under test — nothing is retyped here, because a
 * retyped copy is exactly the thing that drifts.
 */
function heredocs(markdown: string): string[] {
  return [...markdown.matchAll(/<<'JSON'\n([\s\S]*?)\nJSON\n/g)].map((match) => match[1]);
}

describe('the README quick start actually works', () => {
  let workspace: string;

  beforeAll(() => {
    ensureBuilt();
    workspace = mkdtempSync(join(tmpdir(), 'dd-readme-'));
  }, 120_000);

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('runs the documented schema, document and commands end to end', () => {
    const blocks = heredocs(README);
    // Non-vacuity: if the README stopped carrying the two examples, this row
    // would otherwise pass by testing nothing at all.
    expect(blocks.length, 'README must carry the schema and document examples').toBe(2);
    const [schema, document] = blocks;
    expect(schema).toContain('"dd_schema": 1');
    expect(document).toContain('"schema": "review/checklist"');

    // The README's own layout: `.dd/schemas/<pkg>/<schema>/schema.json`.
    const schemaDir = join(workspace, '.dd', 'schemas', 'review', 'checklist');
    mkdirSync(schemaDir, { recursive: true });
    writeFileSync(join(schemaDir, 'schema.json'), `${schema}\n`);
    writeFileSync(join(workspace, 'review.dd.json'), `${document}\n`);

    // Relative paths throughout: on macOS an absolute temp path resolves via
    // /private and is judged outside the repository root (E429).
    const validated = runDd(['validate', 'review.dd.json', '--json'], { cwd: workspace });
    expect(parseEnvelope(validated.stdout).status).toBe('ok');
    expect(validated.code).toBe(0);

    const built = runDd(['build', 'review.dd.json', '--json'], { cwd: workspace });
    expect(parseEnvelope(built.stdout).status).toBe('ok');
    const rendered = readFileSync(join(workspace, 'review.dd.md'), 'utf8');
    expect(rendered).toContain('Release review');
    expect(rendered).toContain('Migration is reversible');

    // The documented read/write pair, including the schema-declared enum value.
    const read = runDd(['get', 'review.dd.json#items/dw-4e01/state', '--json'], { cwd: workspace });
    expect(parseEnvelope(read.stdout).status).toBe('ok');
    expect(read.stdout).toContain('waived');

    const written = runDd(['set', 'review.dd.json#items/dw-4e01/state', 'approved', '--json'], {
      cwd: workspace,
    });
    expect(parseEnvelope(written.stdout).status).toBe('ok');
    expect(written.code).toBe(0);
    expect(
      JSON.parse(readFileSync(join(workspace, 'review.dd.json'), 'utf8')).sections[1].value[1]
        .state,
    ).toBe('approved');
  });

  it('refuses a value the documented schema does not allow', () => {
    // The README claims `dd set` validates BEFORE writing and refuses, writing
    // nothing. That is a promise about behaviour, so it is asserted, not quoted.
    const before = readFileSync(join(workspace, 'review.dd.json'), 'utf8');
    const refused = runDd(['set', 'review.dd.json#items/dw-4e01/state', 'nonsense', '--json'], {
      cwd: workspace,
    });
    expect(refused.code).toBe(1);
    expect(parseEnvelope(refused.stdout).status).toBe('error');
    expect(readFileSync(join(workspace, 'review.dd.json'), 'utf8')).toBe(before);
  });
});
