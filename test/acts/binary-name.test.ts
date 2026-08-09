import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { DD_DOCS } from '../../src/docs/docs-content.js';
import { RENDER_BANNER } from '../../src/render/renderer.js';
import { ensureBuilt, parseEnvelope, repoRoot, runDd } from '../support/run-cli.js';

/**
 * The binary is named `dd`, so what it SAYS must say `dd` (plan 001 tk-0003,
 * ruled 2026-08-07). Upstream reaches these same verbs as `harness dd <verb>`;
 * here `dd` IS the binary, and telling a user to run `harness dd build` is an
 * instruction that does not work in this package.
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
  // "upstream nests them beneath `harness dd …`, but here the binary IS `dd`."
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

describe('the binary is named dd, and says so', () => {
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

  it('bakes docs that tell the reader to run `dd`, not `harness dd`', () => {
    expect(DD_DOCS.length).toBeGreaterThan(0);
    for (const doc of DD_DOCS) {
      expect(doc.content, `baked doc ${doc.id}`).not.toContain('harness dd');
    }
    // Non-vacuity: the corpus really does carry command examples to get wrong.
    expect(DD_DOCS.some((doc) => doc.content.includes('dd schema list'))).toBe(true);
  });

  it('stamps generated markdown with this package’s own binary name', () => {
    expect(RENDER_BANNER).toContain('`dd build`');
    expect(RENDER_BANNER).not.toContain('harness dd');
  });
});

/**
 * The runtime half. Each case is a real invocation whose envelope or human
 * output carries a command suggestion — the surfaces where a wrong binary name
 * would actually mislead someone.
 */
const OUTPUT_CASES: { label: string; argv: string[] }[] = [
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
  { label: 'status — the port ledger', argv: ['status'] },
];

describe('no invocation tells a user to run `harness dd`', () => {
  beforeAll(() => {
    ensureBuilt();
  }, 120_000);

  // Both output modes, because they are rendered by different code paths: the
  // envelope's `next_action` and the human writer's prose are separate surfaces,
  // and the rename had to land in both.
  it.each(OUTPUT_CASES)('$label', ({ argv }) => {
    for (const flag of ['--json', '--no-json']) {
      const result = runDd([...argv, flag]);
      expect(`${result.stdout}\n${result.stderr}`, `${argv.join(' ')} ${flag}`).not.toContain(
        'harness dd',
      );
    }
  });

  it('exercises cases that really do emit command suggestions (non-vacuity)', () => {
    // If `next_action` ever stopped naming a command, the rows above would pass
    // for the wrong reason — so pin that the surface under guard is still there.
    const envelope = parseEnvelope(runDd(['validate', 'no/such/file.dd.json', '--json']));
    expect(envelope.next_action).toContain('dd validate');
    expect(envelope.next_action).not.toContain('harness dd');
  });
});
