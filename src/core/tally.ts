import type { DdSection, DdShape, DdTallyRole } from './model.js';
import { isRecord } from './value.js';

/** The two markings, for the message that tells an author what it may be. */
export const DD_TALLY_ROLES: readonly DdTallyRole[] = ['in', 'total'];

/** The types a sum is meaningful over. A tally on a string column is a defect. */
export const DD_TALLY_TYPES: readonly string[] = ['int', 'number'];

export function isTallyRole(value: unknown): value is DdTallyRole {
  return value === 'in' || value === 'total';
}

/** Which columns participate, resolved once from the item shape. */
export interface TallyPlan {
  /** Columns marked `in`, in declaration order. Never includes {@link totalColumn}. */
  addends: readonly string[];
  /** The column marked `total`, when the shape declares one. */
  totalColumn?: string;
  /** Every column carrying a footer cell: the addends, then the total column. */
  footerColumns: readonly string[];
}

/**
 * Read the plan off an item shape, or `null` when nothing is marked.
 *
 * `null` is load-bearing rather than a convenience: every document that has not
 * opted in must render byte-identically to before this feature existed, and the
 * callers all branch on this being absent.
 */
export function tallyPlan(itemShape: DdShape | undefined): TallyPlan | null {
  const fields = itemShape?.fields;
  if (!fields) return null;
  const addends: string[] = [];
  let totalColumn: string | undefined;
  for (const [name, shape] of Object.entries(fields)) {
    if (shape.tally === 'in') addends.push(name);
    else if (shape.tally === 'total') totalColumn = name;
  }
  if (addends.length === 0 && totalColumn === undefined) return null;
  return {
    addends,
    ...(totalColumn !== undefined && { totalColumn }),
    footerColumns: totalColumn === undefined ? addends : [...addends, totalColumn],
  };
}

/**
 * How many decimal places a number carries AS AUTHORED.
 *
 * `String(n)` is the shortest round-tripping form of a double, so `2.39` reports
 * 2 — the author's own precision — rather than the seventeen digits the binary
 * value technically holds.
 */
