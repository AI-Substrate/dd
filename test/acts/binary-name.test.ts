import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { DD_DOCS } from '../../src/docs/docs-content.js';
import { RENDER_BANNER } from '../../src/render/renderer.js';
import { ensureBuilt, parseEnvelope, repoRoot, runDd } from '../support/run-cli.js';

const PACKAGE = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
  bin: Record<string, string>;
};
const BINARY_NAMES = Object.keys(PACKAGE.bin);
if (BINARY_NAMES.length !== 1) {
  throw new Error(
    `binary-name guard requires exactly one package bin, found ${BINARY_NAMES.length}`,
  );
}
const BINARY_NAME = BINARY_NAMES[0];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `\bdd\b` must not match the prefix of `ddocs`; always match a whole executable token. */
function binaryInvocation(verb: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(BINARY_NAME)}\\b\\s+${escapeRegExp(verb)}\\b`);
}

const SHIPPED_DOCS = [
  'README.md',
  'docs/how/dd/README.md',
  ...DD_DOCS.map((doc) => `docs/how/dd/${doc.id}.md`),
];

/** Read command examples, not prose that happens to say "to validate". */
function commandSamples(markdown: string): { line: number; text: string }[] {
  const samples: { line: number; text: string }[] = [];
  let fenced = false;
  for (const [index, line] of markdown.split('\n').entries()) {
    if (line.startsWith('```')) {
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      samples.push({ line: index + 1, text: line });
      continue;
    }
    for (const match of line.matchAll(/`([^`]+)`/g)) {
      samples.push({ line: index + 1, text: match[1] });
    }
  }
  return samples;
}

const DD_COMMAND =
  /^\s*(?:\$\s+)?(?:harness\s+)?(?<binary>\b[a-z][a-z0-9-]*\b)\s+(?:--(?:json|no-json)\s+)?(?:address|build|docs|doctor|graph|link|links|schema|set|status|validate|write)\b/;

/**
 * The binary name comes from `package.json#bin`, so what the CLI SAYS and what
 * its documentation teaches must use that same name (plan 001 tk-0003, ruled
 * 2026-08-07). Upstream reaches these verbs as `harness dd <verb>`; that form
 * does not work in this standalone package.
 *
 * This file is the ratchet for that rename. Two halves, deliberately different
 * in kind:
 *
 *  1. RUNTIME — drive the shipped bin and read what a user actually receives.
 *     This is the honest instrument: it cannot be satisfied by a source-level
 *     convention, only by output.
 *  2. SOURCE — pin the exact set of surviving `harness dd` occurrences. They are
 *     all PROVENANCE COMMENTS (this code came from harness-engineering, and
 *     saying so is correct), never emitted strings. A new user-facing one
 *     reddens the row instead of shipping.
 */

/** Source occurrences that are correct as they stand: upstream provenance, in comments. */
const PROVENANCE_COMMENTS: Record<string, number> = {
  // Upstream nests these beneath `harness dd …`; the standalone bin is package-derived above.
  'src/app.ts': 1,
  // The four E4xx block headers citing their upstream plan-065 allocation.
  'src/output/error-codes.ts': 4,
  // The port ledger's docstring, naming the verbs' upstream home.
  'src/acts/status.ts': 1,
};

/** Every source file, so the guard sees additions rather than only known files. */
function sourceFiles(): string[] {
  return execFileSync('git', ['ls-files', 'src'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter((path) => path.length > 0);
}

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('"$comment"')
  );
}

