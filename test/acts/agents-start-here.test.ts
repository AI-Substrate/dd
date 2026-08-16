import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  AGENTS_START_HERE_DOC_ID,
  buildAgentsStartHereEnvelope,
} from '../../src/acts/agents-start-here.js';
import { PLANNED_VERBS } from '../../src/acts/status.js';
import { FakeClock } from '../../src/adapters/clock/fake-clock.js';
import { buildProgram } from '../../src/app.js';
import type { DdDocRecord } from '../../src/docs/contract.js';
import { describeRun, ensureBuilt, parseEnvelope, repoRoot, runDd } from '../support/run-cli.js';

/**
 * `ddocs agents-start-here` — the orientation verb (stream brief, 2026-08-16).
 *
 * THE TRAP THIS FILE IS WRITTEN AGAINST, stated by the brief in advance: the
 * obvious test — "it prints something containing the word deterministic" —
 * passes against `dd-overview`, against a hand-pasted copy of the markdown, and
 * against almost any wrong implementation. A name stronger than its assertions
 * is this repo's most-repeated defect. So every claim below is written to be
 * DISCRIMINATING, and the row that proves it is `the assertions above could tell
 * the difference`: it drives the same assertions against every OTHER baked doc
 * and requires them to fail. Re-point `AGENTS_START_HERE_DOC_ID` at any other id
 * and this file reds — that is the mutation proof, mechanised rather than
 * remembered.
 */

const clock = () => new FakeClock('2026-08-16T00:00:00.000Z');

/**
 * The ruling, pinned INDEPENDENTLY of the code under test.
 *
 * THIS LITERAL IS LOAD-BEARING AND WAS EARNED BY A MUTATION RUN. Every oracle
 * below used to be derived from `AGENTS_START_HERE_DOC_ID` itself — including
 * the path this file reads its expected bytes from. Re-pointing that constant at
 * `dd-overview` therefore re-pointed the TEST too: the byte-parity rows compared
 * the wrong doc against the wrong doc, agreed, and stayed green. Eleven of
 * twelve rows passed against a verb serving the wrong document, and the one red
 * was the weakest row in the file.
 *
 * An oracle that moves with the thing it measures is not an oracle. So the
 * expected id is written out HERE, as a literal, and the row `serves the doc the
 * o-prime ruled on` is what ties the two together — a re-point now reds on the
 * ruling, on the bytes, and on the content, which is what the mutation proof is
 * supposed to demonstrate.
 */
const EXPECTED_DOC_ID = 'deterministic-documents';

/** The doc's ON-DISK source — the bytes the corpus is generated FROM. */
const DOC_SOURCE = readFileSync(
  join(repoRoot, 'src', 'docs', 'content', `${EXPECTED_DOC_ID}.md`),
  'utf8',
);