function decimals(value: number): number {
  const text = String(value);
  const exponent = text.indexOf('e');
  if (exponent >= 0) {
    const mantissa = text.slice(0, exponent);
    const dot = mantissa.indexOf('.');
    const digits = dot < 0 ? 0 : mantissa.length - dot - 1;
    return Math.max(0, digits - Number(text.slice(exponent + 1)));
  }
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

/**
 * THE float seam. Every sum in this feature leaves through this one function, so
 * the formatting policy is one edit rather than a hunt.
 *
 * Current policy — sum at the precision the column's own data carries. Binary
 * doubles cannot represent most decimal money, so `1.20 + 2.39` lands on
 * `3.5900000000000003`; under Jordan's ruling that number is not merely rendered,
 * it is STORED and read back out by the next agent's `jq`. Rounding to the
 * authored precision makes the stored value the one a human would write, and an
 * integer column is left exactly alone because integer addition cannot drift.
 *
 * The policy is NOT YET RULED. It is isolated here on purpose.
 */
export function roundToDataPrecision(sum: number, samples: readonly number[]): number {
  if (!Number.isFinite(sum)) return sum;
  let places = 0;
  for (const sample of samples) {
    const carried = decimals(sample);
    if (carried > places) places = carried;
  }
  // 0 places: integers, already exact. Beyond 15: past what a double resolves,
  // so rounding would invent precision rather than remove noise.
  if (places === 0 || places > 15) return sum;
  return Number(sum.toFixed(places));
}

export interface ComputedTally {
  /** Column name → footer sum. The total column's entry IS the grand total. */
  tally: Record<string, number>;
  /** Row sums, index-aligned with the rows given. Empty when no total column. */
  rowTotals: readonly number[];
}

/**
 * Sum a section's rows against its plan. Pure — it never touches the document.
 *
 * A cell contributes only when it really holds a finite number. A marked column
 * whose cell is a string is a schema violation `validateShape` already reports,
 * so silently skipping it here reports the defect once rather than twice, and
 * never produces `NaN` as a stored value.
 *
 * The grand total is the column-sum of the total column — literally the
 * intersection of the two axes, computed as such rather than by a second route
 * that could disagree with it.
 */
export function computeTally(
  rows: readonly Record<string, unknown>[],
  plan: TallyPlan,
): ComputedTally {
  const total = plan.totalColumn;
  const rowTotals: number[] = [];
  // Null-prototype: a column is a schema-authored name, and a field spelled
  // `__proto__` would otherwise assign the prototype instead of a key.
  const columnSamples: Record<string, number[]> = Object.create(null);
  for (const column of plan.addends) columnSamples[column] = [];

  for (const row of rows) {
    const rowSamples: number[] = [];
    for (const column of plan.addends) {
      const value = row[column];
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      rowSamples.push(value);
      columnSamples[column]?.push(value);
    }
    if (total !== undefined) {
      rowTotals.push(
        roundToDataPrecision(
          rowSamples.reduce((sum, value) => sum + value, 0),
          rowSamples,
        ),
      );
    }
  }

  const tally: Record<string, number> = {};
  for (const column of plan.addends) {
    const samples = columnSamples[column] ?? [];
    tally[column] = roundToDataPrecision(
      samples.reduce((sum, value) => sum + value, 0),
      samples,
    );
  }
  if (total !== undefined) {
    tally[total] = roundToDataPrecision(
      rowTotals.reduce((sum, value) => sum + value, 0),
      rowTotals,
    );
  }
  return { tally, rowTotals };
}

/** The rows a tally can be computed over: an array section of objects. */
export function tallyRows(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((entry) => isRecord(entry)) ? (value as Record<string, unknown>[]) : null;
}

/**
 * Bring a section's STORED tally — its footer key and its row-total column — back
 * into agreement with its rows.
 *
 * This is the write half of Jordan's ruling. It runs on the mutation path, where
 * the document is already being rewritten, and never on `dd build`, which stays a
 * renderer. Returns whether anything moved.
 */
export function refreshSectionTally(section: DdSection, itemShape: DdShape | undefined): boolean {
  const plan = tallyPlan(itemShape);
  const rows = tallyRows(section.value);
  if (!plan || !rows) {
    if (section.tally === undefined) return false;
    delete section.tally;
    return true;
  }
  const computed = computeTally(rows, plan);
  let changed = false;
  if (plan.totalColumn !== undefined) {
    rows.forEach((row, index) => {
      const next = computed.rowTotals[index];
      if (next !== undefined && row[plan.totalColumn as string] !== next) {
        row[plan.totalColumn as string] = next;
        changed = true;
      }
    });
  }
  const stored = section.tally;
  if (stored === undefined || !sameTally(stored, computed.tally)) {
    section.tally = computed.tally;
    changed = true;
  }
  return changed;
}

function sameTally(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = Object.keys(b);
  if (Object.keys(a).length !== keys.length) return false;
  return keys.every((key) => Object.is(a[key], b[key]));
}

/** One disagreement between what is stored and what the rows actually sum to. */
export interface TallyMismatch {
  /** Address of the wrong cell, relative to the section. */
  location: string;
  column: string;
  stored: unknown;
  computed: number;
}

/**
 * Recompute and compare — the read half of the ruling, and what makes storing a
 * tally safe instead of merely convenient.
 *
 * A stored tally that nothing re-derives is trusted data, and a hand-edited
 * `.dd.json` then yields a document whose total contradicts its own rows while
 * `dd build --check` PASSES, because the markdown faithfully reflects the wrong
 * JSON. It is not drift; it is internally consistent and false. This reports it.
 * It reports ONLY — repair belongs to the writers.
 */
export function tallyMismatches(
  section: DdSection,
  itemShape: DdShape | undefined,
): TallyMismatch[] {
  const plan = tallyPlan(itemShape);
  const rows = tallyRows(section.value);
  const mismatches: TallyMismatch[] = [];
  if (!plan || !rows) return mismatches;

  const computed = computeTally(rows, plan);
  const total = plan.totalColumn;
  if (total !== undefined) {
    rows.forEach((row, index) => {
      const expected = computed.rowTotals[index];
      if (expected !== undefined && !Object.is(row[total], expected)) {
        mismatches.push({
          location: `value[${index}].${total}`,
          column: total,
          stored: row[total],
          computed: expected,
        });
      }
    });
  }

  const stored = isRecord(section.tally) ? (section.tally as Record<string, unknown>) : undefined;
  for (const column of plan.footerColumns) {
    const expected = computed.tally[column];
    if (expected === undefined) continue;
    const held = stored?.[column];
    if (!Object.is(held, expected)) {
      mismatches.push({
        location: `tally.${column}`,
        column,
        stored: held,
        computed: expected,
      });
    }
  }
  if (stored) {
    for (const column of Object.keys(stored)) {
      if (!plan.footerColumns.includes(column)) {
        mismatches.push({
          location: `tally.${column}`,
          column,
          stored: stored[column],
          computed: Number.NaN,
        });
      }
    }
  }
  return mismatches;
}
