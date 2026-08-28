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
  interiorReaches,
  isWithinLocation,
  resolveMapSeed,
  scanCorpus,
  traverseCorpus,
  UNBOUNDED,
} from '../links/index.js';
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

/**
 * The tree edge, carrying what rebuilding the tree needs plus WHY it was
 * followed. The relation and direction ride along so a cycle can be reported in
 * the terms that produced it — a loop closed by `derives` and a loop closed by
 * inbound `satisfies` are different defects in the corpus, and a member list
 * that names only documents cannot tell an author which one they have.
 */
interface DeriveEdge {
  from: string;
  to: string;
  rel: string;
  direction: FollowDirection;
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
        const index = indexFor(path);
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
      const reachedBy = new Map<string, { rel: string; direction: FollowDirection }>();

      /**
       * How a chain of node keys reads once the relations that produced it are
       * written in: `a -[derives outbound]-> b -[satisfies inbound]-> a`.
       *
       * The arrow always points the way the WALK went, which is not always the
       * way the stored edge points — an inbound `satisfies` hop is drawn from the
       * criterion to the task that satisfies it, because that is the descent this
       * rollup actually made. Naming the relation AND the direction is what tells
       * a reader the stored edge runs the other way, and it is the difference
       * between "these documents form a loop" and a defect an author can fix.
       */
      const renderChain = (
        keys: readonly string[],
        closing: { rel: string; direction: FollowDirection },
      ): string =>
        keys
          .map((member, position) => {
            const name = posixRelative(ctx.repoRoot, member);
            if (position === 0) return name;
            const via = position === keys.length - 1 ? closing : reachedBy.get(member);
            return via === undefined ? name : `-[${via.rel} ${via.direction}]-> ${name}`;
          })
          .join(' ');

