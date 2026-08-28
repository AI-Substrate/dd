import { isAddressFailure, parseAddress } from './address.js';
import type { DdDoc } from './model.js';
import {
  collectFileRefs,
  collectLinkCells,
  type DdIssue,
  FILE_LINK_TARGET,
  type FileExistence,
  isPathWithinRepo,
  resolveAddressFile,
  type SchemaResolver,
  validateDocument,
  validateFileRefs,
} from './validate.js';

export type DocLoadResult =
  | { ok: true; path: string; doc: DdDoc; sha: string; tracked: boolean | null }
  | { ok: false; path: string; reason: 'missing'; message: string };

/** P4 and doctor implement this over their filesystem/repository ports. */
export interface DocLoader {
  load(path: string): DocLoadResult;
}

export interface ValidateWalkDeps {
  schemaResolver: SchemaResolver;
  docLoader: DocLoader;
  /**
   * The existence probe for ordinary file targets — the SAME seam the corpus
   * traversal takes, so the walk and the graph cannot disagree about which
   * files are there.
   *
   * Optional, and its absence means UNMEASURED rather than present: with no
   * probe the walk reports no file findings at all, exactly as a traversal with
   * no probe emits no file nodes. dd does not report a measurement it declined
   * to take, and it never defaults one to "exists" — that would turn silence
   * into a claim.
   */
  fileExistence?: FileExistence;
}

export interface ValidateWalkOptions {
  repoRoot: string;
  depth?: number;
  mode?: 'direct' | 'sweep';
}

function testFixturePath(path: string): boolean {
  const parts = path.replaceAll('\\', '/').split('/').filter(Boolean);
  const testIndex = parts.lastIndexOf('test');
  return testIndex >= 0 && parts.slice(testIndex + 1).includes('fixtures');
}

/**
 * Is this document excluded from a SWEEP?
 *
 * Two predicates with different inputs, and only one of them needs a parsed
 * document. `doc` is therefore OPTIONAL: called without it this answers the
 * path-only half, which a caller can ask BEFORE attempting to load.
 *
 * That matters because the exclusion is unreachable otherwise. A `.dd.json` bad
 * enough not to parse fails at the loader first, and the link scan then reports
 * `link-scan-incomplete` and degrades the envelope — for a document the sweep was
 * meant to skip. `links/doctor.ts` promises the exclusion is "what lets a
 * repository keep a known-bad corpus committed and still run a green
 * `harness checks`", and a document that does not parse is the most obvious
 * known-bad document anyone would commit. Found by a coder building a fixture.
 *
 * Widening the signature rather than exporting `testFixturePath` is deliberate:
 * `./core/walk` is a PUBLISHED subpath, so a new exported symbol there is a
 * surface change and an API review. An optional parameter is neither.
 */
export function shouldExcludeFromSweep(path: string, doc?: DdDoc): boolean {
  return doc?.dd.sweep_exclude === true || testFixturePath(path);
}

function finding(issue: Omit<DdIssue, 'owner'>, owner: string): DdIssue {
  return { ...issue, owner };
}

function targetType(schemaName: string, sectionName: string | undefined): string {
  return sectionName ? `${schemaName}/section/${sectionName}` : schemaName;
}

/**
 * Breadth-first validation over outbound links. `remaining` is decremented per
 * edge; a queued document is always depth-zero validated, including at zero.
 */
