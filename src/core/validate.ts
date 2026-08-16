import { isAddressFailure, normalizeFilePath, parseAddress } from './address.js';
import { LINKS_BUCKET_FIELD, readLinksBucket } from './bucket.js';
import {
  COMPLETION_STATES,
  DEFAULT_REL,
  ID_PREFIXES,
  MINTED_ID_PATTERN,
  PRESSURE_NOT_APPLICABLE,
} from './constants.js';
import type { DdDoc, DdShape, ResolvedDdSchema } from './model.js';
import { relOf } from './rel.js';
import { tallyMismatches } from './tally.js';
import { isRecord } from './value.js';

export type DdSeverity = 'ERROR' | 'WARN';

export type DdIssueClass =
  | 'address-malformed'
  | 'address-path-absolute'
  | 'address-path-escape'
  | 'address-path-non-posix'
  | 'address-target-missing'
  | 'address-target-untracked'
  | 'basis-stale'
  | 'duplicate-id'
  | 'enum-invalid'
  | 'human-skipped-receipt-required'
  | 'id-invalid'
  | 'link-type-mismatch'
  | 'schema-shape'
  | 'schema-unresolvable'
  | 'state-note-required'
  | 'tally-mismatch';

export interface DdIssue {
  class: DdIssueClass;
  severity: DdSeverity;
  location: string;
  message: string;
  /** The document that must change to resolve the finding. */
  owner: string;
}

export type SchemaResolveResult =
  | { ok: true; schema: ResolvedDdSchema }
  | { ok: false; message: string };

/** P2 implements this interface with the real convention-based schema resolver. */
export interface SchemaResolver {
  resolve(schemaRef: string, fromPath: string): SchemaResolveResult;
}

export interface DdLinkCell {
  raw: string;
  location: string;
  target?: string;
  /**
   * The declared relation, resolved through `relOf` so a cell always carries one.
   * Consumers reason about MEANING here — never about the field name the cell
   * happened to sit under.
   */
  rel: string;
}

/**
 * The ONE schema marker that makes a link cell name an ordinary repository file
 * rather than a place inside a dd document (BRIEF ruling 3: plain, with no
 * `file:ts`, no globs and no extension allowlist — constraining is purely
 * additive later, and shipping the constraint first would fix a vocabulary
 * before any consumer has asked for one).
 */
export const FILE_LINK_TARGET = 'file';

/**
 * Which directory a file reference's authored path is anchored on.
 *
 * The two populations do NOT share a base and cannot be given one. A structured
 * `target: "file"` cell stores a ruled repository-relative path, so it resolves
 * from the repository root. An incidental Markdown destination is an href that a
 * human clicks in the generated sibling, so it resolves from the document's own
 * directory — anything else would check a different file than the rendered link
 * opens. Carried per reference, because a single resolver would be silently
 * wrong in one arm and which arm depends on how deep the citing document sits.
 */
export type DdFileRefBase = 'repo' | 'document';

/** One reference from a dd document to an ordinary file. */
export interface DdFileRef {
  /** The destination exactly as the author wrote it — what a finding must name. */
  raw: string;
  /** JSON-ish location of the authoring cell. */
  location: string;
  base: DdFileRefBase;
  /** As {@link DdLinkCell.rel}. Incidental Markdown references carry `ref`. */
  rel: string;
}

/**
 * The narrowest host seam dd can ask for, and deliberately the whole of it:
 * does this path exist?
 *
 * Existence is the entire ruled contract (BRIEF ruling 2) — no read, no parse,
 * no hash, no VCS tracking, no schema resolution, no freshness. A port with a
 * `readText` on it would make every one of those reachable by accident, so the
 * seam does not have one. `NodeSchemaFs.exists` already satisfies this
 * structurally; wiring it is Phase 2's job.
 */
export interface FileExistence {
  exists(path: string): boolean;
}

