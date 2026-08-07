import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Envelope, ensureBuilt, parseEnvelope, repoRoot, runDd } from './support/run-cli.js';

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
 * ---------------------------------------------------------------------------
 * The README quick start, EXECUTED FROM THE README.
 * ---------------------------------------------------------------------------
 *
 * The quick start is parsed into a transcript — `mkdir`, heredoc writes, and
 * `dd …` command lines — and every step is replayed against the shipped bin.
 * The commands are the README's own bytes: a verb that does not exist, an
 * address that stopped resolving or a flag that was renamed fails HERE.
 *
 * An earlier version of this guard extracted the heredocs but RETYPED the
 * commands as literal arrays, so it stayed green while the README documented a
 * command the binary does not have. Retyping is the drift, so nothing below is
 * retyped: even the expected values are read out of the README's own examples.
 *
 * An unrecognised line is a HARD FAILURE, never a skip — a guard that silently
 * ignores what it cannot parse is the same vacuity in a new costume.
 */

type Step =
  | { kind: 'mkdir'; path: string }
  | { kind: 'write'; path: string; body: string }
  | { kind: 'dd'; argv: string[] };

/** The ```bash fences of the `## Quick start` section, in document order. */
function quickStartFences(markdown: string): string[] {
  const start = markdown.indexOf('## Quick start');
  if (start === -1) throw new Error('README has no `## Quick start` section');
  const rest = markdown.slice(start + 1);
  const end = rest.indexOf('\n## ');
  const section = end === -1 ? rest : rest.slice(0, end);
  return [...section.matchAll(/```bash\n([\s\S]*?)```/g)].map((match) => match[1]);
}

/** Split a shell line into argv, honouring quotes and stopping at a comment. */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let token = '';
  let open = false;
  let quote: string | null = null;
  for (const char of line) {
    if (quote) {
      if (char === quote) quote = null;
      else token += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      open = true;
      continue;
    }
    // A `#` only opens a comment between tokens — inside one it is an address.
    if (char === '#' && !open) break;
    if (/\s/.test(char)) {
      if (open) tokens.push(token);
      token = '';
      open = false;
      continue;
    }
    token += char;
    open = true;
  }
  if (open) tokens.push(token);
  return tokens;
}

function parseTranscript(fences: string[]): Step[] {
  const steps: Step[] = [];
  for (const fence of fences) {
    const lines = fence.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim() === '') continue;

      const mkdir = line.match(/^mkdir -p (\S+)$/);
      if (mkdir) {
        steps.push({ kind: 'mkdir', path: mkdir[1] });
        continue;
      }

      const heredoc = line.match(/^cat > (\S+) <<'(\w+)'$/);
      if (heredoc) {
        const [, path, terminator] = heredoc;
        const body: string[] = [];
        index += 1;
        while (index < lines.length && lines[index] !== terminator) {
          body.push(lines[index]);
          index += 1;
        }
        if (index >= lines.length) throw new Error(`README heredoc for ${path} is unterminated`);
        steps.push({ kind: 'write', path, body: body.join('\n') });
        continue;
      }

      if (/^dd\s/.test(line)) {
        steps.push({ kind: 'dd', argv: tokenize(line).slice(1) });
        continue;
      }

      // Deliberately fatal. Teach this parser the new form rather than letting
      // a documented step go unproven.
      throw new Error(`README quick start has a line this guard cannot execute: ${line}`);
    }
  }
  return steps;
}

const STEPS = parseTranscript(quickStartFences(README));
const WRITES = STEPS.filter(
  (step): step is Extract<Step, { kind: 'write' }> => step.kind === 'write',
);
const COMMANDS = STEPS.filter((step): step is Extract<Step, { kind: 'dd' }> => step.kind === 'dd');

/** The one argument carrying a `#`, i.e. the address the README addressed. */
function addressOf(argv: string[]): string {
  const address = argv.find((argument) => argument.includes('#'));
  if (address === undefined) throw new Error(`no address in \`dd ${argv.join(' ')}\``);
  return address;
}

interface Item {
  id: string;
  claim?: string;
  state: string;
}

function sectionOf(document: Record<string, never>, name: string): unknown {
  const sections = (document as unknown as { sections: { name: string; value: unknown }[] })
    .sections;
  return sections.find((section) => section.name === name)?.value;
}

