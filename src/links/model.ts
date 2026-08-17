import type { DdReferenceMode } from '../core/model.js';
import type { DdSeverity } from '../core/validate.js';

/**
 * Findings this layer owns. dd-core already names every class the single-document
 * validator can produce; these are the classes that only exist once an address is
 * actually followed to a target. The E-code mapping lives in the act, exactly as
 * it does for dd-core and the schema layer — this layer stays free of `output/`.
 */
export type DdLinkIssueClass =
  | 'adapter-gap'
  | 'link-scan-failed'
  | 'link-scan-incomplete'
  | 'link-unresolved';

/**
 * Why an address failed to reach a target. Workshop 001 rules every one of these
 * an ERROR, so the class does not discriminate them — the reason does, and it is
 * what a consumer switches on instead of matching message text.
 *
 * `no-interior` is a REASON of its own and not a flavour of `section-unknown`,
 * and the difference is what the doctor reads. `section-unknown` means "this
 * document has no such section" — a defect inside a dd document, which the
 * doctor owns. The whole-file form means the address never named an interior at
 * all, which for a `target: "file"` cell is CORRECT rather than defective. Under
 * the old spelling the doctor would promote every ordinary-file citation in the
 * corpus to an ERROR, because it could not tell the two apart.
 */
export type DdLinkUnresolvedReason =
  | 'file-unreadable'
  | 'id-not-found'
  | 'malformed'
  | 'no-base-document'
  | 'no-interior'
  | 'not-a-container'
  | 'part-unknown'
  | 'path-escape'
  | 'schema-unresolvable'
  | 'section-unknown';

export interface DdLinkIssue {
  class: DdLinkIssueClass;
  severity: DdSeverity;
  location: string;
  message: string;
  /** The document that must change to resolve the finding (F17 ownership rule). */
  owner: string;
  reason?: DdLinkUnresolvedReason;
}

/**
 * What a segment turned out to be once it was resolved against the schema shape
 * and the data — never against its position. P1's parser marks segments `name`/
 * `id` by alternating index, which is a hint only: `#meta/owner` puts a shape
 * part at an odd index, and `#phases/ph-1a2b/tasks/tk-3c4d` puts instances at
 * both odd indices. Only the shape knows which is which.
 */
export type DdSegmentKind = 'instance' | 'part' | 'section';

export interface DdResolvedSegment {
  value: string;
  kind: DdSegmentKind;
}

export interface DdLinkTarget {
  /** The canonical address, re-formatted from the parse (path separators normalized). */
  address: string;
  /** Absolute POSIX-logical path of the document the address landed in. */
  path: string;
  /** The resolved schema name of that document. */
  schema: string;
  /** Whether the address named its file or used the bare-`#` same-document form. */
  form: 'bare' | 'qualified';
  segments: DdResolvedSegment[];
  /** Kind of the final segment — what the address actually points at. */
  kind: DdSegmentKind;
  /** The addressed value itself. Resolution's whole job is to hand this back. */
  value: unknown;
  /** Content digest of the target document, as the basis ledger records it. */
  sha: string;
  /**
   * Whether the target is tracked by the host's VCS — `null` when the host has
   * no tracking concept at all (non-repo, or git unavailable), which is not the
   * same claim as `false`. Widened from `boolean` by A-2: this value is the
   * loader's answer passed straight through, so narrowing it back here would
   * re-introduce, at the layer consumers actually read, the lie A-2 removed.
   */
  tracked: boolean | null;
}

export type DdLinkResolution =
  | { ok: true; target: DdLinkTarget; issues: DdLinkIssue[] }
  | { ok: false; issues: DdLinkIssue[] };

/**
 * What an edge's target IS. dd documents and ordinary repository files are both
 * legitimate destinations, and almost nothing may treat them alike: a document
 * is loaded, parsed, schema-resolved and followed, an ordinary file is probed
 * for existence and never opened.
 *
 * Read this rather than sniffing {@link DdLinkEdge.target}. Only the STRUCTURED
 * half of the file population carries a declared `target`; an inline Markdown
 * destination in declared prose is the same kind of edge with no declaration
 * behind it, so a `target === 'file'` test would silently follow half of them.
 */