interface ValidationContext {
  doc: DdDoc;
  path: string;
  repoRoot: string;
  schema: ResolvedDdSchema;
  issues: DdIssue[];
}

function addIssue(
  ctx: Pick<ValidationContext, 'issues' | 'path'>,
  issueClass: DdIssueClass,
  severity: DdSeverity,
  location: string,
  message: string,
): void {
  ctx.issues.push({ class: issueClass, severity, location, message, owner: ctx.path });
}

function dirname(path: string): string {
  const normalized = normalizeFilePath(path);
  const boundary = normalized.lastIndexOf('/');
  return boundary <= 0 ? (normalized.startsWith('/') ? '/' : '.') : normalized.slice(0, boundary);
}

/**
 * A file path is already root-anchored: a POSIX root (`/`, including UNC `//`)
 * or a Windows DRIVE root (`C:/`). Deliberately the same grammar as
 * `shared/posix-path.ts`'s `ABSOLUTE_LOGICAL` — mirrored rather than imported,
 * because dd-core is transitively free of `node:` builtins (enforced by
 * `test/architecture/dd-core-isolation.test.ts`) and `shared/posix-path.ts`
 * imports `node:path`. Callers slash-normalise before testing, so the pattern
 * only ever sees forward slashes.
 *
 * One const, used by BOTH of this module's absoluteness questions
 * (`resolveAddressFile` and the `address-path-absolute` finding) — those were
 * two different hand-rolled tests of one fact, which is how the drive-letter
 * case came to be absolute for the WARN and relative for the resolver.
 */
const ABSOLUTE_FILE_PATH = /^([A-Za-z]:)?\//;

function isRootAnchored(path: string): boolean {
  return ABSOLUTE_FILE_PATH.test(path.replaceAll('\\', '/'));
}

/**
 * ONE document, ONE spelling — the identity every path comparison in dd rests
 * on (S-1 F1).
 *
 * A resolved path is not just a location here, it is an IDENTITY: compared with
 * `===` (`core/walk.ts`, `render/refresh.ts`), keyed in `plan/index-plan.ts`,
 * and used as the memoizing loader's cache key. dd has two producers of that
 * identity and they disagreed about drive-letter case — `shared/posix-path.ts`
 * upper-cases (so every path off the filesystem is `C:/…`), `normalizeFilePath`
 * does not (so every path out of a parsed ADDRESS keeps what the author typed).
 * `links/resolver.ts` picks between the two on nothing more than whether the
 * address has a citing document, so one address text became two documents.
 *
 * Canonicalising HERE rather than at either call site is the point: the two
 * producers converge, and every consumer is fixed at once. The rule is copied
 * from `toPosix` deliberately — same grammar, so agreement is by construction
 * rather than by coincidence. It cannot be imported: dd-core is transitively
 * free of `node:` builtins and `shared/posix-path.ts` imports `node:path`.
 *
 * `normalizeFilePath` itself is deliberately left alone. It is exported from
 * the public `./core/address` subpath, which makes its spelling SURFACE rather
 * than detail, and this phase is surface-neutral by definition.
 */
function canonicalFilePath(raw: string): string {
  return normalizeFilePath(raw).replace(
    /^([a-z]):/,
    (_, drive: string) => `${drive.toUpperCase()}:`,
  );
}

/**
 * Anchor a relative path on `dir`, leaving an already-root-anchored one alone.
 *
 * S-1 F2: absoluteness was tested with `startsWith('/')`, which a drive-letter
 * path does not satisfy — so `C:/other/e.dd.json` cited from `/repo/docs/plan
 * .dd.json` resolved to `/repo/docs/C:/other/e.dd.json`. Not a separator bug:
 * it fired on forward slashes exactly as hard as on backslashes.
 */
function anchorFile(dir: string, target: string): string {
  const posixTarget = target.replaceAll('\\', '/');
  if (isRootAnchored(posixTarget)) return canonicalFilePath(posixTarget);
  return canonicalFilePath(`${dir}/${posixTarget}`);
}