describe('the README quick start actually works', () => {
  let workspace: string;
  const ran = new Map<string, { argv: string[]; envelope: Envelope }>();
  const failures: string[] = [];

  /**
   * Replay the transcript once, recording every step's outcome instead of
   * throwing at the first bad one. A broken line then reds ONE row that names
   * it, rather than a cascade in which the real cause is the quietest entry.
   */
  beforeAll(() => {
    ensureBuilt();
    workspace = mkdtempSync(join(tmpdir(), 'dd-readme-'));
    for (const step of STEPS) {
      if (step.kind === 'mkdir') {
        mkdirSync(join(workspace, step.path), { recursive: true });
        continue;
      }
      if (step.kind === 'write') {
        mkdirSync(dirname(join(workspace, step.path)), { recursive: true });
        writeFileSync(join(workspace, step.path), `${step.body}\n`);
        continue;
      }
      // Relative paths throughout: on macOS an absolute temp path resolves via
      // /private and is judged outside the repository root (E429). Piped output
      // auto-selects JSON, so the README's literal line answers an envelope.
      const run = runDd(step.argv, { cwd: workspace });
      const what = `dd ${step.argv.join(' ')}`;
      // The COMMAND is judged first and on its own terms. A verb that does not
      // exist fails here, on its exit code — never as a parse accident later.
      if (run.code !== 0) {
        failures.push(`\`${what}\` exited ${run.code}: ${run.stderr.trim() || run.stdout.trim()}`);
        continue;
      }
      let envelope: Envelope;
      try {
        envelope = parseEnvelope(run.stdout);
      } catch {
        failures.push(`\`${what}\` exited 0 but answered no envelope: ${run.stdout.trim()}`);
        continue;
      }
      if (envelope.status !== 'ok') {
        failures.push(`\`${what}\` answered status ${envelope.status}`);
        continue;
      }
      // The bin dispatched the verb the README typed, not some fallback.
      if (!envelope.command.split(' ').includes(step.argv[0])) {
        failures.push(`\`${what}\` was answered by \`${envelope.command}\``);
        continue;
      }
      ran.set(step.argv[0], { argv: step.argv, envelope });
    }
  }, 120_000);

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('is a transcript with something in it to run', () => {
    // Non-vacuity. If the quick start lost its examples, or this parser stopped
    // recognising them, every row below would otherwise pass by doing nothing.
    expect(STEPS.filter((step) => step.kind === 'mkdir').length).toBe(1);
    expect(WRITES.length, 'the schema and the document').toBe(2);
    expect(COMMANDS.length, 'the documented dd invocations').toBeGreaterThanOrEqual(4);
    for (const command of COMMANDS) expect(command.argv.length).toBeGreaterThan(0);
  });

  it('runs every line of the documented transcript against the shipped bin', () => {
    // The whole point of the guard: a command the README prints must WORK.
    expect(failures, 'README quick-start commands that failed').toEqual([]);
    // …and each one must have been reached, not skipped by an earlier abort.
    expect(ran.size).toBe(new Set(COMMANDS.map((command) => command.argv[0])).size);
  });

  it('produces the document the README says it produces', () => {
    const schema = JSON.parse(WRITES[0].body);
    const document = JSON.parse(WRITES[1].body);
    expect(schema.dd_schema, 'the first heredoc is the schema').toBe(1);

    // The README's central claim about schemas: the qualified name comes from
    // the PATH, never from the file. Checked by comparing the two.
    const root = STEPS.find((step) => step.kind === 'mkdir') as Extract<Step, { kind: 'mkdir' }>;
    expect(document.dd.schema).toBe(root.path.split('schemas/')[1]);

    const build = ran.get('build');
    expect(build, 'the quick start must build the document').toBeDefined();
    const target = build?.argv.find((argument) => argument.endsWith('.dd.json')) ?? '';
    const rendered = readFileSync(join(workspace, target.replace(/\.dd\.json$/, '.dd.md')), 'utf8');
    // Expected content read out of the README's own document, not retyped.
    const meta = sectionOf(document, 'meta') as { title: string };
    const items = sectionOf(document, 'items') as Item[];
    expect(rendered).toContain(meta.title);
    for (const item of items) if (item.claim) expect(rendered).toContain(item.claim);
  });

  it('reads and writes the value at the address the README addresses', () => {
    const read = ran.get('get');
    const write = ran.get('set');
    expect(read, 'the quick start must demonstrate `dd get`').toBeDefined();
    expect(write, 'the quick start must demonstrate `dd set`').toBeDefined();
    if (!read || !write) return;

    const document = JSON.parse(WRITES[1].body);
    const declared = (sectionOf(document, 'items') as Item[]).find(
      (item) => item.id === addressOf(read.argv).split('#')[1].split('/')[1],
    );
    // `dd get` answered the state the README's own document declares.
    expect((read.envelope.data as { value: unknown }).value).toBe(declared?.state);

    // `dd set` wrote the value the README's own command asked for.
    const address = addressOf(write.argv);
    const id = address.split('#')[1].split('/')[1];
    const wanted = write.argv.filter((argument) => !argument.startsWith('-')).at(-1);
    const after = JSON.parse(readFileSync(join(workspace, address.split('#')[0]), 'utf8'));
    const item = (sectionOf(after, 'items') as Item[]).find((entry) => entry.id === id);
    expect(item?.state).toBe(wanted);
  });

  it('refuses a value the documented schema does not allow', () => {
    // The README claims `dd set` validates BEFORE writing and refuses, writing
    // nothing. That is a promise about behaviour, so it is asserted, not quoted.
    const write = ran.get('set');
    expect(write, 'the quick start must demonstrate `dd set`').toBeDefined();
    if (!write) return;
    const address = addressOf(write.argv);
    const path = join(workspace, address.split('#')[0]);
    const before = readFileSync(path, 'utf8');
    const refused = runDd(['set', address, 'nonsense', '--json'], { cwd: workspace });
    expect(refused.code).toBe(1);
    expect(parseEnvelope(refused.stdout).status).toBe('error');
    expect(readFileSync(path, 'utf8')).toBe(before);
  });
});

