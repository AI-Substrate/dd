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
 *  - PRODUCTION dependencies, high or critical -> BLOCK. This is what a user
 *    installs. It passes today (`npm audit --omit=dev` exits 0), so it is a real
 *    gate rather than a permanently-red one.
 *  - DEV dependencies WITH a fix available -> BLOCK. Somebody can act, today.
 *  - DEV dependencies with NO fix available -> REPORT, loudly, and do not block.
 *    A gate that fails for a reason nobody can fix trains everyone to skip the
 *    line, which is worse than no gate.
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
export function classify(productionReport, everythingReport) {
  const prod = blockingFrom(productionReport);
  const prodNames = new Set(prod.map((f) => f.name));
  const dev = blockingFrom(everythingReport).filter((f) => !prodNames.has(f.name));
  return {
    production: prod,
    devActionable: dev.filter((f) => Boolean(f.fixAvailable)),
    devUnactionable: dev.filter((f) => !f.fixAvailable),
  };
}

const describeFix = (fixAvailable) => {
  if (!fixAvailable) return 'no fix available';
  if (fixAvailable === true) return 'FIX AVAILABLE';
  const major = fixAvailable.isSemVerMajor ? ', semver-major' : '';
  return `FIX AVAILABLE -> ${fixAvailable.name}@${fixAvailable.version}${major}`;
};

function main() {
  const {
    production: prodFindings,
    devActionable,
    devUnactionable,
  } = classify(audit(['--omit=dev']), audit([]));
  const devTotal = devActionable.length + devUnactionable.length;

  // stdout is data in npm lifecycles; the report goes to stderr.
  const say = (line) => console.error(line);

  say(
    `audit-gate: production high/critical: ${prodFindings.length} | ` +
      `dev high/critical: ${devTotal} ` +
      `(${devActionable.length} fixable, ${devUnactionable.length} not)`,
  );

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