export function validateWalk(
  rootDoc: DdDoc,
  rootPath: string,
  deps: ValidateWalkDeps,
  options: ValidateWalkOptions,
): DdIssue[] {
  const mode = options.mode ?? 'direct';
  const requestedDepth = options.depth ?? 3;
  const depth =
    requestedDepth === Number.POSITIVE_INFINITY
      ? requestedDepth
      : Math.max(0, Math.floor(requestedDepth));
  const queue: Array<{ doc: DdDoc; path: string; remaining: number }> = [
    { doc: rootDoc, path: rootPath, remaining: depth },
  ];
  const visited = new Set<string>();
  const issues: DdIssue[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (visited.has(current.path)) continue;
    visited.add(current.path);
    if (mode === 'sweep' && shouldExcludeFromSweep(current.path, current.doc)) continue;

    issues.push(
      ...validateDocument(current.doc, current.path, deps.schemaResolver, options.repoRoot),
    );

    const resolvedSchema = deps.schemaResolver.resolve(current.doc.dd.schema, current.path);
    if (!resolvedSchema.ok) continue;

    // Once per VISITED document, before the depth gate: an ordinary file is a
    // terminal target, not a hop, so `--depth 0` still answers for the cells
    // this document itself declares. The `visited` set is what makes it once —
    // a file cited by two documents is reported by each of them, because the
    // finding is owned by the citing document.
    if (deps.fileExistence) {
      // `validateFileRefs` already stamps `owner` with the path it was handed,
      // so these arrive attributed to the citing document — the same attribution
      // `ddocs build` reports, from the same call.
      issues.push(
        ...validateFileRefs(
          collectFileRefs(current.doc, resolvedSchema.schema),
          current.path,
          options.repoRoot,
          deps.fileExistence,
        ),
      );
    }
    if (current.remaining === 0) continue;

    for (const link of collectLinkCells(current.doc, resolvedSchema.schema)) {
      // A `target: "file"` cell names an ordinary file. It must never be loaded,
      // parsed, hashed or queued as a dd document — its existence is
      // `validateFileRefs`'s job, through a probe that reads nothing.
      if (link.target === FILE_LINK_TARGET) continue;
      const address = parseAddress(link.raw);
      if (isAddressFailure(address) || address.file === null) continue;
      // A dd link with no interior is the whole-file form in a cell that may not
      // hold one; `validateDocument` has already reported it as an ERROR. Walking
      // it anyway would probe the filesystem for a path the author never meant to
      // write and add a missing-file WARN on top of the real finding.
      if (address.segments.length === 0) continue;
      const targetPath = resolveAddressFile(current.path, address.file);
      if (!isPathWithinRepo(targetPath, options.repoRoot)) continue;

      const loaded = deps.docLoader.load(targetPath);
      if (!loaded.ok) {
        issues.push(
          finding(
            {
              class: 'address-target-missing',
              severity: 'WARN',
              location: link.location,
              message: loaded.message,
            },
            current.path,
          ),
        );
        continue;
      }
      // `=== false` and not `!loaded.tracked`: `null` means the host has no
      // tracking concept, so there is no such thing as an untracked target to
      // report. Only a definite "this file is not in the index" earns the WARN.
      // A truthiness test would fire on `null` and turn "unknowable" into an
      // accusation — the mirror of the defect A-2 removed from the loader.
      if (loaded.tracked === false) {
        issues.push(
          finding(
            {
              class: 'address-target-untracked',
              severity: 'WARN',
              location: link.location,
              message: `address target is not tracked: ${targetPath}`,
            },
            current.path,
          ),
        );
      }

      const ledgerEntry = current.doc.references.find(
        (reference) => resolveAddressFile(current.path, reference.path) === targetPath,
      );
      // Basis staleness is WARN, and stays WARN wherever it is asked (plan 065 P6
      // T004 / dossier § Rulings, A1 residual). A recorded basis that no longer
      // matches means the reader's conclusions about that target were computed
      // against a file that has since moved — which is information, not a verdict.
      // The flow spine's dd gate consumes the same rule through `verify-basis`:
      // drift surfaces at `orient` as a warning and NEVER refuses a departure,
      // because the gate itself is recomputed live against the current file and has
      // already answered the question drift would only cast doubt on.
      if (ledgerEntry && ledgerEntry.sha !== loaded.sha) {
        issues.push(
          finding(
            {
              class: 'basis-stale',
              severity: 'WARN',
              location: '$.references',
              message: `recorded basis ${ledgerEntry.sha} does not match ${loaded.sha} for ${ledgerEntry.path}`,
            },
            current.path,
          ),
        );
      }

      if (link.target) {
        const targetSchema = deps.schemaResolver.resolve(loaded.doc.dd.schema, targetPath);
        if (targetSchema.ok) {
          const actual = targetType(targetSchema.schema.name, address.segments[0]?.value);
          if (actual !== link.target) {
            issues.push(
              finding(
                {
                  class: 'link-type-mismatch',
                  severity: 'ERROR',
                  location: link.location,
                  message: `link targets "${actual}", expected "${link.target}"`,
                },
                current.path,
              ),
            );
          }
        }
      }

      queue.push({
        doc: loaded.doc,
        path: loaded.path,
        remaining:
          current.remaining === Number.POSITIVE_INFINITY
            ? Number.POSITIVE_INFINITY
            : current.remaining - 1,
      });
    }
  }

  return issues;
}