/**
 * Resolve an address's `file` part against the CITING document, anchoring a
 * relative target on the citer's directory.
 */
export function resolveAddressFile(fromPath: string, target: string): string {
  return anchorFile(dirname(fromPath), target);
}

/**
 * Resolve a REPOSITORY-relative path — the base a structured `target: "file"`
 * cell is ruled to use (BRIEF ruling: "document rows then carry plain
 * repo-relative paths"). Deliberately a different base from
 * {@link resolveAddressFile}: one resolver for both would silently check the
 * wrong file in one arm, and which arm is wrong depends on how deep the citing
 * document sits.
 */
export function resolveRepoFile(repoRoot: string, target: string): string {
  return anchorFile(repoRoot, target);
}

export function isPathWithinRepo(path: string, root: string): boolean {
  const normalizedPath = canonicalFilePath(path);
  const normalizedRoot = canonicalFilePath(root).replace(/\/+$/, '');
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function enumValues(shape: DdShape, schema: ResolvedDdSchema): readonly string[] | undefined {
  if (shape.values) return shape.values;
  if (shape.enum) return schema.enums?.[shape.enum]?.values;
  return shape.type === 'state' ? COMPLETION_STATES : undefined;
}

function validateStateNotes(
  value: Record<string, unknown>,
  location: string,
  ctx: ValidationContext,
) {
  const state = value.state;
  if ((state === 'blocked' || state === 'na') && !nonEmptyString(value.note)) {
    addIssue(
      ctx,
      'state-note-required',
      'ERROR',
      `${location}.note`,
      `state "${state}" requires a non-empty note`,
    );
  }
  if (state === 'human-skipped') {
    const receipt = value.receipt;
    const verbatim =
      nonEmptyString(receipt) || (isRecord(receipt) && nonEmptyString(receipt.verbatim_words));
    if (!verbatim) {
      addIssue(
        ctx,
        'human-skipped-receipt-required',
        'ERROR',
        `${location}.receipt`,
        'state "human-skipped" requires a receipt containing the human verbatim words',
      );
    }
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * `not-applicable` is the explicit out for an assertion no instrument checks.
 * It is keyed on the RELATION, never on a field name, so any schema that
 * declares `rel: "pressure"` inherits the escape — and silence still fails,
 * which is the whole bargain: saying "nothing checks this" is legal, saying
 * nothing at all is not.
 *
 * Named rather than inlined because THREE places must agree that this string is
 * not an address, and until the grammar accepted a bare path they agreed by
 * accident: the sentinel failed to parse, so every consumer downstream of
 * `collectLinkCells` coped with it without ever being told about it. It parses
 * now, so the agreement has to be explicit or the escape becomes a dangling
 * edge to a file called `not-applicable`.
 */
function isPressureEscape(raw: string, rel: string): boolean {
  return raw === PRESSURE_NOT_APPLICABLE && rel === 'pressure';
}

function validateLink(raw: string, shape: DdShape, location: string, ctx: ValidationContext) {
  if (isPressureEscape(raw, relOf(shape))) return;
  const address = parseAddress(raw);
  if (isAddressFailure(address)) {
    addIssue(ctx, 'address-malformed', 'ERROR', location, address.message);
    return;
  }

  // A `target: "file"` cell names an ordinary file and nothing inside it, and it
  // is ruled REPO-relative — so the citing-document path warnings below would be
  // answering the wrong question here. Its whole contract (path base, escape,
  // existence) belongs to `validateFileRefs`, which is the only thing holding
  // the probe.
  if (shape.target === FILE_LINK_TARGET) {
    if (address.file === null || address.segments.length > 0) {
      addIssue(
        ctx,
        'link-type-mismatch',
        'ERROR',
        location,
        `link targets a document interior, expected "${FILE_LINK_TARGET}"`,
      );
    }
    return;
  }

  // Every OTHER link cell is a dd address, and a dd link points at a place
  // INSIDE a document. The grammar now accepts a bare path, but acceptance is
  // not permission: the whole-file form is reserved for `target: "file"`, so a
  // dd cell holding one is the same defect it was before the grammar widened —
  // most often a `#` lost to a typo. Rejecting HERE, in the pure pass, is what
  // keeps that typo an ERROR instead of decaying into a missing-file WARN.
  if (address.segments.length === 0) {
    if (shape.target) {
      addIssue(
        ctx,
        'link-type-mismatch',
        'ERROR',
        location,
        `link targets the whole file "${address.file}", expected "${shape.target}"`,
      );
      return;
    }
    addIssue(
      ctx,
      'address-malformed',
      'ERROR',
      location,
      'address must contain exactly one "#" file/interior boundary',
    );
    return;
  }
  if (address.file !== null) {
    if (address.file.includes('\\')) {
      addIssue(
        ctx,
        'address-path-non-posix',
        'WARN',
        location,
        'address paths should use POSIX separators',
      );
    }
    if (isRootAnchored(address.file)) {
      addIssue(
        ctx,
        'address-path-absolute',
        'WARN',
        location,
        'address paths should be relative to the containing document',
      );
    }
    const targetPath = resolveAddressFile(ctx.path, address.file);
    if (!isPathWithinRepo(targetPath, ctx.repoRoot)) {
      addIssue(
        ctx,
        'address-path-escape',
        'WARN',
        location,
        `address resolves outside the repository: ${targetPath}`,
      );
    }
    return;
  }

  if (shape.target) {
    const sectionName = address.segments[0]?.value;
    const actual = sectionName ? `${ctx.schema.name}/section/${sectionName}` : ctx.schema.name;
    if (actual !== shape.target) {
      addIssue(
        ctx,
        'link-type-mismatch',
        'ERROR',
        location,
        `link targets "${actual}", expected "${shape.target}"`,
      );
    }
  }
}

/** A schema-declared prose cell — the only place an incidental reference may hide. */
interface DdTextCell {
  value: string;
  location: string;
}

interface CellSink {
  links: DdLinkCell[];
  texts: DdTextCell[];
}

function collectShapeCells(
  value: unknown,
  shape: DdShape,
  location: string,
  sink: CellSink,
): void {
  if (shape.type === 'link') {
    // The pressure escape is not an address and must not become an edge: a
    // consumer reading the graph would see an outbound link to a file called
    // `not-applicable` that never resolves, which is the opposite of what the
    // author said. Dropped HERE so every consumer inherits it, rather than in
    // each of them.
    if (typeof value === 'string' && !isPressureEscape(value, relOf(shape))) {
      sink.links.push({
        raw: value,
        location,
        ...(shape.target && { target: shape.target }),
        rel: relOf(shape),
      });
    }
    return;
  }
  // Prose, and ONLY schema-declared prose. Markdown discovery is scoped by the
  // schema rather than by looking string-shaped, so a field nobody declared as
  // text is never scanned and a path mentioned outside `[label](…)` is never
  // guessed at.
  if (shape.type === 'text') {
    if (typeof value === 'string') sink.texts.push({ value, location });
    return;
  }
  if (shape.type === 'array' && Array.isArray(value) && shape.items) {
    const itemShape = shape.items;
    value.forEach((entry, index) => {
      collectShapeCells(entry, itemShape, `${location}[${index}]`, sink);
    });
    return;
  }
  if (shape.type === 'object' && isRecord(value)) {
    for (const [field, fieldShape] of Object.entries(shape.fields ?? {})) {
      if (field in value) {
        collectShapeCells(value[field], fieldShape, `${location}.${field}`, sink);
      }
    }
    // The links BUCKET (ac-7002): edges an author attached to a row without the
    // schema growing a field for them. Collected here so they are validated,
    // traversed and graphed exactly like a declared cell — a bucket edge that
    // only the renderer could see would be a second class of link, and the
    // whole point of the bucket is that it is not one.
    if (!shape.fields || !(LINKS_BUCKET_FIELD in shape.fields)) {
      const bucket = readLinksBucket(
        value[LINKS_BUCKET_FIELD],
        `${location}.${LINKS_BUCKET_FIELD}`,
      );
      for (const entry of bucket.entries) {
        if (isPressureEscape(entry.ref, entry.rel)) continue;
        sink.links.push({
          raw: entry.ref,
          location: `${location}.${LINKS_BUCKET_FIELD}[${entry.index}].ref`,
          rel: entry.rel,
        });
      }
    }
    // OD-8: a dynamic-key map's interiors carry real link cells too — an evidence
    // entry's `proven_by`/`pressure` is the linkage the design exists to make
    // navigable, and leaving it uncollected would strand it outside the walk.
    const valuesShape = shape.valuesShape;
    if (valuesShape) {
      for (const [key, entry] of Object.entries(value)) {
        if (shape.fields && key in shape.fields) continue;
        collectShapeCells(entry, valuesShape, `${location}.${key}`, sink);
      }
    }
  }
}

function collectCells(doc: DdDoc, schema: ResolvedDdSchema): CellSink {
  const sections = new Map(doc.sections.map((section) => [section.name, section]));
  const sink: CellSink = { links: [], texts: [] };
  for (const [name, declaration] of Object.entries(schema.sections)) {
    const section = sections.get(name);
    if (section) {
      collectShapeCells(section.value, declaration.shape, `$.sections[${name}].value`, sink);
    }
  }
  return sink;
}

export function collectLinkCells(doc: DdDoc, schema: ResolvedDdSchema): DdLinkCell[] {
  return collectCells(doc, schema).links;
}

/**
 * Explicit inline Markdown links, and nothing that merely resembles one.
 *
 * `!` is captured rather than excluded by a lookbehind so an IMAGE is matched
 * and then dropped: an image is a reference to a rendered asset, not a link a
 * reader follows, and the ruling keeps the population to what an author marked
 * as a link. A reference-style `[label][id]` has no `(`, an autolink has no
 * `[`, and a destination containing whitespace or a paren never matches — so
 * each of those is outside the population by CONSTRUCTION rather than by a
 * filter that could be forgotten.
 */
const INLINE_MARKDOWN_LINK = /(!?)\[[^\]\n]*\]\(([^()\s]*)(?:\s+(?:"[^"]*"|'[^']*'))?\)/g;

/** Any URI scheme — `https:`, `mailto:`, `ftp:`, and every other non-local one. */
const URI_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;

function markdownFileDestinations(text: string): string[] {
  const destinations: string[] = [];
  for (const match of text.matchAll(INLINE_MARKDOWN_LINK)) {
    const destination = match[2] ?? '';
    if (match[1] === '!') continue;
    if (destination.length === 0) continue;
    // Fragment-ONLY is an anchor inside the same rendered page; there is no
    // file to look for. A path WITH a fragment still names a file, and the
    // fragment is dropped at resolution rather than here, so the finding can
    // still quote what the author actually wrote.
    if (destination.startsWith('#')) continue;
    if (URI_SCHEME.test(destination)) continue;
    destinations.push(destination);
  }
  return destinations;
}

/**
 * Every reference from this document to an ordinary file: one per `target:
 * "file"` cell, one per explicit inline Markdown link in declared prose.
 *
 * Structured references come first, then incidental ones, each in document
 * order — one deterministic sequence, from one walk of the schema.
 */
export function collectFileRefs(doc: DdDoc, schema: ResolvedDdSchema): DdFileRef[] {
  const cells = collectCells(doc, schema);
  const refs: DdFileRef[] = [];
  for (const cell of cells.links) {
    if (cell.target !== FILE_LINK_TARGET) continue;
    refs.push({ raw: cell.raw, location: cell.location, base: 'repo', rel: cell.rel });
  }
  for (const cell of cells.texts) {
    for (const raw of markdownFileDestinations(cell.value)) {
      refs.push({ raw, location: cell.location, base: 'document', rel: DEFAULT_REL });
    }
  }
  return refs;
}

/**
 * Existence, and nothing else (BRIEF ruling 2).
 *
 * Every finding here is a WARN, deliberately and by ruling: this is the FIRST
 * dd check whose answer depends on files dd does not own, so a sparse clone or
 * a vendored `.dd.json` would otherwise fail a gate over something that is not
 * wrong. A path that escapes the repository is reported and NOT probed — the
 * probe is a host call, and dd does not make one about a path outside the tree
 * it was asked about.
 */
export function validateFileRefs(
  refs: readonly DdFileRef[],
  fromPath: string,
  repoRoot: string,
  existence: FileExistence,
): DdIssue[] {
  const ctx = { issues: [] as DdIssue[], path: fromPath };
  for (const ref of refs) {
    // A Markdown destination may carry an anchor (`notes.md#intro`); the FILE is
    // what exists or does not. A structured cell stores a plain path and is left
    // exactly as authored — `validateLink` has already refused any `#` there.
    const authored = ref.base === 'document' ? (ref.raw.split('#')[0] ?? ref.raw) : ref.raw;
    if (ref.raw.includes('\\')) {
      addIssue(
        ctx,
        'address-path-non-posix',
        'WARN',
        ref.location,
        'address paths should use POSIX separators',
      );
    }
    if (isRootAnchored(ref.raw)) {
      addIssue(
        ctx,
        'address-path-absolute',
        'WARN',
        ref.location,
        ref.base === 'repo'
          ? 'file link paths should be relative to the repository root'
          : 'address paths should be relative to the containing document',
      );
    }
    const target =
      ref.base === 'repo'
        ? resolveRepoFile(repoRoot, authored)
        : resolveAddressFile(fromPath, authored);
    if (!isPathWithinRepo(target, repoRoot)) {
      addIssue(
        ctx,
        'address-path-escape',
        'WARN',
        ref.location,
        `address resolves outside the repository: ${target}`,
      );
      continue;
    }
    if (!existence.exists(target)) {
      addIssue(
        ctx,
        'address-target-missing',
        'WARN',
        ref.location,
        `file link target is missing: ${ref.raw}`,
      );
    }
  }
  return ctx.issues;
}

function validateShape(
  value: unknown,
  shape: DdShape,
  location: string,
  ctx: ValidationContext,
  stateOwnedByObject = false,
): void {
  switch (shape.type) {
    case 'array':
      if (!Array.isArray(value)) {
        addIssue(ctx, 'schema-shape', 'ERROR', location, 'value must be an array');
        return;
      }
      if (shape.items) {
        const itemShape = shape.items;
        value.forEach((entry, index) => {
          validateShape(entry, itemShape, `${location}[${index}]`, ctx);
        });
      }
      return;
    case 'object': {
      if (!isRecord(value)) {
        addIssue(ctx, 'schema-shape', 'ERROR', location, 'value must be an object');
        return;
      }
      for (const field of shape.required ?? []) {
        if (!(field in value)) {
          // A missing REQUIRED PRESSURE link earns its own sentence. "missing
          // required field" is true and useless; the rule this breaks is a
          // design decision an author needs to be told about, including the way
          // out of it.
          const missing = shape.fields?.[field];
          const message =
            missing?.type === 'link' && relOf(missing) === 'pressure'
              ? `"${field}" names no instrument — link a backpressure row, or say "${PRESSURE_NOT_APPLICABLE}" on purpose`
              : `missing required field "${field}"`;
          addIssue(ctx, 'schema-shape', 'ERROR', `${location}.${field}`, message);
        }
      }
      for (const [field, fieldShape] of Object.entries(shape.fields ?? {})) {
        if (field in value) {
          validateShape(
            value[field],
            fieldShape,
            `${location}.${field}`,
            ctx,
            fieldShape.type === 'state',
          );
        }
      }
      // The bucket is a reserved convention, so a closed shape must not reject it
      // — and it is still SHAPED rather than waved through.
      const bucketDeclared = shape.fields !== undefined && LINKS_BUCKET_FIELD in shape.fields;
      if (!bucketDeclared && LINKS_BUCKET_FIELD in value) {
        const bucket = readLinksBucket(
          value[LINKS_BUCKET_FIELD],
          `${location}.${LINKS_BUCKET_FIELD}`,
        );
        for (const problem of bucket.problems) {
          addIssue(ctx, 'schema-shape', 'ERROR', problem.location, problem.message);
        }
        for (const entry of bucket.entries) {
          validateLink(
            entry.ref,
            { type: 'link' },
            `${location}.${LINKS_BUCKET_FIELD}[${entry.index}].ref`,
            ctx,
          );
        }
      }
      if (shape.valuesShape) {
        // OD-8: keys the schema cannot name in advance are SHAPED, not forbidden.
        // `fields` still wins per key, so a map may declare fixed members and a
        // shape for the rest without either half surprising the other.
        //
        // This branch is FIRST on purpose, and the order IS the ratified contract:
        // `allowAdditional: false` keeps its meaning only where no `valuesShape`
        // exists. A schema declaring both is saying "this is a map with some named
        // members", and the shape is the specific instruction; letting the closed
        // branch win would reject exactly the keys `valuesShape` was added to
        // validate, making the feature unreachable on its own documents.
        const valuesShape = shape.valuesShape;
        for (const [key, entry] of Object.entries(value)) {
          if (shape.fields && key in shape.fields) continue;
          validateShape(entry, valuesShape, `${location}.${key}`, ctx);
        }
      } else if (shape.allowAdditional === false && shape.fields) {
        for (const field of Object.keys(value)) {
          if (field === LINKS_BUCKET_FIELD) continue;
          if (!(field in shape.fields)) {
            addIssue(
              ctx,
              'schema-shape',
              'ERROR',
              `${location}.${field}`,
              `field "${field}" is not declared by the schema`,
            );
          }
        }
      }
      validateStateNotes(value, location, ctx);
      return;
    }
    case 'bool':
      if (typeof value !== 'boolean') {
        addIssue(ctx, 'schema-shape', 'ERROR', location, 'value must be a boolean');
      }
      return;
    case 'int':
      if (!Number.isInteger(value)) {
        addIssue(ctx, 'schema-shape', 'ERROR', location, 'value must be an integer');
      }
      return;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        addIssue(ctx, 'schema-shape', 'ERROR', location, 'value must be a finite number');
      }
      return;
    case 'string':
    case 'text':
      if (typeof value !== 'string') {
        addIssue(ctx, 'schema-shape', 'ERROR', location, 'value must be a string');
      }
      return;
    case 'enum':
    case 'state': {
      const values = enumValues(shape, ctx.schema);
      if (typeof value !== 'string' || (values && !values.includes(value))) {
        addIssue(
          ctx,
          'enum-invalid',
          'ERROR',
          location,
          `value "${String(value)}" is not in ${values?.join(', ') ?? 'the declared enum'}`,
        );
      } else if (shape.type === 'state' && !stateOwnedByObject) {
        validateStateNotes({ state: value }, location, ctx);
      }
      return;
    }
    case 'link':
      if (typeof value !== 'string') {
        addIssue(ctx, 'schema-shape', 'ERROR', location, 'link value must be a string');
      } else {
        validateLink(value, shape, location, ctx);
      }
      return;
    default:
      // Custom types are rendered by schema adapters. Without a declared enum or
      // structural shape there is intentionally nothing for core to validate.
      return;
  }
}

function validateIds(doc: DdDoc, ctx: ValidationContext): void {
  const firstSeen = new Map<string, string>();
  const visit = (value: unknown, location: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        visit(entry, `${location}[${index}]`);
      });
      return;
    }
    if (!isRecord(value)) return;
    if (typeof value.id === 'string') {
      const id = value.id;
      const idLocation = `${location}.id`;
      const seenAt = firstSeen.get(id);
      if (seenAt) {
        addIssue(ctx, 'duplicate-id', 'ERROR', idLocation, `id "${id}" duplicates ${seenAt}`);
      } else {
        firstSeen.set(id, idLocation);
      }
      if (ID_PREFIXES.some((prefix) => id.startsWith(prefix)) && !MINTED_ID_PATTERN.test(id)) {
        addIssue(
          ctx,
          'id-invalid',
          'ERROR',
          idLocation,
          `minted id "${id}" must use a registered prefix and exactly four lowercase hex digits`,
        );
      }
    }
    for (const [field, child] of Object.entries(value)) {
      if (field !== 'id') visit(child, `${location}.${field}`);
    }
  };
  for (const section of doc.sections) {
    visit(section.value, `$.sections[${section.name}].value`);
  }
}

