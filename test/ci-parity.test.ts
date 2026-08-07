import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './support/run-cli.js';

/**
 * CI asserts what `just checks` asserts (plan 001 phase 4, tk-0001).
 *
 * `ci.yml` used to carry the comment "Same three gates `just checks` runs
 * locally, in the same order, so CI and local can't drift." The recipe ran
 * FIVE, and the one CI was missing was `check-docs` — the gate whose entire
 * job is to catch silent drift in the baked `dd docs` corpus. So a comment
 * promising no-drift was itself the drift, and nothing could see it: every
 * test passed, because no test read CI.
 *
 * That is guardrail 11 (a claim that outran its implementation) in its purest
 * form, and the fix is not "add the missing step" — it is to make the claim
 * mechanically enforced, so the next person who adds a gate to the justfile
 * and forgets CI gets a red test instead of a comment that lies.
 *
 * The parsers below deliberately THROW rather than return empty when they
 * cannot find what they are looking for. A guard that silently finds nothing
 * to check is the same defect wearing a different hat, so "the target moved"
 * is a failure here, never a skip.
 */

const ciWorkflow = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const justfile = readFileSync(join(repoRoot, 'justfile'), 'utf8');

/**
 * The body lines of a `just` recipe, comments and blanks dropped.
 *
 * Throws if the recipe is absent — callers are asserting something ABOUT the
 * recipe, so its disappearance must redden them, not excuse them.
 */
function justRecipeBody(source: string, recipe: string): string[] {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`${recipe}:`));
  if (start === -1) throw new Error(`justfile has no recipe "${recipe}:"`);

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') continue;
    // A non-indented line ends the recipe: the next recipe, or a comment above it.
    if (!/^\s/.test(line)) break;
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;
    body.push(trimmed);
  }
  if (body.length === 0) throw new Error(`just recipe "${recipe}" has an empty body`);
  return body;
}

/**
 * The ordered shell commands `just checks` actually runs.
 *
 * `checks` is a recipe of `just <gate>` lines; each gate is resolved to the
 * command in ITS body, which is the string CI has to match. Resolving rather
 * than hardcoding is the point — renaming a gate or changing what it runs
 * moves this expectation automatically, so the guard tracks the justfile
 * instead of carrying a second copy of it that can rot.
 */
function checksGateCommands(source: string): { gate: string; command: string }[] {
  const gates: { gate: string; command: string }[] = [];
  for (const line of justRecipeBody(source, 'checks')) {
    const match = /^just\s+(\S+)$/.exec(line);
    if (!match) throw new Error(`unrecognised line in the "checks" recipe: ${line}`);
    const gate = match[1];
    const body = justRecipeBody(source, gate);
    if (body.length !== 1) {
      throw new Error(`gate "${gate}" runs ${body.length} commands; expected exactly one`);
    }
    gates.push({ gate, command: body[0] });
  }
  if (gates.length === 0) throw new Error('the "checks" recipe delegates to no gates');
  return gates;
}

/**
 * Every inline `run:` scalar inside one workflow job, in order.
 *
 * Hand-parsed on purpose: the repo ships no YAML dependency, and adding one to
 * read five strings would put a package in the tree to serve a test. The parse
 * is narrow and strict — it takes the job block by its two-space key, stops at
 * the next key at that indent, and throws if the job is missing.
 */
function jobInlineRuns(source: string, job: string): string[] {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line === `  ${job}:`);
  if (start === -1) throw new Error(`ci.yml has no job "${job}"`);

  const runs: string[] = [];
  for (const line of lines.slice(start + 1)) {
    // Next job key at the same indent ends this block.
    if (/^ {2}\S/.test(line)) break;
    const match = /^\s+run:\s+(\S.*)$/.exec(line);
    // `run: |` opens a block scalar; those are multi-line shell, not a gate.
    if (match && match[1].trim() !== '|') runs.push(match[1].trim());
  }
  if (runs.length === 0) throw new Error(`job "${job}" runs no inline commands`);
  return runs;
}

