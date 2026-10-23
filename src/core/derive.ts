import { DEFAULT_GATE_TERMINAL_STATES } from './constants.js';
import type { DdSection } from './model.js';
import { isRecord } from './value.js';

export interface DdDerivedState {
  complete: boolean;
  status: 'complete' | 'incomplete';
  terminal: number;
  total: number;
  incomplete: string[];
}

/**
 * One row that is not gate-terminal, named the way a consumer can act on it.
 *
 * The row-local `id` is what a human cites and `address` is what a machine
 * re-resolves; both are carried because neither substitutes for the other across
 * a rollup that spans documents — two files can each hold a `tk-0001`, and an
 * aggregated list of bare ids cannot say which one is open.
 *
 * `state` is OMITTED, never null, when the row's state could not be read at all.
 * That is the difference between "this row says `unchecked`" and "nothing here
 * could be read", and collapsing the two would let a failed walk look like a
 * surveyed one.
 */
export interface DdRollupIncomplete {
  id: string;
  address: string;
  section: string;
  state?: string;
}

/**
 * Something that stopped the walk from seeing everything it was asked about.
 *
 * `reason` is an OPEN string rather than a closed union: the set of ways a
 * document closure can fail to be readable is not knowable in advance, and a
 * closed vocabulary here would force a future failure to masquerade as an
 * existing one.
 */
export interface DdRollupDegradation {
  reason: string;
  address: string;
  detail?: string;
}

/** A row known to be incomplete although no state was readable for it. */
export interface DdRollupUnknown {
  id: string;
  address: string;
  section: string;
}

export interface DdNodeRollupInput {
  /** Fully qualified address of this node — what a reader would cite. */
  address: string;
  section?: DdSection;
  /** The section name reported on each row this node contributes. */
  sectionName?: string;
  gateTerminal?: readonly string[];
  /**
   * Rows this node carries that are incomplete by CONSTRUCTION rather than by a
   * state value — an unreadable descendant standing in for the subtree nobody
   * could survey. They count toward `total`, which is what makes "count the
   * unreachable descendant as incomplete rather than skipping it" arithmetic
   * instead of a promise.
   */
  unknown?: readonly DdRollupUnknown[];
  degradations?: readonly DdRollupDegradation[];
  children?: readonly DdNodeRollupInput[];
}

/** The recursive wire shape: every node answers the same seven questions. */
export interface DdNodeRollup {
  address: string;
  complete: boolean;
  gate_terminal: string[];
  total: number;
  incomplete: DdRollupIncomplete[];
  nodes: DdNodeRollup[];
  degradations: DdRollupDegradation[];
}

export interface DdRollupInput {
  id: string;
  source?: string;
  section?: DdSection;
  /**
   * The gate-terminal set governing THIS node's own section, when it differs
   * from the one the whole rollup was called with.
   *
   * A rollup composed by following links crosses DOCUMENT boundaries, and two
   * documents in one tree may resolve different schemas — a `builder/plan` row
   * judged by the built-in five can derive from a `builder/review` row whose
   * schema declares `approved`/`waived`. One set applied to the whole tree would
   * then be confidently wrong about half of it, in exactly the way a hardcoded
   * set is confidently wrong about a custom schema. The set travels WITH the node
   * it governs, because that is where the schema that declared it was resolved.
   *
   * Absent means "judge me by the rollup's set", so an existing single-schema
   * caller is unaffected.
   */
  gateTerminal?: readonly string[];
  children?: readonly DdRollupInput[];
}

export interface DdRollupState extends DdDerivedState {
  id: string;
  source?: string;
  children: DdRollupState[];
}

/**
 * One evidence entry as the collector found it: what it is called, and the state
 * value it carries. The atom every completion answer in dd is computed from.
 */
export interface DdStateEntry {
  id: string;
  state: string;
}

function collectStateEntries(value: unknown, entries: DdStateEntry[], location: string): void {
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      collectStateEntries(entry, entries, `${location}[${index}]`);
    }
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.state === 'string') {
    entries.push({
      id: typeof value.id === 'string' ? value.id : location,
      state: value.state,
    });
  }
  for (const [field, entry] of Object.entries(value)) {
    if (field !== 'id' && field !== 'state') {
      collectStateEntries(entry, entries, `${location}.${field}`);
    }
  }
}

/**
 * Every evidence entry the section carries, in document order, each with the state
 * value it holds.
 *
 * This is the read model underneath `deriveState`, exposed deliberately: a caller
 * that needs to say WHAT state each item is in — not merely how many passed a
 * terminal set — would otherwise have to write a second walker over `section.value`,
 * and two structural collectors one directory apart eventually disagree about a
 * nested shape. Then the same document reports different totals depending on who
 * asked. One collector, two projections.
 */
export function deriveItems(section: DdSection): DdStateEntry[] {
  const entries: DdStateEntry[] = [];
  collectStateEntries(section.value, entries, `$.sections[${section.name}].value`);
  return entries;
}

