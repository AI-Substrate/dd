import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSyntheticPlan, type SyntheticCorpus } from '../support/dd-corpus.js';
import { runCli } from '../support/run-cli.js';

/**
 * `ddocs validate` stays MECHANICAL (tk-7026 / dw-0261).
 *
 * Plan 070 gave `harness plan validate` opinions — contradictions, open rows,
 * unclaimed criteria. This pin is the other half of that bargain: `ddocs validate`
 * answers exactly one question, "is this document well-formed against its
 * schema?", and its answer did not move. The separation is what lets a gate
 * choose which question it is asking; a mechanical check that quietly started
 * reporting judgement calls would break every consumer that trusted it not to.
 */
describe('ddocs validate — byte-for-byte mechanical (dw-0261)', () => {
  let corpus: SyntheticCorpus;
  let previousCwd = '';

  beforeEach(() => {
    corpus = createSyntheticPlan({
      // Deliberately full of things the SEMANTIC layer has opinions about: a task
      // ticked over an open assertion, and a criterion nothing claims.
      acceptance: [
        { id: 'ac-0001', claim: 'claimed' },
        { id: 'ac-0002', claim: 'nobody claims me' },
      ],
      phases: [
        {
          id: 'ph-0001',
          title: 'core',
          tasks: [
            {
              id: 'tk-0001',
              title: 'build it',
              state: 'checked',
              satisfies: ['ac-0001'],
              assertions: [{ id: 'dw-0001', assertion: 'open', pressure: 'not-applicable' }],
            },
          ],
        },
      ],
    });
    previousCwd = process.cwd();
    process.chdir(corpus.root);
  });

  afterEach(() => {
    // Restore FIRST, and only if we actually moved: vitest reuses a worker across
    // files, so a suite that leaves the process parked in a deleted temp
    // directory poisons whatever file runs next in that worker.
    if (previousCwd.length > 0) process.chdir(previousCwd);
    previousCwd = '';
    corpus?.cleanup();
  });

  it('reports ZERO findings on a corpus the semantic layer objects to', async () => {
    const mechanical = await runCli([
      'dd',
      'validate',
      corpus.taskFileRelative('ph-0001'),
      '--depth',
      '0',
    ]);
    expect(mechanical.code).toBe(0);
    expect(mechanical.envelope?.status).toBe('ok');
    const data = mechanical.envelope?.data as {
      counts: { error: number; warn: number };
      issues: unknown[];
    };
    expect(data.counts).toStrictEqual({ error: 0, warn: 0 });
    expect(data.issues).toStrictEqual([]);

    // ADAPTED FOR THIS PACKAGE. Upstream this case ends by asking the SAME corpus
    // the semantic question — `runCli(['plan', 'validate', …, '--complete'])` —
    // and asserting it answers `degraded` with findings. That contrast cannot be
    // drawn here: `plan validate` is a harness-side verb built ON the dd plan
    // semantics layer, and it is not one of the ten verbs this package ships.
    // Driving a globally-installed `harness` from these tests would couple the
    // package's suite to a binary it does not own, so the half that belongs to
    // dd is kept and the half that belongs to harness stays upstream.
    //
    // The claim it was guarding is not lost — the very next case pins it from the
    // other side, asserting `ddocs validate` never grows `findings`/`summary`/`mode`.
  });

  it('keeps its envelope shape: counts and issues, and no semantic keys', async () => {
    const result = await runCli(['dd', 'validate', corpus.planRelative, '--depth', '0']);
    const data = result.envelope?.data as Record<string, unknown>;
    expect(Object.keys(data).sort()).toStrictEqual(['counts', 'depth', 'issues', 'path', 'schema']);
    // Named explicitly: these are the keys `plan validate` grew, and `ddocs validate`
    // must never grow them. A weaker assertion would pass the day one leaks in.
    expect(data.findings).toBeUndefined();
    expect(data.summary).toBeUndefined();
    expect(data.mode).toBeUndefined();
  });

  it('still fails a document that is genuinely malformed', async () => {
    // The pin is "unchanged", not "toothless". Planted by hand rather than
    // through `ddocs set`, because the writer's own gate refuses to produce this.
    const target = join(corpus.folder, 'plan.dd.json');
    const doc = JSON.parse(readFileSync(target, 'utf8')) as {
      sections: Array<{ name: string; value: unknown }>;
    };
    const criteria = doc.sections.find((section) => section.name === 'acceptance_criteria');
    (criteria?.value as Array<Record<string, unknown>>)[0] = {
      id: 'ac-0001',
      claim: 'broken',
      state: 'donezo',
    };
    writeFileSync(target, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');

    const broken = await runCli(['dd', 'validate', corpus.planRelative, '--depth', '0']);
    expect(broken.code).toBe(1);
    expect(broken.envelope?.error?.code).toBe('E407');
  });
});

/**
 * The agreement F2 exists to enforce: `ddocs build`, `ddocs validate` and
 * `ddocs doctor` are three questions asked of ONE corpus, and a missing ordinary
 * file must be visible to all three. Before this, only `build` reported it —
 * `validate` answered `ok` about a document it had already refused to follow a
 * file link out of, which is the worst shape available: a clean bill of health
 * that was never earned.
 *
 * Existence is also exactly the kind of finding this verb is allowed to have.
 * It is MECHANICAL — the answer is a `stat`, not a judgement — so it belongs
 * here and the semantic-key pin above still holds.
 */
describe('ddocs validate — a missing ordinary file target is a WARN, not silence', () => {
  let corpus: SyntheticCorpus;
  let previousCwd = '';
  const GOAL_LINK = 'ship [the library](../../../src/library.ts)';

  beforeEach(() => {
    corpus = createSyntheticPlan();
    const doc = JSON.parse(readFileSync(corpus.plan, 'utf8')) as {
      sections: Array<{ name: string; value: unknown }>;
    };
    doc.sections.push({ name: 'goals', value: [GOAL_LINK] });
    writeFileSync(corpus.plan, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    previousCwd = process.cwd();
    process.chdir(corpus.root);
  });

  afterEach(() => {
    if (previousCwd.length > 0) process.chdir(previousCwd);
    previousCwd = '';
    corpus?.cleanup();
  });

  async function validate() {
    const result = await runCli(['dd', 'validate', corpus.planRelative, '--depth', '0']);
    const data = result.envelope?.data as {
      counts: { error: number; warn: number };
      issues: Array<Record<string, unknown>>;
    };
    return { result, data };
  }

  it('reports the missing target once, degraded, and still exits 0', async () => {
    const { result, data } = await validate();
    expect(result.code).toBe(0);
    expect(result.envelope?.status).toBe('degraded');
    expect(data.counts).toStrictEqual({ error: 0, warn: 1 });
    expect(data.issues).toStrictEqual([
      {
        class: 'address-target-missing',
        severity: 'WARN',
        location: '$.sections[goals].value[0]',
        message: 'file link target is missing: ../../../src/library.ts',
        // macOS hands `mkdtemp` a `/var` symlink and the CLI answers in real paths.
        owner: realpathSync(corpus.plan),
        code: 'E431',
      },
    ]);
  });

  it('says nothing once the file is there', async () => {
    // The SAME corpus, one file different — so the WARN above is about existence
    // and not about the link's shape, which did not change.
    mkdirSync(join(corpus.root, 'src'), { recursive: true });
    writeFileSync(join(corpus.root, 'src', 'library.ts'), 'export const LIBRARY = 1;\n', 'utf8');
    const { result, data } = await validate();
    expect(result.code).toBe(0);
    expect(result.envelope?.status).toBe('ok');
    expect(data.issues).toStrictEqual([]);
  });
});
