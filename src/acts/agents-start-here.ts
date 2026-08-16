import type { Command } from 'commander';
import type { Clock } from '../adapters/clock/clock-port.js';
import type { DdDocContent, DdDocRecord } from '../docs/contract.js';
import { getDdDoc } from '../docs/dd-docs-service.js';
import { type Envelope, formatError, formatOk } from '../output/envelope.js';
import { ErrorCodes } from '../output/error-codes.js';
import { emitRawAndExit, exitWithEnvelope } from '../output/exit.js';
import { type CliIo, createOutputPort } from '../output/output-port.js';
import type { ActDeps } from './shared.js';

/**
 * The doc this verb exists to deliver.
 *
 * `deterministic-documents`, not `dd-overview`, and the choice is a ruling rather
 * than a preference: it is the only baked entry that opens by addressing THIS
 * reader — "If you are an agent meeting a dd mid-task, the two rules that keep
 * you safe" — and those two rules (never hand-edit a `.dd.md`, write through the
 * CLI) are the paragraph the verb exists to put in front of an agent before it
 * touches anything. Changing this id is a decision to make with the o-prime, not
 * an edit; `agents-start-here.test.ts` reds on it deliberately.
 */
export const AGENTS_START_HERE_DOC_ID = 'deterministic-documents';

/** Shown in `ddocs --help`. First line an agent reads about this CLI. */
export const AGENTS_START_HERE_SUMMARY =
  'START HERE if you are an agent — print the dd orientation before touching a document';

/**
 * The `--help` footer that makes the verb an OBVIOUS first move rather than one
 * more row in an alphabet of thirteen.
 *
 * Position alone is not enough. `--help` is read by something that is scanning
 * for the verb matching a task it already has, and "agents-start-here" only
 * looks relevant to a reader who already knows it is relevant. The footer says
 * what to run and why, in the imperative, once.
 */
export const AGENTS_START_HERE_HELP_FOOTER = `
New here? Run \`ddocs agents-start-here\` first — it prints the orientation for
agents working with deterministic documents (what a .dd.json/.dd.md pair is, why
you must never hand-edit the rendered sibling, and how to write through the CLI).`;

/**
 * Build the envelope for the verb, purely, from the baked corpus.
 *
 * Split out for the same reason `buildStatusEnvelope` is: the ONE branch that
 * cannot be reached through the shipped bin — the corpus no longer carrying the
 * doc — is reachable here, through the `docs` seam the service already exposes
 * for fakes. A verb whose failure path is untestable is a verb whose failure
 * path is untested.
 *
 * The lookup goes through `getDdDoc`, the same function `ddocs docs get` calls.
 * That is the whole implementation strategy: this verb is an ALIAS with an
 * opinion about which id, and it holds no copy of the markdown. A second copy of
 * that body anywhere in the tree is a defect, not a convenience.
 */
export function buildAgentsStartHereEnvelope(
  clock: Clock,
  docs?: readonly DdDocRecord[],
): Envelope {
  const lookup =
    docs === undefined
      ? getDdDoc(AGENTS_START_HERE_DOC_ID)
      : getDdDoc(AGENTS_START_HERE_DOC_ID, docs);
  if ('notFound' in lookup) {
    // Unreachable from the shipped bin — the id is a constant and the corpus is
    // compiled in — so this is what a BROKEN BUILD says, not what a user typo
    // says. It names the id and points at the surface that can prove the corpus,
    // rather than inviting a retry that cannot succeed.
    return formatError(
      'agents-start-here',
      ErrorCodes.DD_DOCS_ENTRY_NOT_FOUND,
      `the baked corpus is missing "${AGENTS_START_HERE_DOC_ID}" — this build cannot answer agents-start-here`,
      clock,
      { next_action: 'Run `ddocs docs list` to see what this build actually carries.' },
    );
  }
  return formatOk('agents-start-here', lookup, clock, {
    next_action:
      'Run `ddocs docs list` for the rest of the baked guidance, or `ddocs --help` for the verbs.',
  });
}

/**
 * `ddocs agents-start-here` — the single-pager an agent meeting this CLI reads first.
 *
 * NOT a member of `PLANNED_VERBS`. That roster measures the port out of
 * `AI-Substrate/harness-engineering`, which finished at 10/10; this verb is
 * native to dd and has no upstream to be ported from. Adding it there would
 * move a number that records a historical fact — so `ddocs status` still reports
 * ten of ten after this lands, and a test says so.
 */
export function registerAgentsStartHereCommand(program: Command, io: CliIo, deps: ActDeps): void {
  program
    .command('agents-start-here')
    .description(AGENTS_START_HERE_SUMMARY)
    .action(() => {
      const envelope = buildAgentsStartHereEnvelope(deps.clock);
      // An error leaves through the envelope in EITHER mode — human mode dumps
      // markdown, and a failure has no markdown to dump.
      if (io.mode === 'json' || envelope.status !== 'ok') {
        exitWithEnvelope(envelope, createOutputPort(io.mode, io.writers));
      }
      // Human mode dumps the markdown verbatim and exits NATURALLY, so a large
      // piped doc is never truncated by an early hard exit racing the stdout
      // flush — the `ddocs docs get` precedent, and the reason byte-parity
      // between the two is assertable at all.
      emitRawAndExit((envelope.data as DdDocContent).content, io.writers);
    });

  program.addHelpText('after', AGENTS_START_HERE_HELP_FOOTER);
}
