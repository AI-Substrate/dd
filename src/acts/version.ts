import type { Command } from 'commander';
import { formatOk } from '../output/envelope.js';
import { exitWithEnvelope } from '../output/exit.js';
import { type CliIo, createOutputPort } from '../output/output-port.js';
import { readVersion } from '../version.js';
import type { ActDeps } from './shared.js';

/** `ddocs version` — the envelope-bearing twin of the bare `--version` flag. */
export function registerVersionAct(program: Command, io: CliIo, deps: ActDeps): void {
  program
    .command('version')
    .description('Report the installed ddocs version as an envelope')
    .action(() => {
      const env = formatOk(
        'version',
        { version: readVersion(), node: process.versions.node },
        deps.clock,
      );
      exitWithEnvelope(env, createOutputPort(io.mode, io.writers));
    });
}