/** Validate one document only. Cross-document resolution and BFS live in `validateWalk`. */
export function validateDocument(
  doc: DdDoc,
  path: string,
  resolver: SchemaResolver,
  repoRoot: string,
): DdIssue[] {
  const resolved = resolver.resolve(doc.dd.schema, path);
  if (!resolved.ok) {
    return [
      {
        class: 'schema-unresolvable',
        severity: 'ERROR',
        location: '$.dd.schema',
        message: resolved.message,
        owner: path,
      },
    ];
  }
  const ctx: ValidationContext = {
    doc,
    path,
    repoRoot,
    schema: resolved.schema,
    issues: [],
  };
  validateIds(doc, ctx);

  const sections = new Map(doc.sections.map((section) => [section.name, section]));
  for (const [name, declaration] of Object.entries(resolved.schema.sections)) {
    const section = sections.get(name);
    if (!section) {
      if (declaration.required) {
        addIssue(
          ctx,
          'schema-shape',
          'ERROR',
          `$.sections[${name}]`,
          `missing required section "${name}"`,
        );
      }
      continue;
    }
    validateShape(section.value, declaration.shape, `$.sections[${name}].value`, ctx);
    // Recompute and compare. This is what makes STORING a tally safe rather than
    // merely convenient: without it, a `.dd.json` edited outside dd's writers
    // yields a document whose total contradicts its own rows while
    // `ddocs build --check` PASSES, because the markdown faithfully reflects the
    // wrong JSON. That is not drift — it is internally consistent and false, and
    // nothing else in the repo can see it. Hand edits are not hypothetical here;
    // a merge resolved one by hand in this repo's own plan documents.
    //
    // It REPORTS ONLY. Repair belongs to `ddocs build` and the writer verbs, which
    // already rewrite the document; a validator that silently corrected its own
    // input would destroy the evidence that something upstream is wrong.
    for (const mismatch of tallyMismatches(section, declaration.shape.items)) {
      addIssue(
        ctx,
        'tally-mismatch',
        'ERROR',
        `$.sections[${name}].${mismatch.location}`,
        Number.isNaN(mismatch.computed)
          ? `stored tally has "${mismatch.column}", which is not a marked column`
          : `stored tally says ${JSON.stringify(mismatch.stored)} but the rows sum to ${mismatch.computed}`,
      );
    }
  }
  for (const section of doc.sections) {
    if (!(section.name in resolved.schema.sections)) {
      addIssue(
        ctx,
        'schema-shape',
        'ERROR',
        `$.sections[${section.name}]`,
        `section "${section.name}" is not declared by schema "${resolved.schema.name}"`,
      );
    }
  }
  return ctx.issues;
}
