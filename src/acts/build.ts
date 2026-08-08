import type { Command } from 'commander';
import type { Clock } from '../adapters/clock/clock-port.js';
import { SystemClock } from '../adapters/clock/system-clock.js';
import { NodeFs } from '../adapters/fs/node-fs.js';
import { NodeProcess } from '../adapters/process/node-process.js';
import { NodeSchemaFs } from '../node/index.js';
import { type BuildSuccess, renderDocument } from '../node/render-document.js';
import { type Envelope, formatDegraded, formatError, formatOk } from '../output/envelope.js';
import { ErrorCodes } from '../output/error-codes.js';
import { exitWithEnvelope } from '../output/exit.js';
import { type CliIo, createOutputPort } from '../output/output-port.js';
import type { DdAdapterIssue } from '../render/contract.js';
import { posixDirname, resolveInRepo, toPosix } from '../shared/posix-path.js';
import type { DdActDeps } from './shared.js';

export {
  type BuildFailure,
  type BuildResult,
  type BuildSuccess,
  renderDocument,
  siblingPath,
} from '../node/render-document.js';

/**
 * Best-effort sibling regeneration for a document whose SOURCE IS ALREADY
 * CORRECT ON DISK — the transclusion watcher's case (plan 3.4): a dependent's
 * `.dd.md` went stale because something it cites changed, so re-rendering it is
 * pure repair and a failure leaves the world exactly as it found it.
 *
 * NOT for a mutating verb. A verb that changes a document and then regenerates
 * best-effort can report success while leaving source and sibling out of step —
 * manufacturing the very drift `dd build --check` exists to catch. Mutating verbs
 * use {@link writeDocumentWithSibling}, which stages the render first and rolls
 * the source back if either write fails.
 */