export type DdEdgeKind = 'document' | 'file';

/** One outbound edge: a link cell, or an inline Markdown link, that names a target. */
export interface DdLinkEdge {
  kind: DdEdgeKind;
  /** Absolute path of the document holding the cell. */
  from: string;
  /** Absolute path of the target; null when the address never resolved to a file. */
  to: string | null;
  /** The raw cell value, or the authored Markdown destination. */
  address: string;
  /** JSON-ish location of the cell inside `from`. */
  location: string;
  /** The column's declared type path, when the schema pins one. */
  target?: string;
  /**
   * The RELATION this edge carries — `ref` unless the schema (or a links-bucket
   * entry) says otherwise. Carried on the edge so every reading of the graph
   * asks the same question the contradiction engine does.
   */
  rel: string;
  /** True for the bare-`#` same-document form (an edge back into `from`). */
  sameDocument: boolean;
}

/** A dd document the traversal loaded — everything on it was read off the file. */
export interface DdDocumentNode {
  kind: 'document';
  /** Absolute POSIX-logical path — the node's identity. */
  path: string;
  schema: string;
  sha: string;
  /** As {@link DdLinkTarget.tracked} — `null` means the host has no tracking concept. */
  tracked: boolean | null;
  /** True when this document was reached by a link but is not itself a scan seed. */
  external: boolean;
}

/**
 * An ordinary repository file that a document cites and that EXISTS — a resolved
 * terminal node, and deliberately nothing more.
 *
 * It carries a path and no other field, because a path is the only thing dd
 * measured. `schema`, `sha`, `tracked` and `external` are all absent rather than
 * defaulted: the existence seam reads nothing, so every one of those values
 * would have to be invented, and an invented `sha: ''` is indistinguishable
 * downstream from a real digest of an empty file. A missing file gets NO node at
 * all, which is what makes {@link toMermaid} draw it dashed without being told.
 */
export interface DdFileNode {
  kind: 'file';
  /** Absolute POSIX-logical path — the node's identity. */
  path: string;
}

export type DdGraphNode = DdDocumentNode | DdFileNode;

export interface DdCorpusGraph {
  nodes: DdGraphNode[];
  edges: DdLinkEdge[];
  issues: DdLinkIssue[];
  /** Documents the traversal actually visited, in visit order. Never an ordinary file. */
  visited: string[];
}

export type DdBasisState = 'fresh' | 'stale';

export interface DdBasisVerdict {
  state: DdBasisState;
  /** The address whose target the basis covers. */
  address: string;
  /** Absolute path of the target document. */
  path: string;
  recorded: string;
  actual: string;
  /** Ledger mode of the entry consulted, when the verdict came from a document's ledger. */
  mode?: DdReferenceMode;
}

/**
 * A render-layer adapter finding, repeated by the doctor as a WARN (AC-04).
 *
 * Phase 3 owns adapter loading and aggregates these; Phase 4 owns only the
 * consuming seam and codes against this shape, never against a Phase 3 module.
 * `kind` — not an E-code — is the discriminator, because this layer never names
 * the CLI's error vocabulary; `acts/dd/doctor.ts` maps it onto E423-E426.
 */
export interface DdAdapterGap {
  /** Absolute path of the document whose render hit the gap. */
  path: string;
  kind: 'load-failed' | 'not-found' | 'output-invalid' | 'runtime-failed';
  message: string;
  schema?: string;
  type?: string;
}

/** The Phase 3 export the doctor consumes. Injected, so Phase 5 wires the real one. */
export interface DdAdapterGapSource {
  adapterGaps(paths: readonly string[]): readonly DdAdapterGap[];
}

export function linkIssue(
  issueClass: DdLinkIssueClass,
  severity: DdSeverity,
  location: string,
  message: string,
  owner: string,
  reason?: DdLinkUnresolvedReason,
): DdLinkIssue {
  return { class: issueClass, severity, location, message, owner, ...(reason && { reason }) };
}
