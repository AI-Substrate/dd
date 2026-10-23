import type { Command } from 'commander';
import { isAddressFailure, parseAddress } from '../core/address.js';
import {
  type DdNodeRollup,
  type DdNodeRollupInput,
  type DdRollupDegradation,
  type DdRollupUnknown,
  deriveNodeRollup,
} from '../core/derive.js';
import type { DdSection } from '../core/model.js';
import {
  addressableAt,
  anchorForLocation,
  boundedWalk,
  type DdDocumentIndex,
  type DdLinkEdge,
  indexDocument,
  isWithinLocation,
  resolveMapSeed,
  scanCorpus,
  traverseCorpus,
  UNBOUNDED,
} from '../links/index.js';
// NOT through the `./links` barrel, deliberately. `interiorReaches` is the
// inbound reach predicate shared with `mapAddress`, and it must have exactly one
// implementation — but the barrel is the PUBLIC surface of
// `@ai-substrate/dd/links`, and no public API expansion is authorized here
// (`just check-exports` reds on a surplus symbol). An internal module path keeps
// the single implementation without widening the package's exports, which is the
// same seam `acts/shared.ts` already uses for `../links/model.js`.
import { interiorReaches } from '../links/map.js';
import { type Envelope, formatDegraded, formatError, formatOk } from '../output/envelope.js';
import { ErrorCodes } from '../output/error-codes.js';
import { exitWithEnvelope } from '../output/exit.js';
import type { CliIo, OutputPort } from '../output/output-port.js';
import { posixRelative, toPosix } from '../shared/posix-path.js';
import { codedLinkIssues, createLinkContext, type DdActDeps, nextActionFor } from './shared.js';

/**
 * WHICH edges a completion rollup descends, and in WHICH direction — the one
 * table, and every traversal below reads it rather than restating it.
 *
 * The principle it encodes, ruled on 2026-08-28: **follow an edge only when its
 * target is a completable thing whose completion is part of THIS thing's
 * completion.** Both halves matter. `proven_by` reaches something completable
 * and it is not constitutive — evidence is not constitution — so it stays out.
 *
 * Direction is load-bearing and is the half a reader loses first:
 *
 *  - `derives` is followed OUTBOUND. The source's completion is computed FROM
 *    the target, so descending means walking the arrow forwards.
 *  - `satisfies` is followed INBOUND, and only inbound. The stored edge runs
 *    task -> criterion, so from a CRITERION the tasks that constitute it are the
 *    ones pointing AT it. Following `satisfies` outbound instead would make a
 *    task's completeness depend on the acceptance criterion it contributes to,
 *    which is the rollup inverted — the reading a previous implementation of this
 *    verb wrote down, and the reason this table names a direction at all.
 *
 * Everything absent is NOT followed, and the omissions are the load-bearing part
 * because they are what keeps the denominator honest:
 *
 *  - `proven_by` points at the record that evidences a claim. Evidence is not
 *    constitution, and real corpus targets are commonly stateless.
 *  - `pressure` names the instrument that checks an assertion, and may legally
 *    carry the non-address sentinel `not-applicable`.
 *  - `implemented_by` and any other unknown relation reach ordinary files or
 *    external dependencies, which are leaves of this walk.
 *  - `ref` is the untyped default relation and carries no semantics at all.
 *  - An UNKNOWN relation is not followed, deliberately and conservatively:
 *    adding a relation to a schema must never silently widen what "complete"
 *    means. A narrower answer is wrong in a way a reader notices; a wider one is
 *    wrong in a way that reads as success.
 *
 * Exported so a test can assert the table itself rather than re-deriving it from
 * behaviour, and so no call site below ever writes a second relation set.
 *
 * **CHANGING THIS SET IS CONSUMER-VISIBLE AND REQUIRES NOTIFYING
 * `pij-driving-nigel` BEFORE MERGE.** flowspace3 plan 008 invalidates its cached
 * rollups for a new document by walking that document's OUTBOUND edges in this
 * set; if the set changes, their invalidation target set must change with it, or
 * their rollups go stale SILENTLY — a cache that is never asked to refresh looks
 * exactly like a cache that is up to date. This table is therefore a shared
 * contract with a named external consumer, not a local implementation detail.
 */
export const COMPLETION_RELATIONS = {
  derives: 'outbound',
  satisfies: 'inbound',
} as const satisfies Record<string, 'outbound' | 'inbound'>;

/** Which arm of the walk may follow this relation, or `null` for "do not follow". */
type FollowDirection = (typeof COMPLETION_RELATIONS)[keyof typeof COMPLETION_RELATIONS];

function followDirection(rel: string): FollowDirection | null {
  return (COMPLETION_RELATIONS as Record<string, FollowDirection | undefined>)[rel] ?? null;
}

