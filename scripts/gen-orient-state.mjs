#!/usr/bin/env node
/**
 * Derives the repo-state paragraph in `.harness/government/orient-local.md` from the
 * shipped bin, in the same operation that writes it.
 *
 * Why this exists rather than a hand-written line: orient-local is the mandatory
 * first read for every new seat, and it carried a paragraph beginning "Measured:"
 * that was inherited, not derived — it still claimed `ported: []`, `remaining: 10`
 * and exit 2 long after the port had landed. The word "Measured" is what made it
 * dangerous: it reads as evidence. A reader who trusted it concluded the port had
 * never happened.
 *
 * A hand-written measurement inside the file that teaches agents not to trust
 * hand-written measurements is the sharpest form of the defect this repo keeps
 * catching, so the fix is the repo's own rule applied to the file that states it:
 * derive the figure in the operation that prints it. `--check` is the drift gate,
 * mirroring `check-dd-docs.mjs`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const TARGET = '.harness/government/orient-local.md';
const OPEN = '<!-- BEGIN GENERATED: repo-state (scripts/gen-orient-state.mjs) -->';
const CLOSE = '<!-- END GENERATED: repo-state -->';

/** Read the port ledger from the shipped bin — never from memory or a constant. */
function readLedger() {
  const raw = execFileSync('node', ['bin/dd.js', '--json', 'status'], {
    encoding: 'utf8',
  });
  const { status, data } = JSON.parse(raw);
  return { status, ...data };
}

function renderBlock({ status, ported, remaining, planned }) {
  const done = remaining.length === 0;
  const headline = done
    ? '**The repo\'s actual state: the port has landed.** Every planned verb is registered and working.'
    : `**The repo's actual state: port in flight.** ${ported.length} of ${planned} verbs registered.`;
  const verbs = ported.length === 0 ? '(none yet)' : ported.map((v) => `\`${v}\``).join(', ');
  return [
    OPEN,
    '',
    headline,
    '',
    `Derived from the shipped bin by \`just gen-orient\` — **do not hand-edit this block**,`,
    `and do not restate these numbers in prose elsewhere in this file.`,
    '',
    `- \`dd --json status\` → status **${status}**, ${ported.length}/${planned} ported, ${remaining.length} remaining`,
    `- Registered: ${verbs}`,
    remaining.length > 0 ? `- Remaining: ${remaining.map((v) => `\`${v}\``).join(', ')}` : null,
    `- Re-derive: \`node bin/dd.js --json status\``,
    '',
    CLOSE,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function generateOrientState({ check = false } = {}) {
  const current = readFileSync(TARGET, 'utf8');
  const start = current.indexOf(OPEN);
  const end = current.indexOf(CLOSE);
  if (start === -1 || end === -1) {
    console.error(`${TARGET}: generated repo-state block missing (expected ${OPEN}).`);
    process.exit(1);
  }

  const next =
    current.slice(0, start) + renderBlock(readLedger()) + current.slice(end + CLOSE.length);

  if (next === current) {
    console.log(`${TARGET}: repo-state block up to date.`);
    return;
  }
  if (check) {
    console.error(
      `${TARGET}: repo-state block is STALE — it no longer matches \`dd --json status\`.\n` +
        'Run `just gen-orient` and commit the result.',
    );
    process.exit(1);
  }
  writeFileSync(TARGET, next);
  console.log(`${TARGET}: repo-state block regenerated.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateOrientState({ check: process.argv.includes('--check') });
}