export async function autoRegenerateSibling(
  documentPath: string,
  repoRoot: string,
  io: CliIo,
): Promise<{ regenerated: boolean; reason?: string }> {
  try {
    const result = await renderDocument(documentPath, repoRoot);
    if (!result.ok) {
      io.writers.err(
        `warning: dd sibling not regenerated for ${documentPath}: ${result.message}\n`,
      );
      return { regenerated: false, reason: result.message };
    }
    const fs = new NodeFs();
    fs.mkdirp(posixDirname(result.sibling));
    fs.writeText(result.sibling, result.markdown);
    return { regenerated: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    io.writers.err(`warning: dd sibling not regenerated for ${documentPath}: ${reason}\n`);
    return { regenerated: false, reason };
  }
}

/** Which half of the atomic write gave way — the caller reports it verbatim. */
export type DocumentWriteStage = 'render' | 'source' | 'sibling';

export interface DocumentWriteFailure {
  ok: false;
  stage: DocumentWriteStage;
  code: string;
  message: string;
  next_action: string;
  /**
   * True when the source file on disk is byte-identical to before the call —
   * the property that makes the refusal honest. False means the rollback itself
   * failed, which is a louder problem than the original one.
   */
  restored: boolean;
  details?: unknown;
}

export interface DocumentWriteSuccess {
  ok: true;
  path: string;
  sibling: string;
  warnings: Array<DdAdapterIssue & { code: string }>;
}

export type DocumentWriteResult = DocumentWriteSuccess | DocumentWriteFailure;

function restoreSource(fs: NodeFs, path: string, previousText: string): boolean {
  try {
    fs.writeText(path, previousText);
    return fs.readText(path) === previousText;
  } catch {
    return false;
  }
}

/**
 * Persist a mutated dd document AND its sibling markdown as one operation, or
 * persist neither.
 *
 * The order is the whole point. The render is staged from the new text while the
 * old text is still the bytes on disk, so the expensive, failure-prone half
 * (schema resolution, adapters, rendering) is proven before anything is
 * committed. Only then are the two files written, and if the second write gives
 * way the source is restored to `previousText`.
 *
 * A mutating verb therefore has exactly two outcomes a reader has to reason
 * about: source and sibling both moved, or neither did. There is no third state
 * in which the verb says `written: true` and the drift gate says otherwise.
 *
 * Both files are STAGED (`.tmp` then `rename`), the same crash-safe shape
 * `writeFlowAtomic` gives a flow source and `persistSibling` gives a flow's
 * sibling. Writing them live made the refusal a liar in exactly one case, and it
 * is the case that matters: `writeFileSync` opens with `O_TRUNC`, so a write that
 * gives way after emitting some of its bytes — ENOSPC, a disk error, a process
 * killed mid-`write(2)` — leaves a TRUNCATED `.dd.md` on disk while the rollback
 * puts only the `.dd.json` back. The verb then returned E452 saying "the document
 * was left unchanged", which was false: the repo was left in precisely the drift
 * state this function exists to make impossible, and `dd build --check` would
 * later report it as a hand-edit. "It threw" never implied "it wrote nothing";
 * staging is what makes those two the same claim.
 */
export async function writeDocumentWithSibling(options: {
  documentPath: string;
  /** The new source text to persist. */
  text: string;
  /** The bytes currently on disk, kept for rollback. */
  previousText: string;
  repoRoot: string;
}): Promise<DocumentWriteResult> {
  const { documentPath, text, previousText, repoRoot } = options;

  const rendered = await renderDocument(documentPath, repoRoot, { text });
  if (!rendered.ok) {
    return {
      ok: false,
      stage: 'render',
      code: rendered.code,
      message: `the change was refused because its sibling markdown could not be rendered: ${rendered.message}`,
      next_action: rendered.next_action,
      restored: true,
      ...(rendered.details !== undefined && { details: rendered.details }),
    };
  }

  const fs = new NodeFs();
  // Whatever a failed staged write managed to emit is scrap: drop it, so a
  // refusal leaves no half-written file for the next reader (or `git status`).
  const dropStaged = (staged: string): void => {
    try {
      fs.deleteFile(staged);
    } catch {
      /* best effort — the staged temp is not the promise, the two live files are */
    }
  };

  const stagedSource = `${documentPath}.tmp`;
  try {
    fs.writeText(stagedSource, text);
    fs.rename(stagedSource, documentPath);
  } catch (error) {
    dropStaged(stagedSource);
    return {
      ok: false,
      stage: 'source',
      code: ErrorCodes.DD_MUTATION_WRITE_FAILED,
      message: `could not write ${documentPath}: ${error instanceof Error ? error.message : String(error)}`,
      next_action: 'Check permissions on the document, then retry.',
      restored: restoreSource(fs, documentPath, previousText),
    };
  }

  const stagedSibling = `${rendered.sibling}.tmp`;
  try {
    fs.mkdirp(posixDirname(rendered.sibling));
    fs.writeText(stagedSibling, rendered.markdown);
    fs.rename(stagedSibling, rendered.sibling);
  } catch (error) {
    dropStaged(stagedSibling);
    return {
      ok: false,
      stage: 'sibling',
      code: ErrorCodes.DD_MUTATION_WRITE_FAILED,
      message: `could not write the sibling markdown ${rendered.sibling}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      next_action: `Check permissions on ${rendered.sibling}, then retry — the document was left unchanged.`,
      restored: restoreSource(fs, documentPath, previousText),
    };
  }

  return {
    ok: true,
    path: documentPath,
    sibling: rendered.sibling,
    warnings: rendered.warnings,
  };
}

/**
 * `ok` unless the render was degraded by an adapter. Workshop-003 W1 rule 5 makes
 * that loudness mandatory, and the envelope status IS the severity a gate reads
 * (KF-05) — so a degraded render surfaces without failing the build.
 */
function envelopeFor(
  outcome: 'written' | 'checked',
  data: Record<string, unknown>,
  result: BuildSuccess,
  clock: Clock,
): Envelope {
  const evidence = [{ label: 'rendered markdown', path: result.sibling }];
  const degradations = [...result.warnings, ...result.refreshIssues];
  if (degradations.length === 0) {
    return formatOk('dd build', data, clock, {
      ...(outcome === 'written' && { evidence }),
      next_action:
        outcome === 'written'
          ? 'Commit the regenerated sibling alongside the document.'
          : 'Nothing to do — the committed markdown matches the document.',
    });
  }
  const causes = [
    ...(result.warnings.length > 0
      ? [
          `${result.warnings.length} adapter issue(s) (${[
            ...new Set(result.warnings.map((warning) => warning.type)),
          ].join(', ')}) — every affected value fell back to its raw form`,
        ]
      : []),
    ...(result.refreshIssues.length > 0
      ? [`${result.refreshIssues.length} live reference(s) could not be refreshed`]
      : []),
  ].join('; ');
  return formatDegraded(
    'dd build',
    data,
    `Rendered with ${causes}. Fix the cause, or accept the degraded render.`,
    clock,
    ...(outcome === 'written' ? [{ evidence }] : []),
  );
}

export function registerBuildCommand(dd: Command, io: CliIo, deps: DdActDeps): void {
  dd.command('build <path>')
    .description('Render one .dd.json file to its deterministic .dd.md sibling')
    .option('--check', 'report byte drift without writing')
    .action(async (path: string, opts: { check?: boolean }) => {
      const clock = deps.clock ?? new SystemClock();
      const port = createOutputPort(io.mode, io.writers);
      const repoRoot = toPosix(new NodeProcess().cwd());
      const target = resolveInRepo(path, repoRoot);

      const result = await renderDocument(target, repoRoot);
      if (!result.ok) {
        exitWithEnvelope(
          formatError('dd build', result.code, result.message, clock, {
            ...(result.details !== undefined && { details: result.details }),
            next_action: result.next_action,
          }),
          port,
        );
      }

      const data = {
        path: result.path,
        sibling: result.sibling,
        schema: result.schema,
        bytes: result.markdown.length,
        adapter_warnings: result.warnings,
        refreshed_bases: result.refreshed,
        refresh_issues: result.refreshIssues,
      };

      // --check: compare against the committed sibling and NEVER write. The drift
      // gate exists to fail CI, so drift is an error even though a degraded render
      // is not (T006 ruling b); an absent sibling is drift too — committed markdown
      // is just as wrong when it is missing as when it is stale.
      if (opts.check) {
        const committed = new NodeSchemaFs().readText(result.sibling);
        if (committed !== result.markdown) {
          exitWithEnvelope(
            formatError(
              'dd build',
              ErrorCodes.DD_RENDER_DRIFT,
              committed === null
                ? `no rendered sibling to check against: ${result.sibling}`
                : `${result.sibling} drifted from the render of ${result.path}`,
              clock,
              {
                details: { ...data, drift: true },
                next_action: `Regenerate with \`dd build ${path}\` and commit the result.`,
              },
            ),
            port,
          );
        }
        exitWithEnvelope(envelopeFor('checked', { ...data, drift: false }, result, clock), port);
      }

      try {
        const fs = new NodeFs();
        fs.mkdirp(posixDirname(result.sibling));
        fs.writeText(result.sibling, result.markdown);
      } catch (error) {
        exitWithEnvelope(
          formatError(
            'dd build',
            ErrorCodes.DD_RENDER_WRITE_FAILED,
            `failed to write ${result.sibling}: ${
              error instanceof Error ? error.message : String(error)
            }`,
            clock,
            {
              details: data,
              next_action: 'Check directory permissions and disk space, then retry.',
            },
          ),
          port,
        );
      }

      exitWithEnvelope(envelopeFor('written', data, result, clock), port);
    });
}