describe('CI runs what `just checks` runs', () => {
  const gates = checksGateCommands(justfile);
  const ciRuns = jobInlineRuns(ciWorkflow, 'build-test');

  it('parses a real, non-empty gate list out of the justfile', () => {
    // Non-vacuity: every row below is an assertion ABOUT these two lists, so a
    // parse that quietly returned nothing would turn all of them green.
    expect(gates.length).toBeGreaterThan(1);
    expect(ciRuns.length).toBeGreaterThan(1);
    expect(gates.map((g) => g.gate)).toContain('check-docs');
  });

  it.each(checksGateCommands(justfile))('runs the `just $gate` gate in CI', ({ gate, command }) => {
    // Named per gate so a failure says WHICH gate CI is missing, rather than
    // handing back two lists to diff by eye.
    expect(
      ciRuns,
      `\`just checks\` runs the "${gate}" gate (\`${command}\`) but the CI build-test job does not`,
    ).toContain(command);
  });

  it('runs those gates in the same order as the recipe', () => {
    // Order is load-bearing, not cosmetic: build must precede test because the
    // smoke test spawns the compiled bin. Same-set-wrong-order is a real
    // failure, so it gets its own row rather than riding on membership.
    const positions = gates.map(({ command }) => ciRuns.indexOf(command));
    const ordered = [...positions].sort((a, b) => a - b);
    expect(
      positions,
      `CI gate order ${JSON.stringify(gates.map((g) => g.gate))} does not match the justfile`,
    ).toEqual(ordered);
  });
});

describe('CI asserts the packaged artifact', () => {
  it('runs the committed pack gate rather than an inline copy of it', () => {
    // tk-0005 (phase 3) put the gate in a script precisely so CI and a
    // developer run the same bytes; CI re-implementing it inline would restore
    // the drift the script exists to remove.
    expect(ciWorkflow).toContain('./scripts/pack-gate.sh');
  });

  it('keeps the pack gate on a job that needs a built, tested tree', () => {
    expect(jobInlineRuns(ciWorkflow, 'package-smoke')).toContain('./scripts/pack-gate.sh');
    expect(ciWorkflow).toMatch(/package-smoke:[\s\S]*?needs:\s*\[build-test\]/);
  });
});

describe('the release workflow stays inert until Jordan enables it', () => {
  // Ruled by o-prime at e6e0b89 and relayed by the PM. NOT a new policy: the
  // standing brief for this repo already says release enablement is Jordan's and
  // these workflows sit INERT until then. A workflow that fires on every push to
  // main and reds on an empty token is not inert — it fails CLOSED, which is
  // safe, but "nothing ships" and "nothing runs" are different promises and only
  // the first was ever true. This block holds the trigger to the second.
  const releaseWorkflow = readFileSync(join(repoRoot, '.github/workflows/release.yml'), 'utf8');

  /** The `push:` trigger's branch list, as written. Throws if the trigger moved. */
  function pushBranches(source: string): string[] {
    const match = /\n {2}push:\n {4}branches:\s*\[([^\]]*)\]/.exec(source);
    if (!match) throw new Error('release.yml has no `push: branches: [...]` trigger to read');
    return match[1]
      .split(',')
      .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
      .filter((entry) => entry !== '');
  }

  it('does not fire on a push to main', () => {
    expect(
      pushBranches(releaseWorkflow),
      'release.yml fires on main again — restoring it needs the RELEASE_PLEASE_TOKEN secret and an npm trusted publisher, or every push to main carries a red run',
    ).not.toContain('main');
  });

  it('still fires on canary branches, so the release path stays exercisable', () => {
    // The half of the ruling most likely to be lost to a tidy-up. Without this
    // the publish path becomes unprovable before merge, and nobody finds out
    // until the day it is needed.
    expect(pushBranches(releaseWorkflow)).toContain('canary/**');
    expect(releaseWorkflow).toMatch(/\n {2}workflow_dispatch:/);
  });

  it('documents the one-line restore', () => {
    // A gate whose undo is undiscoverable is a trap for whoever enables release.
    expect(releaseWorkflow).toContain("branches: [main, 'canary/**']");
  });

  it('throws rather than passing if the trigger is restructured', () => {
    expect(() => pushBranches('on:\n  workflow_dispatch: {}\n')).toThrow(/no `push: branches/);
  });
});

describe('the parity guard cannot silently skip', () => {
  // These rows are the guard's own mutation proof, kept permanently rather than
  // run once by hand: they prove the parsers FAIL when their target vanishes.
  // Without them "CI parity holds" and "the parser found nothing" are the same
  // green, which is the exact failure mode this whole file was written for.

  it('throws when the checks recipe is gone', () => {
    expect(() => checksGateCommands('build:\n    npm run build\n')).toThrow(/no recipe "checks:"/);
  });

  it('throws when a gate the recipe names does not exist', () => {
    expect(() => checksGateCommands('checks:\n    just nope\n')).toThrow(/no recipe "nope:"/);
  });

  it('throws when the CI job is gone', () => {
    expect(() => jobInlineRuns(ciWorkflow, 'no-such-job')).toThrow(/no job "no-such-job"/);
  });

  it('throws rather than returning an empty run list', () => {
    expect(() => jobInlineRuns('jobs:\n  empty:\n    name: empty\n', 'empty')).toThrow(
      /runs no inline commands/,
    );
  });
});
