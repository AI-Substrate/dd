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
  boundedWalk,
  type DdDocumentIndex,
  type DdLinkEdge,
  indexDocument,
  isWithinLocation,
  resolveMapSeed,
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
 * The ONE relation a completion rollup composes over.
 *
 * `derives` is declared in `core/constants.ts` as "this item's state is computed
 * FROM the target", which is precisely the edge a rollup is allowed to descend.
 * Reading the tree off the relation rather than off field names is the same
 * discipline `rel` exists for: `builder/plan` spells it `phases[].tasks` and
 * `tasks[].done`, another schema will spell it something else, and neither name
 * appears here.
 *
 * The other four are deliberately NOT followed, and the exclusion is what keeps
 * the denominator honest. `pressure` names the instrument that checks a claim and
 * `proven_by` points at the record that evidences it — following either would
 * pull backpressure rows and execution-log entries into the total and report a
 * task as incomplete because a log entry it cites is open. `satisfies` points
 * UPWARD at an acceptance criterion, so following it would make a task's
 * completeness depend on the AC it contributes to, which is the rollup inverted.
 */
const DERIVES_REL = 'derives';

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

/** The tree edge, carrying only what rebuilding the tree needs. */
interface DeriveEdge {
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
    .description('Derive the completion rollup for one address from the rows beneath it')
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

      // Outbound-only, from the seed document. `traverseCorpus` is the shipped
      // document-level walk, so an edge means here exactly what it means to
      // `ddocs graph` and `ddocs links`; seeding it at the addressed document
      // rather than at the corpus keeps a rollup off every unrelated file.
      const corpus = traverseCorpus([seed.path], linkDeps, {
        repoRoot: ctx.repoRoot,
        mode: 'direct',
        follow: true,
      });
      const edges: readonly DdLinkEdge[] = corpus.edges;
      // `corpus.issues` is deliberately NOT consumed. `traverseCorpus` follows
      // EVERY relation to build the edge list, so its issues describe a superset
      // of this rollup's closure — a `ref` neighbour with an unresolvable schema
      // would degrade an answer it is not part of, and flip `complete` to false
      // for a tree that is genuinely complete. MEASURED, not theoretical: a
      // document reachable only through `meta.log` did exactly that, while
      // `basis` correctly excluded it, and the disagreement between the two was
      // the tell. Every document this rollup actually consults is described by
      // `describe()` below, which reports its own failure precisely; that is the
      // reporting surface, and it is exactly the closure.

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

      const expand = (key: string): { key: string; edge: DeriveEdge }[] => {
        const from = nodes.get(key);
        if (!from?.resolved || from.path === null) return [];
        const index = indexFor(from.path);
        const anchor = index ? addressableAt(index, from.interior) : undefined;
        if (!anchor) return [];

        const steps: { key: string; edge: DeriveEdge }[] = [];
        const schedule = (node: DeriveNode): void => {
          if (!nodes.has(node.key)) nodes.set(node.key, node);
          if (!parentOf.has(node.key)) parentOf.set(node.key, key);
          steps.push({ key: node.key, edge: { from: key, to: node.key } });
        };

        for (const edge of edges) {
          if (edge.from !== from.path) continue;
          if (edge.rel !== DERIVES_REL) continue;
          if (!isWithinLocation(edge.location, anchor.location)) continue;

          const parsed = parseAddress(edge.address);
          if (edge.to === null || isAddressFailure(parsed)) {
            // A `derives` cell that points at nothing is a NODE, never a
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
                  detail: `the derives cell at ${edge.location} does not resolve to a document in this repository`,
                },
              ),
            );
            continue;
          }

          const interior = parsed.segments.map((segment) => segment.value);
          const targetKey = nodeId(edge.to, interior);
          const chain = ancestry(key);
          if (chain.includes(targetKey)) {
            // A `derives` CYCLE. Terminate THIS branch only — every other branch
            // of this node keeps being walked — and name every member, because
            // "the walk stopped here" is useless without saying which documents
            // form the loop. It DEGRADES rather than succeeding quietly: a cycle
            // means some node's completeness is defined in terms of itself, and
            // no number computed over that is trustworthy.
            const members = [...chain.slice(chain.indexOf(targetKey)), targetKey].map((member) =>
              posixRelative(ctx.repoRoot, member),
            );
            from.degradations.push({
              reason: REASON.cycle,
              address: from.address,
              detail: `derives cycle: ${members.join(' -> ')}`,
            });
            continue;
          }

          const node = describe(edge.to, interior);
          const nodeRegion = node.region;
          if (nodeRegion) {
            const enclosing = counted.find((region) => regionCovers(region, nodeRegion));
            if (enclosing) {
              // Every row here was already counted — skipping is the ONLY thing
              // that keeps the arithmetic right, and it covers the document-scope
              // case (where `tasks[].done` points inside the document node's own
              // value) and a diamond where two parents derive from one target.
              //
              // Nothing is lost and nothing is hidden: the rows are in the total
              // and, if open, named in `incomplete`. Only the tree SHAPE is
              // flatter. A CYCLE never reaches here — it was named above — so
              // this silence never covers a defect.
              continue;
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
              continue;
            }
            counted.push(nodeRegion);
          }
          schedule(node);
        }
        return steps;
      };

      // UNBOUNDED on purpose. A depth bound would silently answer a NARROWER
      // question than the one asked — a rollup clipped at depth 3 reports a
      // total that is simply wrong — and the walk needs no bound to terminate:
      // `boundedWalk` schedules each node once and carries its own derived
      // tripwire, which is what makes the corpus's real `derives` cycles safe.
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
