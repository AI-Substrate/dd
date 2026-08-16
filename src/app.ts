import { Command, CommanderError } from 'commander';
import { registerAddressCommands } from './acts/address.js';
import { registerAgentsStartHereCommand } from './acts/agents-start-here.js';
import { registerBuildCommand } from './acts/build.js';
import { registerDocsCommands } from './acts/docs.js';
import { registerDoctorCommand } from './acts/doctor.js';
import { registerGraphCommand } from './acts/graph.js';
import { registerLinkCommands } from './acts/link.js';
import { registerLinksCommand } from './acts/links.js';
import { registerSchemaCommands } from './acts/schema.js';
import type { ActDeps } from './acts/shared.js';
import { registerStatusAct } from './acts/status.js';
import { registerValidateCommand } from './acts/validate.js';
import { registerVersionAct } from './acts/version.js';
import { registerWriterCommands } from './acts/write.js';
import type { Clock } from './adapters/clock/clock-port.js';
import { SystemClock } from './adapters/clock/system-clock.js';
import { formatError } from './output/envelope.js';
import { ErrorCodes } from './output/error-codes.js';
import { exitWithEnvelope } from './output/exit.js';
import {
  type CliIo,
  createOutputPort,
  processWriters,
  selectMode,
  type Writers,
} from './output/output-port.js';
import { resolveUseColor } from './output/style.js';
import { readVersion } from './version.js';

/**
 * Tri-state read of the output flag from argv, resolved ONCE by the entrypoint.
 * Commander collapses `--json`/`--no-json` into a single boolean and loses the
 * "absent" state that lets env/TTY decide, so acts must never re-derive it.
 */
export function jsonFlag(argv: string[]): boolean | undefined {
  if (argv.includes('--no-json')) {
    return false;
  }
  if (argv.includes('--json')) {
    return true;
  }
  return undefined;
}

/** Commander error codes that mean "the user asked for help/version", not a failure. */
const INFORMATIONAL = new Set(['commander.help', 'commander.helpDisplayed', 'commander.version']);

/**
 * Let `--json` / `--no-json` be written AFTER the verb, at any depth.
 *
 * `--json` is a program-level option and `enablePositionalOptions()` hands every
 * option after the verb to the verb — which does not declare it — so
 * `ddocs status --json` died with `E002 unknown option`, while `ddocs --json status`
 * worked. The postfix form is the one people actually type, and one that only
 * works in one position is a wart, not a contract.
 *
 * The mode itself needs no repair: `jsonFlag()` reads the RAW argv, so it already
 * sees the flag wherever it sits. The only thing missing was commander's
 * permission to write it there. So the flags are declared on every command as
 * accepted no-ops, recursively, from ONE place — no ported act is edited, and a
 * verb added later inherits it for free.
 */
function acceptOutputFlagsEverywhere(command: Command): void {
  for (const sub of command.commands) {
    const declared = sub.options.some((option) => option.long === '--json');
    if (!declared) {
      sub.option('--json', 'force JSON output').option('--no-json', 'force human output');
    }
    acceptOutputFlagsEverywhere(sub);
  }
}

export function buildProgram(io: CliIo, deps: ActDeps): Command {
  const program = new Command();

  program
    .name('ddocs')
    .description('ddocs — deterministic documents: validate, render, address, and inspect.')
    .version(readVersion(), '-V, --version', 'print the ddocs version')
    .option('--json', 'force JSON output')
    .option('--no-json', 'force human output')
    .enablePositionalOptions()
    .showHelpAfterError(false)
    .configureOutput({
      writeOut: (text) => io.writers.out(text),
      writeErr: (text) => io.writers.err(text),
    })
    .exitOverride();

  // FIRST, and the position is the feature. Commander lists commands in
  // registration order, so this is the first row of `ddocs --help` and of the
  // bare-`ddocs` verb map — which is the whole point of a verb whose job is to
  // be found by someone who does not yet know what to look for. It is native to
  // dd, not a ported verb, so it sits ABOVE the frozen block below and leaves
  // that block's order untouched.
  registerAgentsStartHereCommand(program, io, deps);

  registerVersionAct(program, io, deps);
  registerStatusAct(program, io, deps);

  // Ported dd verbs register at the TOP LEVEL, not under a `dd` sub-command:
  // upstream nests them beneath `harness dd …`, but here the binary IS `ddocs`.
  // `status` derives its port ledger from exactly these registrations, so a verb
  // appearing below is a verb that works.
  //
  // The ORDER is the frozen surface (`assets/dd-surface.md`), not a preference:
  // it is the order `--help` lists them in, and `dd.test.ts` pins it.
  registerValidateCommand(program, io, deps);
  registerSchemaCommands(program, io, deps);
  registerDocsCommands(program, io, deps);
  registerBuildCommand(program, io, deps);
  registerAddressCommands(program, io, deps);
  registerLinkCommands(program, io, deps);
  registerLinksCommand(program, io, deps);
  registerGraphCommand(program, io, deps);
  registerDoctorCommand(program, io, deps);
  registerWriterCommands(program, io, deps);

  acceptOutputFlagsEverywhere(program);

  return program;
}

/** True when argv carries no command operand (bare `dd`, or only global flags). */
function hasOperand(argv: string[]): boolean {
  return argv.slice(2).some((arg) => !arg.startsWith('-'));
}

function wantsBuiltinInfo(argv: string[]): boolean {
  return argv.slice(2).some((arg) => ['-h', '--help', '-V', '--version'].includes(arg));
}

export interface MainOverrides {
  writers?: Writers;
  env?: NodeJS.ProcessEnv;
  isTty?: boolean;
  clock?: Clock;
}

export async function main(argv: string[] = process.argv, overrides: MainOverrides = {}) {
  const writers = overrides.writers ?? processWriters;
  const env = overrides.env ?? process.env;
  const isTty = overrides.isTty ?? Boolean(process.stdout.isTTY);
  const mode = selectMode({ json: jsonFlag(argv) }, env, isTty);
  const io: CliIo = { mode, writers, useColor: resolveUseColor({ mode, isTty, env }) };
  const deps: ActDeps = { clock: overrides.clock ?? new SystemClock() };

  const program = buildProgram(io, deps);

  // Bare `dd` (or global flags only) is a discovery gesture, not an error: show
  // the verb map and exit 0, the same as `ddocs --help`.
  if (!hasOperand(argv) && !wantsBuiltinInfo(argv)) {
    program.outputHelp();
    process.exitCode = 0;
    return;
  }

  try {
    await program.parseAsync(argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      if (INFORMATIONAL.has(err.code) || err.exitCode === 0) {
        process.exitCode = 0;
        return;
      }
      const code =
        err.code === 'commander.unknownCommand'
          ? ErrorCodes.UNKNOWN_COMMAND
          : ErrorCodes.INVALID_USAGE;
      exitWithEnvelope(
        formatError('dd', code, err.message.replace(/^error: /, ''), deps.clock, {
          next_action: 'Run `ddocs --help` for the supported verbs.',
        }),
        createOutputPort(io.mode, io.writers),
      );
    }
    throw err;
  }
}
