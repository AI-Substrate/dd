#!/usr/bin/env node
/**
 * The dependency audit gate — blocking on what someone can ACT on, reporting on
 * what they cannot, and re-deriving which is which on every run.
 *
 * WHY THIS EXISTS IN THIS SHAPE. Before 2026-08-09 CI carried a step named
 * "Audit (advisory)" running `npm audit --audit-level=high || true`. That command
 * exits 1 on this tree — six high advisories — and the step reported success on
 * every commit for the life of the branch. `|| true` is an empty result sharing an
 * exit code with a passing one: the parent cause this plan has now hit five
 * separate times, sitting inside our own CI, invisible precisely because the tick
 * was green. A step that cannot fail is not a gate, and calling it "advisory" does
 * not change what a reader takes from a green tick.
 *
 * THE DESIGN RULE: block on ACTIONABLE, report on UNACTIONABLE.
 *
 *  - PRODUCTION dependencies, high or critical -> BLOCK, UNCONDITIONALLY. This is
 *    what a user installs. It passes today (`npm audit --omit=dev` exits 0), so
 *    it is a real gate rather than a permanently-red one. **The reachability
 *    check below deliberately does NOT apply here**: a shipped vulnerability is
 *    not made safe by being unfixable, and an unreachable production fix is an
 *    emergency for a human, not something a gate quietly downgrades.
 *  - DEV dependencies WITH a fix that RESOLVES -> BLOCK. Somebody can act, today.
 *  - DEV dependencies with a fix that DOES NOT RESOLVE from the configured
 *    registry -> PENDING. Reported distinctly, not blocking. Learned the hard
 *    way on 2026-08-09: `fixAvailable` is a PROXY for "actionable" and that proxy
 *    is REGISTRY-RELATIVE. The same commit and lockfile gave two verdicts — six
 *    advisories with no fix locally, one fixable in CI — because the local
 *    registry is a mirror lagging the public one, and it 404s the fixed version.
 *    Nobody can act on a version their registry will not serve.
 *  - DEV dependencies with NO fix available -> REPORT, loudly, and do not block.
 *    A gate that fails for a reason nobody can fix trains everyone to skip the
 *    line, which is worse than no gate.
 *
 * All three dev states render differently and the REGISTRY IS NAMED IN EVERY RUN.
 * A verdict whose hidden variable is the environment is the parent defect this
 * whole plan is about; printing the environment is what stops the fix from
 * closing one instance and leaving the class open.
 *
 * AND THE PART THAT MATTERS MOST: `fixAvailable` IS RE-DERIVED, NEVER BAKED.
 * Today all six dev advisories are unfixable transitives under vitest. That is a
 * LIMITATION RECORD, and this plan has spent a day proving those go stale
 * silently — the morning it did, an exemption written as "none of these are
 * fixable" would hide a fix that had become available. So the exemption is not a
 * list of package names and it is not a date. It is a QUESTION asked on every
 * run: is there anything to do about this? The moment the answer changes, the
 * gate reddens by itself and nobody has to have remembered.
 *
 * Failure output NAMES every offending advisory rather than reporting a bare
 * non-zero exit, so a planted-defect proof of this gate verifies its own plant.
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

/**
 * `npm audit --json`, tolerating its non-zero exit when advisories exist.
 *
 * Throws only when the audit could not RUN. That distinction is the whole point:
 * "no vulnerabilities" and "could not check" must never share an outcome.
 */
function audit(extraArgs) {
  let raw;
  try {
    raw = execFileSync('npm', ['audit', '--json', ...extraArgs], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    // npm exits 1 when it FINDS something; that is a successful audit with a
    // non-zero code, and stdout still holds the report.
    raw = err.stdout;
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new Error(
        `npm audit could not run (${err.message.split('\n')[0]}). ` +
          'Treating an unrunnable audit as a PASS is the defect this gate exists to remove.',
      );
    }
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('npm audit produced output that is not JSON; the gate did not run.');
  }
}

const blockingFrom = (report) =>
  Object.entries(report.vulnerabilities ?? {})
    .filter(([, v]) => BLOCKING_SEVERITIES.has(v.severity))
    .map(([name, v]) => ({ name, severity: v.severity, fixAvailable: v.fixAvailable }));

/**
 * The whole decision, as a pure function of two audit reports.
 *
 * Split out so it can be PINNED without the network. `npm audit` reaches the
 * registry, so a test that drove this script end to end would be slow and
 * flaky — and the alternative, leaving it untested, means nothing catches a
 * future edit that makes the gate always pass. That is the shape this plan
 * keeps meeting: a gate nobody proved is a gate nobody can trust. Fixture
 * reports in `test/audit-gate.test.ts` exercise every branch instead.
 */
