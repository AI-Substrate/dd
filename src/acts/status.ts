import type { Command } from 'commander';
import { type Envelope, formatOk, formatUnconfigured } from '../output/envelope.js';
import { exitWithEnvelope } from '../output/exit.js';
import { type CliIo, createOutputPort } from '../output/output-port.js';
import type { ActDeps } from './shared.js';

/**
 * Verbs that exist in harness-engineering (`harness dd …`) and are destined for
 * this package. This list is the port ledger: `status` reports `unconfigured`
 * until every entry has landed here, so the CLI can never claim to be finished
 * while the port is still in flight.
 */
export const PLANNED_VERBS = [
  'validate',
  'schema',
  'docs',
  'build',
  'address',
  'link',
  'links',
  'graph',
  'doctor',
  'write',
] as const;

export type PlannedVerb = (typeof PLANNED_VERBS)[number];

/**
 * The command name(s) whose presence PROVES a planned verb has landed.
 *
 * Nine of the ten register a command of their own name. The tenth does not:
 * upstream's writer family (`acts/dd/write.ts`) registers `get`, `set`, `add` and
 * `rm`, and nothing called `write` — `write` is the family's name, not a command.
 * Matching the ledger on the bare name would therefore leave `write` permanently
 * unported no matter how much of it worked, so the family is proven by all four
 * of its commands being registered. Partial registration stays unported, which is
 * the honest answer.
 */
const PROVING_COMMANDS: Record<PlannedVerb, readonly string[]> = {
  validate: ['validate'],
  schema: ['schema'],
  docs: ['docs'],
  build: ['build'],
  address: ['address'],
  link: ['link'],
  links: ['links'],
  graph: ['graph'],
  doctor: ['doctor'],
  write: ['get', 'set', 'add', 'rm'],
};

/**
 * Build the status envelope from the verbs actually registered on the program.
 * Derived, never hand-maintained: as ported verbs register, the remaining set
 * shrinks and the status flips to `ok` on its own.
 */
export function buildStatusEnvelope(registered: string[], deps: ActDeps): Envelope {
  const isPorted = (verb: PlannedVerb): boolean =>
    PROVING_COMMANDS[verb].every((command) => registered.includes(command));
  const ported = PLANNED_VERBS.filter(isPorted);
  const remaining = PLANNED_VERBS.filter((verb) => !isPorted(verb));
  const data = { ported, remaining, planned: PLANNED_VERBS.length };

  if (remaining.length === 0) {
    return formatOk('status', data, deps.clock);
  }
  return formatUnconfigured(
    'status',
    `Port the remaining dd verbs from harness-engineering (harness/cli/src/acts/dd): ${remaining.join(', ')}`,
    deps.clock,
    { data },
  );
}

/** `ddocs status` — honest port-readiness report; the seam ported verbs slot into. */
export function registerStatusAct(program: Command, io: CliIo, deps: ActDeps): void {
  program
    .command('status')
    .description('Report which dd verbs have been ported into this package')
    .action(() => {
      const registered = program.commands.map((command) => command.name());
      exitWithEnvelope(
        buildStatusEnvelope(registered, deps),
        createOutputPort(io.mode, io.writers),
      );
    });
}