/** Compute a completable section from its evidence-entry state values. */
export function deriveState(
  section: DdSection,
  gateTerminal: readonly string[] = DEFAULT_GATE_TERMINAL_STATES,
): DdDerivedState {
  const entries = deriveItems(section);
  const terminalSet = new Set(gateTerminal);
  const incomplete = entries
    .filter((entry) => !terminalSet.has(entry.state))
    .map((entry) => entry.id);
  const terminal = entries.length - incomplete.length;
  const complete = incomplete.length === 0;
  return {
    complete,
    status: complete ? 'complete' : 'incomplete',
    terminal,
    total: entries.length,
    incomplete,
  };
}

/**
 * The address a row inside this node is cited by.
 *
 * A node addressed at an interior extends it (`…#done_when/tk-0003` + `as-0005`);
 * a node addressed at a whole DOCUMENT has to open one, and the section the row
 * was collected from is the only honest thing to open it with.
 */
function entryAddress(nodeAddress: string, sectionName: string, id: string): string {
  return nodeAddress.includes('#') ? `${nodeAddress}/${id}` : `${nodeAddress}#${sectionName}/${id}`;
}

/**
 * Compose pre-resolved sections into the recursive wire rollup. The caller owns
 * link resolution; core owns every invariant that decides `complete`.
 *
 * **A degradation outranks completeness, at every node.** A node whose own walk
 * degraded, or any of whose descendants degraded, cannot be complete no matter
 * what its rows say — because the rows it could not read might have said
 * anything. That is the whole reason this verb is trustworthy: it is the one
 * place where "I could not look" is arithmetically different from "I looked and
 * it was fine", and a consumer never has to remember to check a second field.
 *
 * `complete:false` with an EMPTY `incomplete` is therefore legal, and means
 * exactly one thing: nothing readable was open, and something was unreadable.
 *
 * `total:0` with `complete:true` is also legal and is NOT the same answer. It
 * means the walk succeeded and found no assertion carried here at all. The pair
 * (`degradations`, `total`) separates a genuinely empty subtree from a failed
 * one, which a single boolean never could.
 *
 * `incomplete` and `degradations` AGGREGATE upward — own rows first in document
 * order, then each child in walk order — so the root is a complete list and a
 * consumer reads one array instead of walking the tree to find them.
 */
export function deriveNodeRollup(
  input: DdNodeRollupInput,
  gateTerminal: readonly string[] = DEFAULT_GATE_TERMINAL_STATES,
): DdNodeRollup {
  const nodes = (input.children ?? []).map((child) => deriveNodeRollup(child, gateTerminal));
  const terminal = input.gateTerminal ?? gateTerminal;
  const terminalSet = new Set(terminal);
  const sectionName = input.sectionName ?? input.section?.name ?? '';

  const entries = input.section ? deriveItems(input.section) : [];
  const ownIncomplete: DdRollupIncomplete[] = entries
    .filter((entry) => !terminalSet.has(entry.state))
    .map((entry) => ({
      id: entry.id,
      address: entryAddress(input.address, sectionName, entry.id),
      section: sectionName,
      state: entry.state,
    }));
  const unknown = (input.unknown ?? []).map((row) => ({
    id: row.id,
    address: row.address,
    section: row.section,
  }));

  const incomplete = [...ownIncomplete, ...unknown, ...nodes.flatMap((node) => node.incomplete)];
  const degradations = [
    ...(input.degradations ?? []),
    ...nodes.flatMap((node) => node.degradations),
  ];
  const total = entries.length + unknown.length + nodes.reduce((sum, node) => sum + node.total, 0);

  return {
    address: input.address,
    complete: incomplete.length === 0 && degradations.length === 0,
    gate_terminal: [...terminal],
    total,
    incomplete,
    nodes,
    degradations,
  };
}

/**
 * Compose pre-resolved sections across document boundaries. The caller owns link
 * resolution; core owns the invariant that every descendant must be complete.
 *
 * `gateTerminal` is the set for nodes that do not carry their own; a node's own
 * {@link DdRollupInput.gateTerminal} wins for that node and is NOT inherited,
 * because it was resolved from that node's document and says nothing about a
 * child living in another one.
 *
 * A PROJECTION of {@link deriveNodeRollup} down to bare ids, never a second
 * implementation. Two rollups that must agree about what "complete" means
 * eventually disagree, and the disagreement shows up as a number that is wrong
 * rather than as a test that is red — the same trap `deriveItems` exists to
 * close for structural collection.
 */
export function deriveRollup(
  input: DdRollupInput,
  gateTerminal: readonly string[] = DEFAULT_GATE_TERMINAL_STATES,
): DdRollupState {
  const toNode = (node: DdRollupInput): DdNodeRollupInput => ({
    address: node.id,
    ...(node.section && { section: node.section }),
    ...(node.gateTerminal && { gateTerminal: node.gateTerminal }),
    children: (node.children ?? []).map(toNode),
  });
  const project = (node: DdNodeRollup, source: DdRollupInput): DdRollupState => {
    const complete = node.complete;
    return {
      id: source.id,
      ...(source.source && { source: source.source }),
      children: node.nodes.map((child, index) =>
        project(child, (source.children ?? [])[index] as DdRollupInput),
      ),
      complete,
      status: complete ? 'complete' : 'incomplete',
      terminal: node.total - node.incomplete.length,
      total: node.total,
      incomplete: node.incomplete.map((entry) => entry.id),
    };
  };
  return project(deriveNodeRollup(toNode(input), gateTerminal), input);
}