describe(`the binary is named ${BINARY_NAME}, and says so`, () => {
  it('leaves `harness dd` only in provenance comments, file by file', () => {
    const found: Record<string, number> = {};
    for (const relative of sourceFiles()) {
      const contents = readFileSync(join(repoRoot, relative), 'utf8');
      if (!contents.includes('harness dd')) continue;
      const hits = contents.split('\n').filter((line) => line.includes('harness dd'));
      found[relative] = hits.length;
      for (const line of hits) {
        // The whole point: a surviving mention must be a comment ABOUT upstream,
        // never a string this package hands to a user.
        expect(isCommentLine(line), `${relative}: non-comment mention → ${line.trim()}`).toBe(true);
      }
    }
    expect(found).toEqual(PROVENANCE_COMMENTS);
  });

  it('uses the package binary in every shipped and baked command example', () => {
    const stale: string[] = [];
    const coveredCorpora = new Set<string>();
    const surfaces = [
      ...SHIPPED_DOCS.map((path) => ({
        path,
        markdown: readFileSync(join(repoRoot, path), 'utf8'),
      })),
      ...DD_DOCS.map((doc) => ({ path: `baked:${doc.id}`, markdown: doc.content })),
    ];

    for (const surface of surfaces) {
      const corpus = surface.path.startsWith('baked:') ? 'baked' : 'shipped';
      for (const sample of commandSamples(surface.markdown)) {
        const binary = DD_COMMAND.exec(sample.text)?.groups?.binary;
        if (binary === undefined) continue;
        if (/^\s*harness plan\b/.test(sample.text)) continue;
        coveredCorpora.add(corpus);
        if (binary !== BINARY_NAME) {
          stale.push(`${surface.path}:${sample.line}: expected ${BINARY_NAME}, found ${binary}`);
        }
      }
    }

    expect([...coveredCorpora].sort()).toEqual(['baked', 'shipped']);
    expect(stale, stale.join('\n')).toEqual([]);
  });

  it('stamps generated markdown with this package’s own binary name', () => {
    expect(RENDER_BANNER).toContain(`\`${BINARY_NAME} build\``);
    expect(RENDER_BANNER).not.toContain('harness dd');
  });
});

/**
 * The runtime half. Each case is a real invocation whose envelope or human
 * output carries a command suggestion — the surfaces where a wrong binary name
 * would actually mislead someone.
 */
type OutputCase = { label: string; argv: string[]; teachesBinary?: boolean };

const OUTPUT_CASES: OutputCase[] = [
  { label: 'validate — missing document', argv: ['validate', 'no/such/file.dd.json'] },
  { label: 'schema — unknown schema', argv: ['schema', 'show', 'nope/nothing'] },
  { label: 'schema list — human listing', argv: ['schema', 'list'] },
  { label: 'docs list — human listing', argv: ['docs', 'list'] },
  { label: 'docs get — unknown entry', argv: ['docs', 'get', 'no-such-entry'] },
  { label: 'docs get — a real entry', argv: ['docs', 'get', 'dd-overview'] },
  { label: 'build — missing document', argv: ['build', 'no/such/file.dd.json'] },
  { label: 'address validate — a malformed address', argv: ['address', 'validate', 'no-hash'] },
  { label: 'links — an unresolvable target', argv: ['links', 'no/such/file.dd.json'] },
  { label: 'set — an unresolvable address', argv: ['set', 'no/such/file.dd.json#a/b', 'x'] },
  { label: 'doctor — the repo sweep', argv: ['doctor'] },
  // Successful status has neither a next_action nor a binary-qualified command; keep it as a control.
  { label: 'status — the port ledger', argv: ['status'], teachesBinary: false },
];

describe(`runtime suggestions use the package binary ${BINARY_NAME}`, () => {
  beforeAll(() => {
    ensureBuilt();
  }, 120_000);

  // Both output modes, because they are rendered by different code paths: the
  // envelope's `next_action` and the human writer's prose are separate surfaces,
  // and the rename had to land in both.
  it.each(OUTPUT_CASES)('$label', ({ argv, teachesBinary = true }) => {
    for (const flag of ['--json', '--no-json']) {
      const result = runDd([...argv, flag]);
      const output = `${result.stdout}\n${result.stderr}`;
      expect(output, `${argv.join(' ')} ${flag}`).not.toContain('harness dd');
      if (teachesBinary) {
        expect(output, `${argv.join(' ')} ${flag}`).toMatch(binaryInvocation(argv[0]));
      } else {
        expect(output, `${argv.join(' ')} ${flag}`).not.toMatch(binaryInvocation(argv[0]));
      }
    }
    if (!teachesBinary) {
      const envelope = parseEnvelope(runDd([...argv, '--json']));
      expect(envelope.next_action).toBeUndefined();
    }
  });

  it('exercises cases that really do emit command suggestions (non-vacuity)', () => {
    // If `next_action` ever stopped naming a command, the rows above would pass
    // for the wrong reason — so pin that the surface under guard is still there.
    const envelope = parseEnvelope(runDd(['validate', 'no/such/file.dd.json', '--json']));
    expect(envelope.next_action).toMatch(binaryInvocation('validate'));
    expect(envelope.next_action).not.toContain('harness dd');
  });
});