      const expand = (key: string): { key: string; edge: DeriveEdge }[] => {
        const from = nodes.get(key);
        if (!from?.resolved || from.path === null) return [];
        const fromPath = from.path;
        const index = indexFor(fromPath);
        const anchor = index ? addressableAt(index, from.interior) : undefined;
        if (!anchor) return [];

        const steps: { key: string; edge: DeriveEdge }[] = [];
        const schedule = (
          node: DeriveNode,
          via: { rel: string; direction: FollowDirection },
        ): void => {
          if (!nodes.has(node.key)) nodes.set(node.key, node);
          if (!parentOf.has(node.key)) parentOf.set(node.key, key);
          if (!reachedBy.has(node.key)) reachedBy.set(node.key, via);
          steps.push({ key: node.key, edge: { from: key, to: node.key, ...via } });
        };

        /**
         * One followed edge, already resolved to the node it reaches — the guards
         * that decide whether that node joins the tree, written ONCE for both
         * arms.
         *
         * Cycle detection and the double-count guard are direction-BLIND on
         * purpose. A loop closed by two `derives` hops and a loop closed by a
         * `derives` hop plus an inbound `satisfies` hop are the same defect, and
         * a region already counted through one arm must not be counted again
         * through the other. Both arms therefore key on the same node identity
         * (`path#interior`, with no arm prefix — unlike `mapAddress`, which keeps
         * its arms in separate namespaces because it is drawing a picture rather
         * than adding up rows). That shared identity is what lets a diamond
         * flatten instead of inflating the total.
         */
        const consider = (
          targetPath: string,
          interior: string[],
          via: { rel: string; direction: FollowDirection },
        ): void => {
          const targetKey = nodeId(targetPath, interior);
          const chain = ancestry(key);
          if (chain.includes(targetKey)) {
            // A completion CYCLE. Terminate THIS branch only — every other
            // branch of this node keeps being walked — and name every member,
            // because "the walk stopped here" is useless without saying which
            // documents form the loop. It DEGRADES rather than succeeding
            // quietly: a cycle means some node's completeness is defined in
            // terms of itself, and no number computed over that is trustworthy.
            const members = [...chain.slice(chain.indexOf(targetKey)), targetKey];
            from.degradations.push({
              reason: REASON.cycle,
              address: from.address,
              detail: `completion cycle: ${renderChain(members, via)}`,
            });
            return;
          }

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
              // flatter. A CYCLE never reaches here — it was named above — so
              // this silence never covers a defect.
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

        for (const edge of edges) {
          const direction = followDirection(edge.rel);
          // The ONE decision point. An unruled relation — `proven_by`,
          // `pressure`, `ref`, `implemented_by`, or anything a schema invents
          // tomorrow — leaves here and never reaches `nodes`, `basis` or `total`,
          // so its failures cannot contaminate this rollup either.
          if (direction === null) continue;
          const via = { rel: edge.rel, direction };

          if (direction === 'outbound') {
            // Authored HERE, so it belongs to this node only when the cell sits
            // inside this node's own region.
            if (edge.from !== fromPath) continue;
            if (!isWithinLocation(edge.location, anchor.location)) continue;

            const parsed = parseAddress(edge.address);
            if (edge.to === null || isAddressFailure(parsed)) {
              // A followed cell that points at nothing is a NODE, never a
              // silence. `ddocs links` can report ok with no issue for exactly
              // this shape; a completion answer must not, because the subtree it
              // failed to reach is the subtree that decides the verdict.
              schedule(
                unknownNode(
                  `!${edge.from}\u0000${edge.location}`,
                  edge.address,
                  null,
                  [from.sectionName],
                  {
                    reason: REASON.unparseable,
                    detail: `the ${edge.rel} cell at ${edge.location} does not resolve to a document in this repository`,
                  },
                ),
                via,
              );
              continue;
            }
            consider(
              edge.to,
              parsed.segments.map((segment) => segment.value),
              via,
            );
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
          if (edge.to !== fromPath) continue;
          const parsed = parseAddress(edge.address);
          if (isAddressFailure(parsed)) continue;
          const target = parsed.segments.map((segment) => segment.value);
          if (!interiorReaches(from.interior, target)) continue;

          // Indexed only NOW — after the edge is known to be followed AND known
          // to reach this node. `indexFor` is what writes `basis`, so asking it
          // about a mere candidate would put every citer in the repository into
          // the consulted set whether or not it joined the rollup.
          const citer = indexFor(edge.from);
          if (!citer) {
            // Readable enough to yield an edge, not readable enough to index.
            // Counted as an unsurveyed subtree rather than dropped: a
            // `satisfies` citer nobody could read is exactly the case where
            // believing the criterion's own stored row is wrong.
            const failure = indexFailures.get(edge.from) ?? {
              reason: REASON.unreadable,
              detail: `${posixRelative(ctx.repoRoot, edge.from)} could not be read`,
            };
            schedule(
              unknownNode(
                `!in\u0000${edge.from}\u0000${edge.location}`,
                displayAddress(ctx.repoRoot, edge.from, []),
                edge.from,
                [from.sectionName],
                failure,
              ),
              via,
            );
            continue;
          }
          // The citing ROW, not the citing file: `anchorForLocation` walks back
          // from the cell to the nearest id-bearing thing, so an inbound arm
          // reports `tasks/tk-0001` rather than the document it lives in — and
          // counts that row's subtree rather than every row in the file.
          consider(edge.from, anchorForLocation(citer, edge.location), via);
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

      // Built AFTER the walk, so degradations recorded during expansion (cycles,
      // overlaps) are already on their nodes.
      const rollup = deriveNodeRollup(toInput(seedNode.key), seedNode.gateTerminal);

      // Every document this rollup consulted, including ones it could not read:
      // creating a missing target changes the answer, so a consumer keying
      // re-derivation on this set must be told to watch it. Sorted and deduped
      // so two runs over an unchanged corpus are byte-identical.
      const basis = [
        ...new Set([...indexes.keys()].map((path) => posixRelative(ctx.repoRoot, path))),
      ]
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