describe('ddocs agents-start-here', () => {
  beforeAll(ensureBuilt);

  /**
   * -------------------------------------------------------------------------
   * It resolves the SAME bytes, and it holds no copy of them.
   * -------------------------------------------------------------------------
   */

  it('serves the doc the o-prime ruled on', () => {
    // The ruling itself, asserted rather than assumed. `deterministic-documents`
    // beat `dd-overview` because it is the only baked entry that opens by
    // addressing an agent mid-task; the brief is explicit that changing the
    // target is a decision to take back to the o-prime. This row is where that
    // decision is recorded in executable form.
    expect(AGENTS_START_HERE_DOC_ID).toBe(EXPECTED_DOC_ID);
  });

  it('prints exactly what `docs get deterministic-documents` prints, byte for byte', () => {
    // The brief's ruling 2: the verb resolves through the same `getDdDoc` path
    // `docs get` uses. That is a claim about BYTES, so bytes are what is
    // compared — not a shared substring, which a second copy would also satisfy.
    const alias = runDd(['--no-json', 'agents-start-here']);
    const direct = runDd(['--no-json', 'docs', 'get', EXPECTED_DOC_ID]);

    expect(alias.code, describeRun(alias)).toBe(0);
    expect(direct.code, describeRun(direct)).toBe(0);
    expect(alias.stdout, describeRun(alias)).toBe(direct.stdout);
    // Non-vacuity: two empty strings are also equal. A run that printed nothing
    // must fail here rather than pass as agreement.
    expect(Buffer.byteLength(alias.stdout), describeRun(alias)).toBe(Buffer.byteLength(DOC_SOURCE));
  });

  it('delivers the whole source markdown, not a prefix of it', () => {
    // Byte-equality with the on-disk source is the strongest available form of
    // "it did not mangle, re-wrap or truncate the doc".
    //
    // WHAT THIS IS NOT: the truncation guard. It catches a hard `process.exit`
    // replacing `emitRawAndExit` only where the pipe buffer is SMALLER than this
    // payload — 11.5 KB clears macOS's 8 KB buffer but not its 16 KB one, and
    // not Linux's 64 KB. The instrument that actually covers truncation on every
    // platform is `envelope-flush.test.ts`, which carries a payload above every
    // buffer deliberately. Claiming that job here would be the overclaim this
    // repo keeps re-learning; the row is honest about being a corpus-sized
    // partial.
    const run = runDd(['--no-json', 'agents-start-here']);
    expect(run.code, describeRun(run)).toBe(0);
    expect(run.stdout, describeRun(run)).toBe(DOC_SOURCE);
  });

  it('holds no second copy of the doc body anywhere in src/', () => {
    // Ruling 2 again, from the other side: "A second copy of that markdown
    // anywhere in the tree is a defect, not a convenience."
    //
    // A SINGLE-SENTENCE FINGERPRINT WAS REJECTED AS THE INSTRUMENT, and the
    // reason is the same use-vs-mention problem `docs-surface.test.ts` hit: this
    // act's own doc comment QUOTES the doc's opening line to explain why that id
    // was ruled on, and a substring scan calls that citation a copy. An
    // instrument that cannot tell a quotation from a paste fails the honest
    // implementation and would be "fixed" by deleting the explanation.
    //
    // So the measure is VOLUME, which is what actually separates the two: a
    // citation carries one or two lines, a paste carries dozens. Counting whole
    // substantive lines also survives escaping — the generated corpus stores the
    // body as one JS string with `\n` escapes, so the LINES are intact even
    // though the newlines between them are not.
    const SUBSTANTIVE = DOC_SOURCE.split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length >= 40);
    /** A citation's worth. Above this, a file is reproducing the document. */
    const QUOTATION_CEILING = 2;
    /** Where the body legitimately lives: the source, and the generated corpus. */
    const SANCTIONED = ['src/docs/content/', 'src/docs/docs-content.ts'];

    const files = readdirSync(join(repoRoot, 'src'), { recursive: true, encoding: 'utf8' })
      .map((entry) => `src/${entry.split('\\').join('/')}`)
      .filter((path) => /\.(ts|json|md)$/.test(path));

    const score = (path: string): number => {
      const text = readFileSync(join(repoRoot, path), 'utf8');
      return SUBSTANTIVE.filter((line) => text.includes(line)).length;
    };

    // Non-vacuity, both directions. The scan must actually be looking at
    // something (the corpus scores near-total), and the needles must be real
    // lines of a real document rather than an empty list quietly passing.
    expect(SUBSTANTIVE.length, 'no substantive lines parsed out of the doc').toBeGreaterThan(50);
    expect(
      score('src/docs/docs-content.ts'),
      'the generated corpus must carry the body — if it does not, this scan is blind',
    ).toBeGreaterThan(50);

    const copies = files
      .filter((path) => !SANCTIONED.some((allowed) => path.startsWith(allowed)))
      .filter((path) => score(path) > QUOTATION_CEILING);
    expect(copies, 'these files reproduce the doc body instead of resolving it').toEqual([]);
  });

  /**
   * -------------------------------------------------------------------------
   * It is the RIGHT doc — and the assertions could tell if it were not.
   * -------------------------------------------------------------------------
   */

  it('answers with the entry that speaks to an agent mid-task', () => {
    // WHY this id and not `dd-overview`, per the brief: it is the only baked doc
    // that opens by addressing this exact reader, and the two rules it opens
    // with are the reason the verb exists at all. Asserting the reason, not just
    // the id, is what makes a silent re-point visible as a behaviour change.
    const run = runDd(['--no-json', 'agents-start-here']);
    expect(run.stdout, describeRun(run)).toContain('If you are an agent meeting a dd mid-task');
    expect(run.stdout, describeRun(run)).toContain('Never hand-edit a `.dd.md` file');
    expect(run.stdout, describeRun(run)).toContain('Write through the CLI');
  });

  it('the assertions above could tell the difference — no other baked doc satisfies them', () => {
    // THE MUTATION PROOF, mechanised. The brief asks for non-vacuity the way
    // this repo has learned to get it: break the world, not the test — point the
    // verb at a different doc id and confirm the test reds. Doing that by hand
    // proves it once, for the person who ran it. This row proves it on every
    // run, for every id the corpus holds: if `AGENTS_START_HERE_DOC_ID` were
    // changed to ANY other baked doc, the byte-parity rows above would fail.
    const listed = parseEnvelope(runDd(['--json', 'docs', 'list']));
    const ids = (listed.data as { docs: { id: string }[] }).docs.map((doc) => doc.id);
    const others = ids.filter((id) => id !== EXPECTED_DOC_ID);

    // Non-vacuity: with a one-doc corpus there is nothing to discriminate
    // against, and "no other doc matches" would be true by having no others.
    expect(ids, 'the target must be a doc the CLI actually serves').toContain(EXPECTED_DOC_ID);
    expect(others.length, 'nothing to discriminate against').toBeGreaterThan(0);

    const actual = runDd(['--no-json', 'agents-start-here']).stdout;
    for (const id of others) {
      const other = runDd(['--no-json', 'docs', 'get', id]);
      expect(other.code, describeRun(other)).toBe(0);
      expect(actual, `agents-start-here must not be serving "${id}"`).not.toBe(other.stdout);
    }
  });

  /**
   * -------------------------------------------------------------------------
   * The envelope contract (AGENTS.md, brief ruling 3).
   * -------------------------------------------------------------------------
   */

  it('answers an ok envelope carrying the doc under --json, and exits 0', () => {
    const run = runDd(['--json', 'agents-start-here']);
    const envelope = parseEnvelope(run);

    expect(run.code, describeRun(run)).toBe(0);
    expect(envelope.command).toBe('agents-start-here');
    expect(envelope.status).toBe('ok');
    expect(envelope.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    const data = envelope.data as { id: string; format: string; content: string; title: string };
    expect(data.id).toBe(EXPECTED_DOC_ID);
    expect(data.format).toBe('markdown');
    // Same bytes on the JSON path too — the two modes must not diverge.
    expect(data.content).toBe(DOC_SOURCE);
  });

  it('reports a build whose corpus lost the doc, rather than printing nothing', () => {
    // Unreachable through the shipped bin — the id is a constant and the corpus
    // is compiled in — which is exactly why it is driven through the service's
    // documented fake seam instead of being left unproven. `next_action` is
    // REQUIRED on any non-ok status, and that is the whole point of the branch:
    // a broken build must say what to do, not exit silently.
    const emptied: DdDocRecord[] = [
      {
        id: 'something-else',
        title: 'Something else',
        summary: 'A corpus that no longer carries the orientation doc.',
        audience: 'both',
        content: '# Something else\n',
      },
    ];
    const envelope = buildAgentsStartHereEnvelope(clock(), emptied);

    expect(envelope.status).toBe('error');
    expect(envelope.error?.code).toBe('E419');
    expect(envelope.error?.message).toContain(EXPECTED_DOC_ID);
    expect(envelope.next_action).toBeTruthy();

    // Non-vacuity: the same builder over the REAL corpus must succeed, or this
    // row is passing because the function is broken for every input.
    const healthy = buildAgentsStartHereEnvelope(clock());
    expect(healthy.status).toBe('ok');
  });

  /**
   * -------------------------------------------------------------------------
   * The port ledger does not move (brief ruling 1).
   * -------------------------------------------------------------------------
   */

  it('leaves `ddocs status` reporting ten of ten', () => {
    // `PLANNED_VERBS` measures the port out of AI-Substrate/harness-engineering
    // — a historical fact that finished at 10/10. This verb is native to dd and
    // has no upstream, so it must not move that number. The next person to add a
    // verb will face the same fork; this row is the answer they will find.
    const run = runDd(['--json', 'status']);
    const envelope = parseEnvelope(run);

    expect(run.code, describeRun(run)).toBe(0);
    expect(envelope.status).toBe('ok');
    const data = envelope.data as { ported: string[]; remaining: string[]; planned: number };
    expect(data.ported).toHaveLength(10);
    expect(data.planned).toBe(10);
    expect(data.remaining).toEqual([]);
    expect(data.ported).not.toContain('agents-start-here');
  });

  it('is registered on the program while deliberately absent from the ledger', () => {
    // The PAIR is the assertion. "Not in PLANNED_VERBS" is trivially true of a
    // verb that was never written, so on its own the row above would pass just
    // as happily if this feature disappeared. Registered AND unlisted is the
    // state the ruling actually describes.
    const program = buildProgram(
      { mode: 'json', writers: { out: () => {}, err: () => {} } },
      { clock: clock() },
    );
    const registered = program.commands.map((command) => command.name());

    expect(registered).toContain('agents-start-here');
    expect([...PLANNED_VERBS]).not.toContain('agents-start-here');
  });

  /**
   * -------------------------------------------------------------------------
   * Discoverability — half the feature (brief ruling 4).
   * -------------------------------------------------------------------------
   */

  it('is the first verb `ddocs --help` lists', () => {
    // "A verb an agent has to already know about solves nothing." Commander
    // lists commands in registration order, so position is a real, assertable
    // property rather than a hope — and first is the one position that cannot be
    // scrolled past.
    const run = runDd(['--help']);
    expect(run.code, describeRun(run)).toBe(0);

    const section = run.stdout.slice(run.stdout.indexOf('Commands:'));
    const order = [...section.matchAll(/^ {2}(\S+)/gm)].map((match) => match[1]);

    // Non-vacuity: a regex that stopped matching would make `order[0]` undefined
    // and every ordering claim below meaningless, so prove it parsed real rows.
    expect(order, 'the help parser found no command rows').toContain('docs');
    expect(order.length).toBeGreaterThan(10);
    expect(order[0]).toBe('agents-start-here');
  });

  it('tells a first-time reader what to run and why, in `--help` and in the bare verb map', () => {
    // Position alone is not enough: `--help` is read by something scanning for a
    // verb that matches a task it already has, and `agents-start-here` only
    // looks relevant to a reader who already knows it is. The footer is the part
    // that says so in words — and it must survive on BOTH discovery gestures,
    // since bare `ddocs` is its own path through `main()`.
    for (const argv of [['--help'], []]) {
      const run = runDd(argv);
      expect(run.code, describeRun(run)).toBe(0);
      expect(run.stdout, describeRun(run)).toContain('ddocs agents-start-here');
      expect(run.stdout, describeRun(run)).toContain('New here?');
    }
  });

  it('answers `--help` on the verb itself, like every other verb does', () => {
    const run = runDd(['agents-start-here', '--help']);
    expect(run.code, describeRun(run)).toBe(0);
    expect(run.stdout, describeRun(run)).toContain('agents-start-here');
  });
});