/** Degradation reasons this verb can report. Open by contract, enumerated here. */
const REASON = {
  unreadable: 'descendant-unreadable',
  schemaUnresolved: 'descendant-schema-unresolved',
  unaddressable: 'descendant-unaddressable',
  unparseable: 'descendant-address-unparseable',
  cycle: 'cycle',
  overlap: 'overlapping-region',
} as const;

/** Why a document could not be turned into an index, when it could not. */
interface IndexFailure {
  reason: string;
  detail: string;
}

/** A document region whose state entries have already been counted exactly once. */
interface Region {
  path: string;
  /** The addressable's location, or `null` for the whole document. */
  location: string | null;
}

interface DeriveNode {
  key: string;
  /** Repo-relative `path#interior` — what a reader would cite. */
  address: string;
  path: string | null;
  interior: string[];
  sectionName: string;
  region: Region | null;
  section: DdSection | null;
  gateTerminal: readonly string[];
  unknown: DdRollupUnknown[];
  degradations: DdRollupDegradation[];
  resolved: boolean;
}

/** One followed hop, read the way the WALK went rather than the way the cell points. */
interface Hop {
  rel: string;
  direction: FollowDirection;
}

/**
 * One followed edge leaving a node, already resolved to what it reaches.
 *
 * `targetPath: null` means the step reaches no node at all — a dangling outbound
 * cell, or an inbound citer that could not be indexed (`failure` says which).
 * Such a step is a LEAF: it becomes an unsurveyed node in the tree, and it is
 * excluded from the cycle graph because nothing can loop through it.
 */
interface FollowedStep extends Hop {
  /** The authoring cell — identity for a dangling edge, and its message. */
  location: string;
  /** The document the cell is authored in. */
  citer: string;
  /** The cell's raw text. */
  address: string;
  targetPath: string | null;
  interior: string[];
  failure?: IndexFailure;
}

/** The tree edge, carrying what rebuilding the tree needs plus WHY it was
 * followed. The relation and direction ride along so a cycle can be reported in
 * the terms that produced it — a loop closed by `derives` and a loop closed by
 * inbound `satisfies` are different defects in the corpus, and a member list
 * that names only documents cannot tell an author which one they have.
 */
interface DeriveEdge extends Hop {
  from: string;
  to: string;
}

function nodeId(path: string, interior: readonly string[]): string {
  const posixPath = toPosix(path);
  return interior.length > 0 ? `${posixPath}#${interior.join('/')}` : posixPath;
}

function displayAddress(repoRoot: string, path: string, interior: readonly string[]): string {
  const relative = posixRelative(repoRoot, path);
  return nodeId(relative.length > 0 ? relative : path, interior);
}

/**
 * Is every state entry of `inner` already inside `outer`?
 *
 * The double-count guard, and the reason it is needed is `ddocs derive <path>`
 * with no interior: the document node's own value structurally contains EVERY
 * section, so a same-document `derives` edge — `tasks[].done` pointing at
 * `#done_when/tk-…`, which `builder/plan` declares — would add rows to the tree
 * that the document node already counted. The totals would then be inflated by
 * exactly the assertions the verb exists to report on.
 */
function regionCovers(outer: Region, inner: Region): boolean {
  if (outer.path !== inner.path) return false;
  if (outer.location === null) return true;
  if (inner.location === null) return false;
  return isWithinLocation(inner.location, outer.location);
}

