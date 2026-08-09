import { describe, expect, it } from 'vitest';
import { FakeExec } from '../../src/adapters/exec/fake-exec.js';
import {
  DD_ISSUE_CODES,
  type DdActDeps,
  NodeSchemaFs,
  renderDocument,
  trackedPaths,
} from '../../src/node/index.js';

/**
 * The `./node` tier at its new home — the D-2 landing (as amended by A-1) for the
 * five symbols that bind dd to a real host.
 *
 * IMPORT-PATH LEVEL IS THE CLAIM. Everything below is imported from
 * `src/node/index.js`, the module `@ai-substrate/dd/node` resolves to. Reaching a
 * leaf like `src/node/schema-fs.js` would still pass if the barrel forgot to
 * re-export it, and a consumer cannot write that specifier — the barrel is the
 * surface, so the barrel is what gets tested. (Reachability through the real
 * `exports` map is proven separately, and from a real consumer's cwd, by
 * `scripts/exports-reachability-probe.mjs`.)
 *
 * WHY THESE FIVE ARE TOGETHER: each one needs a host. `NodeSchemaFs` calls
 * `node:fs`; `trackedPaths` drives a git child through an `ExecPort`;
 * `renderDocument` constructs four Node adapters; `DD_ISSUE_CODES` names the
 * CLI's `output/` E-codes; `DdActDeps` carries the injected clock. The rest of the
 * library is provably portable — `test/architecture/dd-core-isolation.test.ts`
 * walks every import edge and fails on a `node:` builtin — and that guarantee is
 * only legible from outside if the host-bound things are named as host-bound.
 *
 * BEHAVIOUR IS UNCHANGED: every implementation moved byte-identical out of
 * `src/acts/`. What is new is that most of them had NO direct test — they were
 * exercised only through the verbs that constructed them.
 */
describe('@ai-substrate/dd/node — the host-bound tier', () => {
  it('exports all five ratified symbols from one barrel', () => {
    expect(typeof NodeSchemaFs).toBe('function');
    expect(typeof trackedPaths).toBe('function');
    expect(typeof renderDocument).toBe('function');
    expect(typeof DD_ISSUE_CODES).toBe('object');
    // DdActDeps is type-only — asserted below, where a type CAN be asserted.
  });

  it('constructs NodeSchemaFs from the barrel', () => {
    expect(new NodeSchemaFs()).toBeInstanceOf(NodeSchemaFs);
  });

  /**
   * `DdActDeps` is type-only, so there is no runtime binding to check. What CAN be
   * proven is that it is nameable and structurally satisfiable from the barrel —
   * which is the entire reason it was admitted (P1 census B1: the trial imports it
   * and today gets `ERR_PACKAGE_PATH_NOT_EXPORTED`).
   */
  it('exports DdActDeps as a nameable, satisfiable type', () => {
    const deps: DdActDeps = {
      clock: { nowIso: () => '1970-01-01T00:00:00.000Z', sleep: async () => {} },
    };
    expect(deps.clock.nowIso()).toBe('1970-01-01T00:00:00.000Z');
  });

  /**
   * The exhaustive `Record<DdIssueClass | DdLinkIssueClass, string>` is the guard
   * that matters — a new issue class in ANY dd layer fails to compile without a
   * code here. That guard is compile-time, so the runtime row asserts the other
   * half: the arbitration this table was created to settle. `address-path-escape`
   * answers to the SPECIFIC link-escape code, not the generic address code, and it
   * does so no matter which verb reports it.
   */
  it('answers one code per finding class, verb-independently', () => {
    // The arbitration this table was created to settle: a path that leaves the
    // repository is a LINK-PATH ESCAPE (E433, specific) and not merely an invalid
    // address (E405, generic) — and it is called that wherever it is reported.
    expect(DD_ISSUE_CODES['address-path-escape']).toBe('E433');
    expect(DD_ISSUE_CODES['address-malformed']).toBe('E405');
    // A class code says what went wrong; it must not change with the verb that
    // reports it. Both scan classes answer to the scan code, not the doctor's.
    expect(DD_ISSUE_CODES['link-scan-failed']).toBe(DD_ISSUE_CODES['link-scan-incomplete']);
    expect(Object.values(DD_ISSUE_CODES).every((code) => /^E\d{3}$/.test(code))).toBe(true);
  });
});

describe('trackedPaths — one git snapshot, or an honest null', () => {
  const REPO = '/repo';

  it('takes ONE NUL-delimited snapshot and returns absolute POSIX paths', async () => {
    const exec = new FakeExec({
      'git ls-files -z': { code: 0, stdout: 'a.dd.json\0docs/b.dd.json\0' },
    });
    expect(await trackedPaths(exec, REPO)).toEqual(
      new Set(['/repo/a.dd.json', '/repo/docs/b.dd.json']),
    );
    expect(exec.calls).toHaveLength(1);
    expect(exec.calls[0]).toMatchObject({ command: 'git', args: ['ls-files', '-z'], cwd: REPO });
  });

  it('drops the trailing empty entry NUL-termination produces', async () => {
    const exec = new FakeExec({ 'git ls-files -z': { code: 0, stdout: 'only.dd.json\0' } });
    expect(await trackedPaths(exec, REPO)).toEqual(new Set(['/repo/only.dd.json']));
  });

  /**
   * The judgement in this function, and the only row that would catch someone
   * "simplifying" it: a failure answers NULL, not an empty set. Null means "this
   * host has no tracking concept", and `FsDocLoader` reads it as "claim nothing
   * about tracking". An empty set means "nothing is tracked", which would turn
   * every target into an untracked-target WARN. The last row keeps the two apart.
   */
  it('answers null — never an empty set — when git fails', async () => {
    const exec = new FakeExec({ 'git ls-files -z': { code: 128, stdout: '' } });
    expect(await trackedPaths(exec, REPO)).toBeNull();
  });

  it('answers null when the exec port throws outright', async () => {
    const throwing = {
      run: () => {
        throw new Error('no git on this host');
      },
    };
    expect(await trackedPaths(throwing, REPO)).toBeNull();
  });

  it('answers an EMPTY set for a real repo that tracks nothing — distinct from null', async () => {
    const exec = new FakeExec({ 'git ls-files -z': { code: 0, stdout: '' } });
    const tracked = await trackedPaths(exec, REPO);
    expect(tracked).not.toBeNull();
    expect(tracked?.size).toBe(0);
  });
});

describe('renderDocument — reachable, and still refusing what it always refused', () => {
  /**
   * Behaviour is covered end-to-end by `test/acts/dd-build.test.ts`, which drives
   * the real verb. The row here is about the LANDING: the function is reachable
   * from the barrel and still answers with a structured `BuildResult` rather than
   * throwing — the property that made it safe to make public at all.
   */
  it('refuses a document outside the repository root, as a result not a throw', async () => {
    const result = await renderDocument('/elsewhere/plan.dd.json', '/repo');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('E429');
    expect(result.message).toContain('outside the repository root');
    expect(result.next_action).toBeTruthy();
  });

  it('refuses a missing document the same way', async () => {
    const result = await renderDocument('/repo/gone.dd.json', '/repo');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('missing or unreadable');
  });
});
