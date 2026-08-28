import type { Command } from 'commander';
import { isAddressFailure, parseAddress } from '../core/address.js';
import { type DdRollupInput, deriveRollup } from '../core/derive.js';
import type { DdSection } from '../core/model.js';
import {
  addressableAt,
  boundedWalk,
  type DdDocumentIndex,
  type DdLinkEdge,
  type DdLinkIssue,
  indexDocument,
  isWithinLocation,
  linkIssue,
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

/**
 * The state a descendant gets when the walk could not read it.
 *
 * It is never gate-terminal under any schema anyone would write — the leading
 * `#` cannot appear in a sane enum vocabulary — so `deriveState` counts it as
 * incomplete and names the unreachable address in `incomplete[]`. That is the
 * whole mechanism behind ruling 3: a rollup over a partially-resolved tree
 * CANNOT come back `complete`, and it does not come back complete because the
 * act remembered to check — it comes back incomplete because core applied the
 * one invariant it owns to an entry the act honestly reported as unknown.
 *
 * It is internal by construction: `deriveState` projects entries down to their
 * IDS, so this string never reaches the envelope.
 */
const UNRESOLVED_STATE = '#unresolved';

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
  region: Region | null;
  section: DdSection | null;
  gateTerminal: readonly string[] | null;
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

      const issues: DdLinkIssue[] = [];
      const indexes = new Map<string, DdDocumentIndex | null>();
      const gateTerminals = new Map<string, readonly string[] | null>();
      const schemaNames = new Map<string, string | null>();

      /**
       * Index one document, and resolve the gate-terminal set its rows are judged
       * by, in the same step — the two always travel together (ruling 1), so a
       * document can never be indexed without the set that says what "done" means
       * inside it.
       */
      const indexFor = (path: string): DdDocumentIndex | null => {
        const cached = indexes.get(path);
        if (cached !== undefined) return cached;
        const loaded = ctx.loader.load(path);
        if (!loaded.ok) {
          indexes.set(path, null);
          gateTerminals.set(path, null);
          schemaNames.set(path, null);
          return null;
        }
        const resolution = ctx.resolver.resolveDetailed(loaded.doc.dd.schema, loaded.path);
        if (!resolution.record) {
          indexes.set(path, null);
          gateTerminals.set(path, null);
          schemaNames.set(path, loaded.doc.dd.schema);
          return null;
        }
        const index = indexDocument(path, loaded.doc, resolution.record.schema);
        indexes.set(path, index);
        gateTerminals.set(path, resolution.record.gateTerminal);
        schemaNames.set(path, resolution.record.name);
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
        const unresolvableSchema = seedIndex === null;
        exitWithEnvelope(
          formatError(
            'ddocs derive',
            unresolvableSchema ? ErrorCodes.DD_SCHEMA_UNRESOLVABLE : ErrorCodes.DD_LINK_UNRESOLVED,
            unresolvableSchema
              ? `the schema for ${displayAddress(ctx.repoRoot, seed.path, [])} could not be resolved, so nothing beneath it can be derived`
              : `address resolved to a document but names nothing addressable: ${address}`,
            ctx.clock,
            {
              details: { address, path: posixRelative(ctx.repoRoot, seed.path) },
              next_action: unresolvableSchema
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
      issues.push(...corpus.issues);
      const edges: readonly DdLinkEdge[] = corpus.edges;

      const nodes = new Map<string, DeriveNode>();
      const counted: Region[] = [];

      const sectionFor = (interior: readonly string[], value: unknown): DdSection => ({
        name: interior.at(-1) ?? 'document',
        value,
      });

      const describe = (path: string, interior: string[]): DeriveNode => {
        const key = nodeId(path, interior);
        const index = indexFor(path);
        const entry = index ? addressableAt(index, interior) : undefined;
        const address = displayAddress(ctx.repoRoot, path, interior);
        if (!entry) {
          return {
            key,
            address,
            path,
            interior,
            region: null,
            section: sectionFor(interior, [{ id: address, state: UNRESOLVED_STATE }]),
            gateTerminal: null,
            resolved: false,
          };
        }
        return {
          key,
          address,
          path,
          interior,
          region: { path, location: entry.location },
          section: sectionFor(interior, entry.value),
          gateTerminal: gateTerminals.get(path) ?? null,
          resolved: true,
        };
      };

      /** A `derives` cell that points at nothing — a node, never a silence. */
      const danglingNode = (edge: DdLinkEdge): DeriveNode => ({
        key: `!${edge.from}\u0000${edge.location}`,
        address: edge.address,
        path: null,
        interior: [],
        region: null,
        section: sectionFor([], [{ id: edge.address, state: UNRESOLVED_STATE }]),
        gateTerminal: null,
        resolved: false,
      });

      const seedNode = describe(seed.path, seed.interior);
      nodes.set(seedNode.key, seedNode);
      if (seedNode.region) counted.push(seedNode.region);

      const expand = (key: string): { key: string; edge: DeriveEdge }[] => {
        const from = nodes.get(key);
        if (!from?.resolved || from.path === null) return [];
        const index = indexFor(from.path);
        const anchor = index ? addressableAt(index, from.interior) : undefined;
        if (!anchor) return [];

        const steps: { key: string; edge: DeriveEdge }[] = [];
        for (const edge of edges) {
          if (edge.from !== from.path) continue;
          if (edge.rel !== DERIVES_REL) continue;
          if (!isWithinLocation(edge.location, anchor.location)) continue;

          const parsed = parseAddress(edge.address);
          if (edge.to === null || isAddressFailure(parsed)) {
            const node = danglingNode(edge);
            if (!nodes.has(node.key)) nodes.set(node.key, node);
            steps.push({ key: node.key, edge: { from: key, to: node.key } });
            continue;
          }

          const interior = parsed.segments.map((segment) => segment.value);
          const node = describe(edge.to, interior);
          const nodeRegion = node.region;
          if (nodeRegion) {
            const enclosing = counted.find((counted) => regionCovers(counted, nodeRegion));
            if (enclosing) {
              // Every row here was already counted — skipping is the ONLY thing
              // that keeps the arithmetic right, and it covers three cases at
              // once because a region contains itself: an ancestor that already
              // spans this node (the document-scope case, where `tasks[].done`
              // points inside the document node's own value), a diamond where
              // two parents derive from one target, and a `derives` CYCLE
              // arriving back at somewhere already counted.
              //
              // Nothing is lost in any of them: the rows are in the total and,
              // if open, named in `incomplete[]`. Only the tree SHAPE is
              // flatter. `boundedWalk`'s scheduled set independently guarantees
              // the walk terminates; this guarantees it counts.
              continue;
            }
            const swallowed = counted.find((counted) => regionCovers(nodeRegion, counted));
            if (swallowed) {
              // The reverse overlap, and it cannot be resolved by skipping OR by
              // adding: adding double-counts the inner region, skipping drops
              // the rest of the outer one. Refusing to guess is the ruling —
              // an inexact derived number is worse than the stored field this
              // verb exists to distrust.
              issues.push(
                linkIssue(
                  'link-scan-incomplete',
                  'WARN',
                  edge.location,
                  `${node.address} encloses a region already counted in this rollup — it was left out rather than counted twice`,
                  edge.from,
                ),
              );
              continue;
            }
            counted.push(nodeRegion);
          }
          nodes.set(node.key, node);
          steps.push({ key: node.key, edge: { from: key, to: node.key } });
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

      const toInput = (key: string): DdRollupInput => {
        const node = nodes.get(key);
        const children = (childrenOf.get(key) ?? []).map(toInput);
        if (!node) return { id: key, children };
        return {
          id: node.address,
          ...(node.path !== null && { source: posixRelative(ctx.repoRoot, node.path) }),
          ...(node.section && { section: node.section }),
          ...(node.gateTerminal && { gateTerminal: node.gateTerminal }),
          children,
        };
      };

      const seedGateTerminal = gateTerminals.get(seed.path) ?? undefined;
      const rollup = deriveRollup(toInput(seedNode.key), seedGateTerminal);

      const unresolved = walk.order
        .map((visit) => nodes.get(visit.key))
        .filter((node): node is DeriveNode => node !== undefined && !node.resolved)
        .map((node) => node.address);

      const coded = codedLinkIssues(issues);
      const data = {
        address,
        path: posixRelative(ctx.repoRoot, seed.path),
        interior: seed.interior,
        schema: schemaNames.get(seed.path) ?? null,
        gate_terminal: [...(seedGateTerminal ?? [])],
        rel: DERIVES_REL,
        complete: rollup.complete,
        status: rollup.status,
        terminal: rollup.terminal,
        total: rollup.total,
        incomplete: rollup.incomplete,
        children: rollup.children,
        counts: { nodes: walk.order.length, unresolved: unresolved.length },
        unresolved,
        issues: coded,
      };

      if (unresolved.length > 0) {
        exitWithEnvelope(
          formatDegraded(
            'ddocs derive',
            data,
            `${unresolved.length} descendant(s) could not be read (${unresolved.join(', ')}) — they are counted as incomplete, so this rollup is a floor and not a verdict.`,
            ctx.clock,
          ),
          port,
        );
        return;
      }
      if (coded.length > 0) {
        exitWithEnvelope(
          formatDegraded(
            'ddocs derive',
            data,
            `${coded.length} issue(s) were raised while walking the tree — re-run \`ddocs doctor\` before trusting this rollup.`,
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
            : `Open rows: ${rollup.incomplete.join(', ')}`,
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
      const data = envelope.data as {
        address: string;
        complete: boolean;
        terminal: number;
        total: number;
        incomplete: string[];
      };
      const mark = data.complete ? '[x]' : '[ ]';
      io.writers.out(`${mark} ${data.address} ${data.terminal}/${data.total}\n`);
      for (const id of data.incomplete) io.writers.err(`  open: ${id}\n`);
      if (envelope.next_action) io.writers.err(`  \u2192 ${envelope.next_action}\n`);
    },
  };
}
