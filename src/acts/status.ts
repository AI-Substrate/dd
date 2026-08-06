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

/**
 * Build the status envelope from the verbs actually registered on the program.
 * Derived, never hand-maintained: as ported verbs register, the remaining set
 * shrinks and the status flips to `ok` on its own.
 */
export function buildStatusEnvelope(registered: string[], deps: ActDeps): Envelope {
  const ported = PLANNED_VERBS.filter((verb) => registered.includes(verb));
  const remaining = PLANNED_VERBS.filter((verb) => !registered.includes(verb));
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

/** `dd status` — honest port-readiness report; the seam ported verbs slot into. */
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