export function registerDeriveCommand(dd: Command, io: CliIo, deps: DdActDeps): void {
  dd.command('derive <address>')
    .description(
      'Derive the completion rollup for one address, over the relations that constitute it',
    )
    .action(async (address: string) => {
      const ctx = await createLinkContext(io, deps);
      const port = derivePort(io, ctx.port);
      const linkDeps = { schemaResolver: ctx.resolver, docLoader: ctx.loader };

      const seed = resolveMapSeed(address, linkDeps, { repoRoot: ctx.repoRoot });
      if (!seed.ok) {
        const coded = codedLinkIssues(seed.issues);
        exitWithEnvelope(
          formatError(
            'ddocs derive',
            coded[0]?.code ?? ErrorCodes.DD_LINK_UNRESOLVED,
            coded[0]?.message ?? `address did not resolve: ${address}`,
            ctx.clock,
            {
              details: { address, issues: coded },
              next_action: nextActionFor(seed.issues, address),
            },
          ),
          port,
        );
        return;
      }

      const indexes = new Map<string, DdDocumentIndex | null>();
      const indexFailures = new Map<string, IndexFailure>();
      const gateTerminals = new Map<string, readonly string[]>();

      /**
       * Index one document, and resolve the gate-terminal set its rows are judged
       * by, in the same step — the two always travel together (ruling 1), so a
       * document can never be indexed without the set that says what "done" means
       * inside it.
       *
       * Every path asked for is remembered whether or not it could be read: that
       * set IS the basis, and a document that was consulted and found missing is
       * part of what would change this answer if it appeared.
       */
      const indexFor = (path: string): DdDocumentIndex | null => {
        const cached = indexes.get(path);
        if (cached !== undefined) return cached;
        const loaded = ctx.loader.load(path);
        if (!loaded.ok) {
          indexes.set(path, null);
          indexFailures.set(path, { reason: REASON.unreadable, detail: loaded.message });
          return null;
        }
        const resolution = ctx.resolver.resolveDetailed(loaded.doc.dd.schema, loaded.path);
        if (!resolution.record) {
          indexes.set(path, null);
          indexFailures.set(path, {
            reason: REASON.schemaUnresolved,
            detail:
              resolution.issues.find((issue) => issue.severity === 'ERROR')?.message ??
              `schema "${loaded.doc.dd.schema}" did not resolve`,
          });
          return null;
        }
        const index = indexDocument(path, loaded.doc, resolution.record.schema);
        indexes.set(path, index);
        gateTerminals.set(path, resolution.record.gateTerminal);
        return index;
      };

      const seedIndex = indexFor(seed.path);
      const seedEntry = seedIndex ? addressableAt(seedIndex, seed.interior) : undefined;
      if (!seedEntry) {
        // The SEED is what was asked for, so failing to read it is an error and
        // not a caveat — there is no partial answer to degrade to. A document
        // that will not load never gets here (`resolveMapSeed` refuses it
        // first), so this is an unresolvable schema or an interior the index
        // does not carry, and E401/E430 already name both.
        const failure = indexFailures.get(seed.path);
        const schemaFailed = failure?.reason === REASON.schemaUnresolved;
        exitWithEnvelope(
          formatError(
            'ddocs derive',
            schemaFailed ? ErrorCodes.DD_SCHEMA_UNRESOLVABLE : ErrorCodes.DD_LINK_UNRESOLVED,
            schemaFailed
              ? `the schema for ${displayAddress(ctx.repoRoot, seed.path, [])} could not be resolved, so nothing beneath it can be derived: ${failure?.detail ?? ''}`
              : `address resolved to a document but names nothing addressable: ${address}`,
            ctx.clock,
            {
              details: { address, path: posixRelative(ctx.repoRoot, seed.path) },
              next_action: schemaFailed
                ? 'Run `ddocs schema list` to see which schemas resolve from here.'
                : 'Run `ddocs address validate <address> --resolve` to see what the address names.',
            },
          ),
          port,
        );
        return;
      }

      // The EDGE LIST, and it has to span the corpus now that one followed
      // relation runs inbound. An inbound `satisfies` citer is by definition a
      // document the seed does not point at, so a walk rooted at the seed can
      // never see it — the citing document has to be READ for its edge to exist
      // at all. This is the same two-part construction `ddocs links` and
      // `ddocs graph map` already use for their inbound halves, so an edge means
      // here exactly what it means there.
      //
      // Building a corpus-wide edge list is NOT the same thing as widening what
      // the rollup follows: this is discovery, and `COMPLETION_RELATIONS` alone
      // decides descent. Every document below is reached through a ruled
      // relation, and `basis` still reports only the closure that was consulted.
      const scan = scanCorpus(ctx.fs, ctx.repoRoot);
      const scanFailed = scan.issues.find((issue) => issue.severity === 'ERROR');
      if (scanFailed) {
        exitWithEnvelope(
          formatError(
            'ddocs derive',
            ErrorCodes.DD_LINK_SCAN_FAILED,
            scanFailed.message,
            ctx.clock,
            {
              details: { address },
              next_action: 'Fix the unreadable directory, then re-run `ddocs derive <address>`.',
            },
          ),
          port,
        );
        return;
      }
      const corpus = traverseCorpus(scan.paths, linkDeps, {
        repoRoot: ctx.repoRoot,
        mode: 'sweep',
      });
      // OD-1, exactly as `ddocs links` applies it: the corpus half is a SWEEP and
      // honours the exclusions, while the seed was named on the command line and
      // is therefore direct — never skipped, or a rollup on an excluded document
      // would answer "nothing beneath this" when the truth is "I refused to
      // look". `follow: true` because the seed's own outbound `derives` closure
      // may itself run through excluded documents, and clipping it there would
      // report a total that is simply wrong.
      const swept = corpus.nodes.some((node) => node.path === seed.path);
      const collected = swept
        ? corpus.edges
        : [
            ...corpus.edges,
            ...traverseCorpus([seed.path], linkDeps, {
              repoRoot: ctx.repoRoot,
              mode: 'direct',
              follow: true,
            }).edges,
          ];
      // Deduped on the cell that produced it — one authored cell is one edge
      // however many traversals reported it. The double-count guard downstream
      // would absorb a repeat anyway; relying on that would make the arithmetic
      // depend on a subtle interaction rather than on the population being right.
      const seen = new Set<string>();
      const edges: readonly DdLinkEdge[] = collected.filter((edge) => {
        const key = `${edge.kind}\u0000${edge.from}\u0000${edge.location}\u0000${edge.address}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      // `corpus.issues` is deliberately NOT consumed. `traverseCorpus` follows
      // EVERY relation to build the edge list, so its issues describe a superset
      // of this rollup's closure — a `ref` neighbour with an unresolvable schema
      // would degrade an answer it is not part of, and flip `complete` to false
      // for a tree that is genuinely complete. MEASURED, not theoretical: a
      // document reachable only through `meta.log` did exactly that, while
      // `basis` correctly excluded it, and the disagreement between the two was
      // the tell. Widening the sweep to the corpus makes this MORE true, not
      // less: the issues now describe every unrelated document in the repository.
      // Every document this rollup actually consults is described by `describe()`
      // below, which reports its own failure precisely; that is the reporting
      // surface, and it is exactly the closure.

      const nodes = new Map<string, DeriveNode>();
      const parentOf = new Map<string, string>();
      const counted: Region[] = [];
      /**
       * Every document the ROLLUP consulted — the basis, and only the basis.
       *
       * Tracked separately from `indexes` because the cycle pre-pass below reads
       * documents the rollup TREE never counts (it deliberately walks through
       * regions the double-count guard suppresses). Keying the basis off
       * `indexes` would then quietly widen it to include documents that are not
       * part of the answer, which is the same over-wide reporting the relation
       * table exists to prevent.
       */
      const consulted = new Set<string>();
      const consult = (path: string): DdDocumentIndex | null => {
        consulted.add(path);
        return indexFor(path);
      };

      const sectionOf = (interior: readonly string[]): string => interior.at(0) ?? '';

      /** A node standing in for a subtree that could not be surveyed. */
      const unknownNode = (
        key: string,
        nodeAddress: string,
        path: string | null,
        interior: string[],
        failure: IndexFailure,
      ): DeriveNode => {
        const section = sectionOf(interior);
        return {
          key,
          address: nodeAddress,
          path,
          interior,
          sectionName: section,
          region: null,
          section: null,
          // No schema resolved here, so there is NO terminal set to report. An
          // empty array says that; borrowing the parent's would be a claim about
          // a vocabulary nobody read.
          gateTerminal: [],
          unknown: [{ id: interior.at(-1) ?? nodeAddress, address: nodeAddress, section }],
          degradations: [{ reason: failure.reason, address: nodeAddress, detail: failure.detail }],
          resolved: false,
        };
      };

      const describe = (path: string, interior: string[]): DeriveNode => {
        const key = nodeId(path, interior);
        const index = consult(path);
        const nodeAddress = displayAddress(ctx.repoRoot, path, interior);
        if (!index) {
          const failure = indexFailures.get(path) ?? {
            reason: REASON.unreadable,
            detail: `${nodeAddress} could not be read`,
          };
          return unknownNode(key, nodeAddress, path, interior, failure);
        }
        const entry = addressableAt(index, interior);
        if (!entry) {
          return unknownNode(key, nodeAddress, path, interior, {
            reason: REASON.unaddressable,
            detail: `the document resolved but carries nothing addressable at ${interior.join('/')}`,
          });
        }
        return {
          key,
          address: nodeAddress,
          path,
          interior,
          sectionName: sectionOf(interior),
          region: { path, location: entry.location },
          section: { name: interior.at(-1) ?? 'document', value: entry.value },
          gateTerminal: gateTerminals.get(path) ?? [],
          unknown: [],
          degradations: [],
          resolved: true,
        };
      };

      const seedNode = describe(seed.path, seed.interior);
      // The root ECHOES the request, per the wire contract, rather than the
      // canonicalised spelling the walk keys on.
      seedNode.address = address;
      nodes.set(seedNode.key, seedNode);
      if (seedNode.region) counted.push(seedNode.region);

      /**
       * Every followed edge leaving one node — the ONLY reader of
       * {@link COMPLETION_RELATIONS}, and therefore the one place direction is
       * interpreted.
       *
       * Both the cycle pre-pass and the rollup tree consume this, so they cannot
       * disagree about which edges exist. They differ only in what they DO with
       * a step, which is the whole point: the tree suppresses regions it has
       * already counted, and the pre-pass must not, or a cycle closed through a
       * suppressed edge becomes invisible (F1).
       *
       * `resolve` is injected because the two phases must not agree about
       * `basis` either: the tree consults, the pre-pass merely reads.
       */
      const followedSteps = (
        path: string,
        interior: readonly string[],
        resolve: (target: string) => DdDocumentIndex | null,
      ): FollowedStep[] => {
        const index = resolve(path);
        const anchor = index ? addressableAt(index, interior) : undefined;
        if (!anchor) return [];

        const steps: FollowedStep[] = [];
        for (const edge of edges) {
          const direction = followDirection(edge.rel);
          // The ONE decision point. An unruled relation — `proven_by`,
          // `pressure`, `ref`, `implemented_by`, or anything a schema invents
          // tomorrow — leaves here and never reaches `nodes`, `basis` or `total`,
          // so its failures cannot contaminate this rollup either.
          if (direction === null) continue;
          const base = {
            rel: edge.rel,
            direction,
            location: edge.location,
            citer: edge.from,
            address: edge.address,
          };

          if (direction === 'outbound') {
            // Authored HERE, so it belongs to this node only when the cell sits
            // inside this node's own region.
            if (edge.from !== path) continue;
            if (!isWithinLocation(edge.location, anchor.location)) continue;
            const parsed = parseAddress(edge.address);
            if (edge.to === null || isAddressFailure(parsed)) {
              steps.push({ ...base, targetPath: null, interior: [] });
              continue;
            }
            steps.push({
              ...base,
              targetPath: edge.to,
              interior: parsed.segments.map((segment) => segment.value),
            });
            continue;
          }

          // INBOUND. The cell is authored in the OTHER document and points at
          // this one, so the location test above answers the wrong question:
          // what qualifies the edge is that its TARGET lands at this node or
          // inside it. A task citing `#acceptance_criteria/ac-0201` constitutes
          // that criterion and also the section holding it; a task citing the
          // whole section does not constitute one particular row within it. That
          // asymmetry is `interiorReaches`, shared with `mapAddress`'s inbound
          // arm so the two cannot drift about which citers count.
          if (edge.to !== path) continue;
          const parsed = parseAddress(edge.address);
          if (isAddressFailure(parsed)) continue;
          if (
            !interiorReaches(
              interior,
              parsed.segments.map((segment) => segment.value),
            )
          ) {
            continue;
          }

          // Resolved only NOW — after the edge is known to be followed AND known
          // to reach this node. On the TREE's `resolve` this is what writes
          // `basis`, so asking about a mere candidate would put every citer in
          // the repository into the consulted set whether or not it joined.
          const citerIndex = resolve(edge.from);
          if (!citerIndex) {
            // Readable enough to yield an edge, not readable enough to index.
            // Carried as an unsurveyed subtree rather than dropped: a
            // `satisfies` citer nobody could read is exactly the case where
            // believing the criterion's own stored row is wrong.
            steps.push({
              ...base,
              targetPath: null,
              interior: [],
              failure: indexFailures.get(edge.from) ?? {
                reason: REASON.unreadable,
                detail: `${posixRelative(ctx.repoRoot, edge.from)} could not be read`,
              },
            });
            continue;
          }
          // The citing ROW, not the citing file: `anchorForLocation` walks back
          // from the cell to the nearest id-bearing thing, so an inbound arm
          // reports `tasks/tk-0001` rather than the document it lives in — and
          // counts that row's subtree rather than every row in the file.
          steps.push({
            ...base,
            targetPath: edge.from,
            interior: anchorForLocation(citerIndex, edge.location),
          });
        }
        return steps;
      };

      /** The node a step reaches, or `null` when the step reaches nothing. */
      const stepKey = (step: FollowedStep): string | null =>
        step.targetPath === null ? null : nodeId(step.targetPath, step.interior);

      const hopOf = (step: FollowedStep): Hop => ({ rel: step.rel, direction: step.direction });

      /** The chain of keys from the root down to `key`, root first. */
      const ancestry = (key: string): string[] => {
        const chain: string[] = [];
        let current: string | undefined = key;
        while (current !== undefined) {
          chain.unshift(current);
          current = parentOf.get(current);
        }
        return chain;
      };

      /** The ruled relation and direction that first reached each node. */
      const reachedBy = new Map<string, Hop>();

      /**
       * How a cycle reads once the relations that produced it are written in:
       * `a -[derives outbound]-> b -[satisfies inbound]-> a`.
       *
       * `members` is the loop with its first node repeated at the end, and `hops`
       * is the relation that carried each step, so `hops` is always one shorter.
       *
       * The arrow always points the way the WALK went, which is not always the
       * way the stored edge points — an inbound `satisfies` hop is drawn from the
       * criterion to the task that satisfies it, because that is the descent this
       * rollup actually made. Naming the relation AND the direction is what tells
       * a reader the stored edge runs the other way, and it is the difference
       * between "these documents form a loop" and a defect an author can fix.
       */
      const renderCycle = (members: readonly string[], hops: readonly Hop[]): string =>
        members
          .map((member, position) => {
            const name = posixRelative(ctx.repoRoot, member);
            if (position === 0) return name;
            const hop = hops[position - 1];
            return hop === undefined ? name : `-[${hop.rel} ${hop.direction}]-> ${name}`;
          })
          .join(' ');

      /**
       * The cycle pre-pass, over the COMPLETE followed adjacency.
       *
       * This runs BEFORE the tree, and that ordering is the whole fix (F1). The
       * tree cannot answer "is there a cycle" on its own, for two independent
       * reasons that compound:
       *
       *  - it keeps ONE parent per node (first discovery), so its ancestry chain
       *    describes a spanning tree rather than the graph, and a cycle closed by
       *    a CROSS edge — one between two branches — is not on any chain; and
       *  - its double-count guard SUPPRESSES the second edge into an
       *    already-counted region, which is precisely the edge that closes such a
       *    cycle. So the evidence is discarded before the question is asked.
       *
       * MEASURED, not theoretical: a root with two inbound `satisfies` citers
       * that both derive from one target, which derives back to the second citer,
       * reported `ok` / `complete: true` / `total: 4` / no degradations while its
       * followed graph contained a loop.
       *
       * So the graph is walked once with NOTHING suppressed, and cycles are found
       * over that adjacency. The rollup TREE is still built separately and still
       * suppresses — totals and shape are unchanged — it simply no longer has to
       * be the thing that notices a loop.
       */
      const adjacency = new Map<string, FollowedStep[]>();
      const graphNodes = new Map<string, { path: string; interior: string[] }>();
      graphNodes.set(seedNode.key, { path: seed.path, interior: [...seed.interior] });
      boundedWalk<FollowedStep>(
        [seedNode.key],
        (key) => {
          const node = graphNodes.get(key);
          if (!node) return [];
          // `indexFor`, never `consult`: reading a document to decide whether it
          // sits on a loop is not the same as counting its rows, and the basis
          // reports what the ANSWER rests on.
          const steps = followedSteps(node.path, node.interior, indexFor).filter(
            (step): step is FollowedStep & { targetPath: string } => step.targetPath !== null,
          );
          adjacency.set(key, steps);
          return steps.map((step) => {
            const target = nodeId(step.targetPath, step.interior);
            if (!graphNodes.has(target)) {
              graphNodes.set(target, { path: step.targetPath, interior: step.interior });
            }
            return { key: target, edge: step };
          });
        },
        UNBOUNDED,
      );

      /**
       * Every cycle in the followed graph, as a degradation naming its members
       * and the relation and direction of every hop.
       *
       * Depth-first back-edge detection, iterative so a deep corpus cannot blow
       * the JS stack. It is written out here rather than reached for in
       * `src/links/` deliberately: this is a COMPLETION-specific question — it
       * runs over the ruled relation set and reports in relation/direction terms
       * — and the links layer has no cycle primitive to reuse (`boundedWalk`
       * breaks loops with a visited set, which is the opposite of reporting
       * them). `boundedWalk` still does the reachability above; only the
       * back-edge bookkeeping is local.
       *
       * A directed graph has a cycle if and only if a depth-first search finds a
       * back edge, and every cycle carries at least one, so this cannot miss a
       * loop the earlier ancestry check would have caught. A CROSS edge into an
       * already-finished node is not a cycle and is correctly ignored — which is
       * what stops a plain diamond, the shape a corpus legitimately contains,
       * from being reported as one.
       */
      const detectCycles = (): DdRollupDegradation[] => {
        const found: DdRollupDegradation[] = [];
        const seenCycles = new Set<string>();
        const finished = new Set<string>();
        const depthOf = new Map<string, number>();
        const path: { key: string; via: Hop | null }[] = [];
        const frames: { key: string; steps: readonly FollowedStep[]; cursor: number }[] = [];

        const push = (key: string, via: Hop | null): void => {
          depthOf.set(key, path.length);
          path.push({ key, via });
          frames.push({ key, steps: adjacency.get(key) ?? [], cursor: 0 });
        };

        push(seedNode.key, null);
        while (frames.length > 0) {
          const frame = frames[frames.length - 1];
          if (frame === undefined) break;
          if (frame.cursor >= frame.steps.length) {
            finished.add(frame.key);
            depthOf.delete(frame.key);
            path.pop();
            frames.pop();
            continue;
          }
          const step = frame.steps[frame.cursor];
          frame.cursor += 1;
          if (step === undefined) continue;
          const target = stepKey(step);
          if (target === null) continue;

          const at = depthOf.get(target);
          if (at !== undefined) {
            // A BACK EDGE — the target is still open on the current path, so
            // following it re-enters a node whose completeness is being computed
            // from itself. No number over that is trustworthy.
            const members = [...path.slice(at).map((entry) => entry.key), target];
            const hops = [...path.slice(at + 1).map((entry) => entry.via as Hop), hopOf(step)];
            const canonical = members.join('\u0000');
            if (!seenCycles.has(canonical)) {
              seenCycles.add(canonical);
              // The back edge's ORIGIN — the row whose cell closes the loop,
              // which is the one an author can go and change.
              const origin = graphNodes.get(frame.key);
              found.push({
                reason: REASON.cycle,
                address: origin
                  ? displayAddress(ctx.repoRoot, origin.path, origin.interior)
                  : posixRelative(ctx.repoRoot, frame.key),
                detail: `completion cycle: ${renderCycle(members, hops)}`,
              });
            }
            continue;
          }
          // A cross or forward edge into a node already fully explored closes no
          // loop; only a node still on the path does.
          if (finished.has(target)) continue;
          push(target, hopOf(step));
        }
        return found;
      };

      const cycles = detectCycles();

      const expand = (key: string): { key: string; edge: DeriveEdge }[] => {
        const from = nodes.get(key);
        if (!from?.resolved || from.path === null) return [];

        const steps: { key: string; edge: DeriveEdge }[] = [];
        const schedule = (node: DeriveNode, via: Hop): void => {
          if (!nodes.has(node.key)) nodes.set(node.key, node);
          if (!parentOf.has(node.key)) parentOf.set(node.key, key);
          if (!reachedBy.has(node.key)) reachedBy.set(node.key, via);
          steps.push({ key: node.key, edge: { from: key, to: node.key, ...via } });
        };

        /**
         * One followed step, resolved to the node it reaches — the guards that
         * decide whether that node joins the ROLLUP TREE.
         *
         * Both guards are direction-BLIND on purpose. A region already counted
         * through one arm must not be counted again through the other, and both
         * arms therefore key on the same node identity (`path#interior`, with no
         * arm prefix — unlike `mapAddress`, which keeps its arms in separate
         * namespaces because it is drawing a picture rather than adding up rows).
         * That shared identity is what lets a diamond flatten instead of
         * inflating the total.
         *
         * Neither guard REPORTS a cycle any more; the pre-pass above owns that,
         * over an adjacency neither guard has touched. The ancestry check here
         * survives only to terminate the branch, which is what keeps the tree
         * finite and its shape unchanged.
         */
        const consider = (targetPath: string, interior: string[], via: Hop): void => {
          const targetKey = nodeId(targetPath, interior);
          if (ancestry(key).includes(targetKey)) return;

          const node = describe(targetPath, interior);
          const nodeRegion = node.region;
          if (nodeRegion) {
            const enclosing = counted.find((region) => regionCovers(region, nodeRegion));
            if (enclosing) {
              // Every row here was already counted — skipping is the ONLY thing
              // that keeps the arithmetic right, and it covers the document-scope
              // case (where `tasks[].done` points inside the document node's own
              // value), a diamond where two parents derive from one target, and
              // an inbound `satisfies` citer living inside a document already
              // counted whole.
              //
              // Nothing is lost and nothing is hidden: the rows are in the total
              // and, if open, named in `incomplete`. Only the tree SHAPE is
              // flatter. This silence used to be able to cover a defect — it
              // could swallow the edge that closed a cross-edge cycle — which is
              // exactly why cycles are now decided before any of it runs.
              return;
            }
            const swallowed = counted.find((region) => regionCovers(nodeRegion, region));
            if (swallowed) {
              // The reverse overlap, and it cannot be resolved by skipping OR by
              // adding: adding double-counts the inner region, skipping drops
              // the rest of the outer one. So it is reported rather than
              // guessed — an inexact derived number is worse than the stored
              // field this verb exists to distrust.
              from.degradations.push({
                reason: REASON.overlap,
                address: node.address,
                detail: `${node.address} encloses a region already counted in this rollup, so it was left out rather than counted twice`,
              });
              return;
            }
            counted.push(nodeRegion);
          }
          schedule(node, via);
        };

        for (const step of followedSteps(from.path, from.interior, consult)) {
          const via = hopOf(step);
          if (step.targetPath === null) {
            // A followed step that reaches nothing is a NODE, never a silence.
            // `ddocs links` can report ok with no issue for exactly this shape; a
            // completion answer must not, because the subtree it failed to reach
            // is the subtree that decides the verdict.
            schedule(
              step.failure
                ? unknownNode(
                    `!in\u0000${step.citer}\u0000${step.location}`,
                    displayAddress(ctx.repoRoot, step.citer, []),
                    step.citer,
                    [from.sectionName],
                    step.failure,
                  )
                : unknownNode(
                    `!${step.citer}\u0000${step.location}`,
                    step.address,
                    null,
                    [from.sectionName],
                    {
                      reason: REASON.unparseable,
                      detail: `the ${step.rel} cell at ${step.location} does not resolve to a document in this repository`,
                    },
                  ),
              via,
            );
            continue;
          }
          consider(step.targetPath, step.interior, via);
        }
        return steps;
      };

      // UNBOUNDED on purpose. A depth bound would silently answer a NARROWER
      // question than the one asked — a rollup clipped at depth 3 reports a
      // total that is simply wrong — and the walk needs no bound to terminate:
      // `boundedWalk` schedules each node once and carries its own derived
      // tripwire, which is what makes the corpus's real completion cycles safe —
      // including the ones that only close because one arm runs inbound.
      const walk = boundedWalk<DeriveEdge>([seedNode.key], expand, UNBOUNDED);

      const childrenOf = new Map<string, string[]>();
      for (const visit of walk.order) {
        if (visit.via === null) continue;
        childrenOf.set(visit.via.from, [...(childrenOf.get(visit.via.from) ?? []), visit.key]);
      }

      // The pre-pass found the cycles; they are attached HERE, once the tree
      // exists and it is knowable which of their members it actually carries.
      //
      // A cycle is reported on the row whose cell closes it, because that is the
      // one an author can change. When the tree does not carry that row — the
      // double-count guard can legitimately leave a loop member out of the tree
      // while the loop still governs the answer — it lands on the root instead,
      // which is the one node guaranteed to exist. It is never dropped: a
      // degradation this rollup cannot place is still a degradation, and the
      // whole contract is that "I could not look" outranks completeness.
      const inTree = new Set(walk.order.map((visit) => visit.key));
      for (const cycle of cycles) {
        const host = [...inTree]
          .map((key) => nodes.get(key))
          .find((node) => node?.address === cycle.address);
        (host ?? seedNode).degradations.push(cycle);
      }

      const toInput = (key: string): DdNodeRollupInput => {
        const node = nodes.get(key);
        const children = (childrenOf.get(key) ?? []).map(toInput);
        if (!node) return { address: key, children };
        return {
          address: node.address,
          sectionName: node.sectionName,
          ...(node.section && { section: node.section }),
          gateTerminal: node.gateTerminal,
          ...(node.unknown.length > 0 && { unknown: node.unknown }),
          ...(node.degradations.length > 0 && { degradations: node.degradations }),
          children,
        };
      };

      // Built AFTER the walk and after the cycles are attached, so every
      // degradation — overlap, unreadable, and loop — is already on its node.
      const rollup = deriveNodeRollup(toInput(seedNode.key), seedNode.gateTerminal);

      // Every document this rollup consulted, including ones it could not read:
      // creating a missing target changes the answer, so a consumer keying
      // re-derivation on this set must be told to watch it. Sorted and deduped
      // so two runs over an unchanged corpus are byte-identical.
      //
      // `consulted`, NOT `indexes`: the cycle pre-pass reads documents the tree
      // never counts, and a basis that grew to include them would report a
      // dependency the answer does not actually rest on.
      const basis = [...new Set([...consulted].map((path) => posixRelative(ctx.repoRoot, path)))]
        .filter((path) => path.length > 0)
        .sort();

      const data = { ...rollup, basis };

      if (rollup.degradations.length > 0) {
        exitWithEnvelope(
          formatDegraded(
            'ddocs derive',
            data,
            `${rollup.degradations.length} part(s) of this tree could not be surveyed (${[
              ...new Set(rollup.degradations.map((degradation) => degradation.reason)),
            ].join(', ')}) — the rollup is a floor, not a verdict.`,
            ctx.clock,
          ),
          port,
        );
        return;
      }
      exitWithEnvelope(
        formatOk('ddocs derive', data, ctx.clock, {
          next_action: rollup.complete
            ? 'Nothing is open beneath this address.'
            : `Open rows: ${rollup.incomplete.map((entry) => entry.id).join(', ')}`,
        }),
        port,
      );
    });
}

