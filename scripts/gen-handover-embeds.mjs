#!/usr/bin/env node
/**
 * Derives the two VERBATIM blocks in the koala handover packet from their real
 * sources, in the same operation that writes them:
 *
 *   - the execution guardrails, read out of plan.dd.json through the shipped bin;
 *   - the standing constraints, read out of government/standing-constraints.md.
 *
 * Why this is generated rather than pasted. Both blocks exist because koala
 * intends to CITE them, and a rule someone intends to cite has to arrive
 * matching the enforced version. A hand-pasted copy cannot promise that: the
 * guardrail block went stale inside a single review cycle when guardrail 9 was
 * amended upstream, which is the same defect the packet itself warns about.
 * The packet's own rule is "derive anything that must read as current", so
 * pasting a second copy would have made the document violate its headline.
 *
 * `--check` is the drift gate, mirroring check-dd-docs.mjs and
 * gen-orient-state.mjs.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const TARGET = 'docs/plans/001-dd-extraction/assets/handover-packet.md';
const PLAN = 'docs/plans/001-dd-extraction/plan.dd.json';
const CONSTRAINTS = 'government/standing-constraints.md';

const BLOCKS = [
  {
    name: 'guardrails',
    open: '<!-- BEGIN GENERATED: guardrails (scripts/gen-handover-embeds.mjs) -->',
    close: '<!-- END GENERATED: guardrails -->',
    render: renderGuardrails,
  },
  {
    name: 'constraints',
    open: '<!-- BEGIN GENERATED: constraints (scripts/gen-handover-embeds.mjs) -->',
    close: '<!-- END GENERATED: constraints -->',
    render: renderConstraints,
  },
];

/** The commit that last changed a source — the only honest thing to stamp a copy with. */
function sourceStamp(path) {
  // A SHALLOW clone cannot answer "which commit last changed this path". It does
  // not error — `git log -1 -- <path>` just returns the one commit it has, so
  // every source stamps to the checkout SHA and the check reds with a message
  // blaming the packet. That is a tool returning a clean answer to a question it
  // cannot see, which is the exact failure the stamps exist to prevent, so this
  // refuses to compute rather than compute something wrong.
  const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
    encoding: 'utf8',
  }).trim();
  if (shallow === 'true') {
    throw new Error(
      'this is a SHALLOW clone, so the commit that last changed each source cannot be derived.\n' +
        'Every path would stamp to the checkout SHA — a WRONG stamp, not a missing one.\n' +
        'In CI: give the checkout full history (actions/checkout with `fetch-depth: 0`).\n' +
        'Locally: `git fetch --unshallow`.',
    );
  }
  const dirty = execFileSync('git', ['status', '--porcelain', '--', path], { encoding: 'utf8' });
  if (dirty.trim() !== '') {
    throw new Error(
      `${path} has uncommitted changes, so a verbatim copy of it cannot be stamped.\n` +
        'Authority is a SHA, never a working tree (guardrail 13): commit the source first,\n' +
        'then run `just gen-handover`.',
    );
  }
  const sha = execFileSync('git', ['log', '-1', '--format=%h', '--', path], {
    encoding: 'utf8',
  }).trim();
  if (sha === '') {
    throw new Error(`${path} has no commit history — nothing to stamp a verbatim copy against.`);
  }
  return sha;
}

/** Read the guardrail rows through the bin — never from a copy in this file. */
function readGuardrails() {
  const raw = execFileSync('node', ['bin/dd.js', '--json', 'get', `${PLAN}#execution_guardrails`], {
    encoding: 'utf8',
  });
  const { status, data } = JSON.parse(raw);
  if (status !== 'ok' || !Array.isArray(data?.value)) {
    throw new Error(`${PLAN}#execution_guardrails did not read back as a list (status ${status}).`);
  }
  if (data.value.length === 0) {
    throw new Error(`${PLAN}#execution_guardrails is empty — that is a broken source, not a clean one.`);
  }
  return data.value;
}

function renderGuardrails() {
  const rows = readGuardrails();
  return [
    `**Reproduced verbatim as of \`${sourceStamp(PLAN)}\`** — ${rows.length} rows, the commit that`,
    `last changed the source. This is a stamped past-tense copy, not a claim to be current:`,
    `these rows move as the o-prime amends them (row 9 was amended twice while this packet sat`,
    `in review). Check whether yours is stale, and re-pull the live version, with:`,
    '',
    '```bash',
    `dd get "${PLAN}#execution_guardrails"`,
    `git log -1 --format=%h -- ${PLAN}   # newer than the stamp above? re-pull.`,
    '```',
    '',
    '```',
    rows.map((row, index) => `${index + 1}. ${row}`).join('\n\n'),
    '```',
  ].join('\n');
}

/** The constraint bodies, lifted whole from the file that binds this subtree. */
function readConstraints() {
  const source = readFileSync(CONSTRAINTS, 'utf8');
  const body = source.slice(source.indexOf('\n## 1 —'));
  const sections = body
    .split(/\n(?=## \d+ — )/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);
  if (sections.length === 0) {
    throw new Error(`${CONSTRAINTS}: no numbered constraints found — that is a broken source.`);
  }
  return sections;
}

function renderConstraints() {
  const sections = readConstraints();
  return [
    `**Reproduced verbatim as of \`${sourceStamp(CONSTRAINTS)}\`** — ${sections.length} constraints,`,
    `the commit that last changed the source. Cite them BY NUMBER. Stamped past-tense copy:`,
    `check whether yours is stale, and re-pull, with:`,
    '',
    '```bash',
    `git log -1 --format=%h -- ${CONSTRAINTS}   # newer than the stamp above? re-pull.`,
    '```',
    '',
    '```',
    sections.join('\n\n'),
    '```',
  ].join('\n');
}

export function generateHandoverEmbeds({ check = false } = {}) {
  let current = readFileSync(TARGET, 'utf8');
  const original = current;

  for (const block of BLOCKS) {
    const start = current.indexOf(block.open);
    const end = current.indexOf(block.close);
    if (start === -1 || end === -1) {
      console.error(`${TARGET}: generated ${block.name} block missing (expected ${block.open}).`);
      process.exit(1);
    }
    const rendered = `${block.open}\n\n${block.render()}\n\n${block.close}`;
    current = current.slice(0, start) + rendered + current.slice(end + block.close.length);
  }

  if (current === original) {
    console.log(`${TARGET}: guardrail and constraint blocks up to date.`);
    return;
  }
  if (check) {
    console.error(
      `${TARGET}: an embedded VERBATIM block no longer matches its source.\n` +
        'The packet quotes rules koala intends to CITE, so a stale copy is a wrong contract.\n' +
        'Run `just gen-handover` and commit the result.',
    );
    process.exit(1);
  }
  writeFileSync(TARGET, current);
  console.log(`${TARGET}: guardrail and constraint blocks regenerated.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateHandoverEmbeds({ check: process.argv.includes('--check') });
}