export function classify(productionReport, everythingReport, isFixReachable = () => true) {
  const prod = blockingFrom(productionReport);
  const prodNames = new Set(prod.map((f) => f.name));
  const dev = blockingFrom(everythingReport).filter((f) => !prodNames.has(f.name));

  const devActionable = [];
  const devPending = [];
  const devUnactionable = [];
  for (const f of dev) {
    if (!f.fixAvailable) {
      devUnactionable.push(f);
      continue;
    }
    // REACHABILITY IS A DEV-COLUMN CONCERN ONLY — see the note above `main`.
    // `fixAvailable: true` (bare boolean) names no target version, so there is
    // nothing to probe; treat it as reachable, which errs toward blocking.
    if (f.fixAvailable === true || isFixReachable(f.fixAvailable)) devActionable.push(f);
    else devPending.push(f);
  }
  return { production: prod, devActionable, devPending, devUnactionable };
}

const describeFix = (fixAvailable) => {
  if (!fixAvailable) return 'no fix available';
  if (fixAvailable === true) return 'FIX AVAILABLE';
  const major = fixAvailable.isSemVerMajor ? ', semver-major' : '';
  return `FIX AVAILABLE -> ${fixAvailable.name}@${fixAvailable.version}${major}`;
};

/** The registry actually consulted. Named in every run — see the note in `main`. */
function currentRegistry() {
  try {
    return execFileSync('npm', ['config', 'get', 'registry'], { encoding: 'utf8' }).trim();
  } catch {
    return '(could not read npm config)';
  }
}

/** Can this registry actually serve the fixed version? */
function fixResolves(fix) {
  if (!fix || typeof fix !== 'object' || !fix.name || !fix.version) return true;
  try {
    execFileSync('npm', ['view', `${fix.name}@${fix.version}`, 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const registry = currentRegistry();
  const {
    production: prodFindings,
    devActionable,
    devPending,
    devUnactionable,
  } = classify(audit(['--omit=dev']), audit([]), fixResolves);
  const devTotal = devActionable.length + devPending.length + devUnactionable.length;

  // stdout is data in npm lifecycles; the report goes to stderr.
  const say = (line) => console.error(line);

  // THE REGISTRY IS NAMED ON EVERY RUN, PASS OR FAIL. On 2026-08-09 the same
  // commit and the same lockfile produced two different verdicts — six dev
  // advisories with no fix locally, one with a fix in CI — because the local
  // registry is a mirror that lagged the public one and 404s the fixed version.
  // Nothing in either output said which registry produced it. A verdict whose
  // hidden variable is the environment is the parent defect of this whole plan,
  // so the environment is printed rather than assumed.
  say(`audit-gate: registry ${registry}`);
  say(
    `audit-gate: production high/critical: ${prodFindings.length} | ` +
      `dev high/critical: ${devTotal} ` +
      `(${devActionable.length} fixable, ${devPending.length} pending, ` +
      `${devUnactionable.length} no fix)`,
  );

  // Three states, three renderings, never collapsed into each other.
  if (devPending.length > 0) {
    say('  PENDING — dev-only, fix published upstream but NOT SERVABLE by this registry:');
    for (const f of devPending) {
      say(`    - ${f.name} (${f.severity}) — wants ${describeFix(f.fixAvailable)}`);
    }
    say('    Nobody can act on these HERE: the fixed version does not resolve from');
    say('    the registry above. Not ignored and not blocking — this goes RED by');
    say('    itself the day that registry serves the fix.');
  }

  if (devUnactionable.length > 0) {
    say('  NON-BLOCKING — dev-only, no fix published upstream today:');
    for (const f of devUnactionable) say(`    - ${f.name} (${f.severity})`);
    say('    These do not reach anyone who installs this package. They are reported');
    say('    rather than ignored, and re-checked every run: the moment any of them');
    say('    becomes fixable this gate goes RED without anyone having to remember.');
  }

  const failures = [
    ...prodFindings.map(
      (f) => `  PRODUCTION ${f.severity}: ${f.name} — ${describeFix(f.fixAvailable)}`,
    ),
    ...devActionable.map((f) => `  DEV ${f.severity}: ${f.name} — ${describeFix(f.fixAvailable)}`),
  ];

  if (failures.length === 0) {
    say('audit-gate OK — nothing actionable at high or critical.');
    return 0;
  }

  say(`audit-gate FAIL — ${failures.length} actionable advisory/advisories:`);
  for (const line of failures) say(line);
  say('');
  say('  Production findings reach users and always block.');
  say('  Dev findings block ONLY when a fix exists — which means one just appeared.');
  say('  Run `npm audit` for detail, `npm audit fix` where a fix is offered.');
  return 1;
}

// Guarded so `classify` can be imported without running two network audits.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