/**
 * The human port: the headline answer on stdout, everything else on stderr.
 *
 * A rollup's whole value is one line — how many of the rows beneath this address
 * are actually done — and the default renderer's `ddocs derive: ok` says nothing
 * about that. The open ids go to stderr rather than stdout so
 * `ddocs derive <address> --no-json` still pipes a single summary line.
 */
function derivePort(io: CliIo, jsonPort: OutputPort): OutputPort {
  if (io.mode === 'json') return jsonPort;
  return {
    emit: (envelope: Envelope) => {
      if (envelope.status === 'error') {
        io.writers.err(`${envelope.command}: ${envelope.error?.message ?? 'failed'}\n`);
        if (envelope.next_action) io.writers.err(`  \u2192 ${envelope.next_action}\n`);
        return;
      }
      const data = envelope.data as DdNodeRollup;
      const mark = data.complete ? '[x]' : '[ ]';
      io.writers.out(
        `${mark} ${data.address} ${data.total - data.incomplete.length}/${data.total}\n`,
      );
      for (const entry of data.incomplete) io.writers.err(`  open: ${entry.id}\n`);
      for (const degradation of data.degradations) {
        io.writers.err(`  ${degradation.reason}: ${degradation.address}\n`);
      }
      if (envelope.next_action) io.writers.err(`  \u2192 ${envelope.next_action}\n`);
    },
  };
}
