import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { describeRun, ensureBuilt, parseEnvelope, runDd } from '../support/run-cli.js';

/**
 * The jiti custom-type load path, proven end to end (plan 001, tk-0004 dw-0004).
 *
 * `jiti` is a RUNTIME dependency for exactly one reason: a schema may register a
 * custom render type by dropping a **TypeScript** file at
 * `<schema folder>/adapters/<type>.ts`, and the shipped CLI has to load and run
 * that untranspiled module. Nothing else in the package needs it, so nothing else
 * can prove it — a test that stubbed the loader would prove only the stub.
 *
 * So this builds a throwaway repo whose adapter is real TypeScript (typed
 * parameters, a type-only construct, an `export default`), never compiled by our
 * build, and asserts the adapter's output reached the rendered markdown. If jiti
 * were absent or mis-wired, the cell would fall back to its raw value and the
 * assertion would fail.
 */
const ADAPTER_SOURCE = `/**
 * Custom type \`duration\` — minutes in the data, human time in the render.
 * Deliberately written as TypeScript that Node cannot execute directly: the type
 * annotations and the interface below only survive because jiti transpiles it.
 */
interface AdapterContext {
  field: string;
}

export default function duration(value: unknown, ctx: AdapterContext): string {
  const minutes: number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) return \`⟨\${ctx.field}: not a duration⟩\`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  const parts: string[] = [];
  if (hours > 0) parts.push(\`\${hours}h\`);
  if (rest > 0 || parts.length === 0) parts.push(\`\${rest}m\`);
  return \`**\${parts.join(' ')}**\`;
}
`;

const SCHEMA = {
  dd_schema: 1,
  description: 'A minimal schema whose only point is one custom, jiti-loaded render type.',
  sections: {
    meta: {
      required: true,
      shape: {
        type: 'object',
        required: ['title'],
        fields: { title: { type: 'string' }, window: { type: 'duration' } },
      },
    },
  },
};

const DOCUMENT = {
  dd: { schema: 'demo/timing' },
  sections: [{ name: 'meta', value: { title: 'Custom type load', window: 2610 } }],
  references: [],
};

let repo: string;
/**
 * Addressed RELATIVE to `cwd`, deliberately. On macOS `mkdtemp` hands back a
 * `/var/...` (or `/tmp/...`) path while `process.cwd()` reports the resolved
 * `/private/...` one, so an absolute temp path is judged outside the repository
 * root and the build refuses with E429. A relative path is also how a user
 * actually invokes it.
 */
const DOC = 'timing.dd.json';

describe('jiti loads a custom render type from untranspiled TypeScript', () => {
  beforeAll(() => {
    ensureBuilt();
    repo = mkdtempSync(join(tmpdir(), 'dd-jiti-'));
    // The resolution convention is `<root>/schemas/<pkg>/<schema>/schema.json`;
    // the `schemas/` level is required, and the last two segments ARE the name.
    const schemaDir = join(repo, '.dd', 'schemas', 'demo', 'timing');
    mkdirSync(join(schemaDir, 'adapters'), { recursive: true });
    writeFileSync(join(schemaDir, 'schema.json'), JSON.stringify(SCHEMA, null, 2));
    // Registration is PRESENCE: this path IS the registration, no manifest.
    writeFileSync(join(schemaDir, 'adapters', 'duration.ts'), ADAPTER_SOURCE);
    writeFileSync(join(repo, DOC), JSON.stringify(DOCUMENT, null, 2));
  });

  afterAll(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('renders the adapter output rather than the raw value', () => {
    const cli = runDd(['--json', 'build', DOC], { cwd: repo });
    expect(parseEnvelope(cli).status, describeRun(cli)).toBe('ok');
    expect(cli.code, describeRun(cli)).toBe(0);

    const rendered = readFileSync(join(repo, 'timing.dd.md'), 'utf8');
    // 2610 minutes → "43h 30m", which only the TypeScript adapter can produce.
    expect(rendered).toContain('**43h 30m**');
    expect(rendered).not.toContain('2610');
  });

  it('falls back to the raw value when the adapter is absent (non-vacuity)', () => {
    // The proof above is only worth something if it can fail. Remove the single
    // TypeScript file and the same document must render 2610 verbatim: that is
    // what shows the assertion is detecting jiti's work and not a coincidence.
    const bare = mkdtempSync(join(tmpdir(), 'dd-jiti-bare-'));
    try {
      const schemaDir = join(bare, '.dd', 'schemas', 'demo', 'timing');
      mkdirSync(schemaDir, { recursive: true });
      writeFileSync(join(schemaDir, 'schema.json'), JSON.stringify(SCHEMA, null, 2));
      writeFileSync(join(bare, DOC), JSON.stringify(DOCUMENT, null, 2));

      runDd(['--json', 'build', DOC], { cwd: bare });
      const rendered = readFileSync(join(bare, 'timing.dd.md'), 'utf8');
      expect(rendered).toContain('2610');
      expect(rendered).not.toContain('**43h 30m**');
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});