/**
 * The migrated backlog (plan 001 tk-0004, ac-0009).
 *
 * `docs/backlog.md` is a handover artifact: `pij-related-koala` inherits it and
 * its usefulness is entirely in the annotations. An OPEN item silently becoming
 * closed, or the backpressure ordering constraint being tidied away, would not
 * break anything visible — it would just hand the next owner a list that quietly
 * lies about what has been decided. So the properties that make it worth
 * inheriting are asserted rather than trusted to review.
 *
 * The upstream source lives in another repository and is READ-ONLY reference
 * (standing constraint 1), so it is deliberately NOT read here: a test that
 * depends on a sibling checkout fails for everyone who does not have it. These
 * rows assert the invariants the migration had to preserve, which is what
 * survives the source going away.
 */
describe('the migrated dd-next backlog', () => {
  const backlog = readFileSync(join(repoRoot, 'docs/backlog.md'), 'utf8');
  // Only the item tables: the "where each item lands" summary reuses the
  // numbers, and counting it would inflate the total.
  const itemRows = backlog
    .slice(0, backlog.indexOf('## Where each item lands'))
    .split('\n')
    .filter((line) => /^\| \d+ \| /.test(line));

  it('carries all 17 migrated items plus the 4 opened during the extraction', () => {
    const numbers = itemRows.map((row) => Number(row.split('|')[1].trim()));
    // Contiguous 1..20 catches a dropped row and a duplicated one with the same
    // assertion; a bare count would miss the second.
    expect(numbers).toEqual(Array.from({ length: 21 }, (_, index) => index + 1));
  });

  it('keeps the backpressure ordering constraint verbatim', () => {
    // Load-bearing prose, not decoration: running 11 before 8 turns the gate
    // green over undetermined values, and the green then argues the vocabulary
    // is consistent. Paraphrasing it would lose exactly that reasoning.
    expect(backlog).toContain(
      '**These four run in this order. Running 11 first turns the gate green over three\ndocuments holding undetermined values, and the green then argues the vocabulary is\nconsistent.**',
    );
  });

  it('leaves every OPEN item open', () => {
    // The migration must not resolve anything. These five were OPEN upstream;
    // an item that arrived here answered would have been decided by a file move.
    for (const number of [8, 9, 10, 12, 13]) {
      const row = itemRows.find((entry) => entry.startsWith(`| ${number} |`));
      expect(row, `backlog item ${number} is missing`).toBeDefined();
      expect(row, `backlog item ${number} must still be OPEN`).toContain('**OPEN');
    }
  });

  it('routes the two decisions that are Jordan-s to Jordan', () => {
    // 8 and 13 arrived owner-stamped; 18 and 20 were opened here and must carry
    // an owner too, or they become work nobody can start and nobody can rule.
    for (const number of [8, 13, 18, 20]) {
      const row = itemRows.find((entry) => entry.startsWith(`| ${number} |`));
      expect(row, `backlog item ${number} is missing`).toBeDefined();
      expect(row, `backlog item ${number} must name its owner`).toMatch(/OPEN\s*[—-]\s*Jordan/);
    }
  });

  it('records the added rows as added rather than passing them off as migrated', () => {
    // Provenance is the difference between a backlog and a rumour.
    expect(backlog).toContain('## Added during the extraction (plan 001)');
    expect(itemRows.find((row) => row.startsWith('| 19 |'))).toContain('**CANDIDATE**');
  });
});
