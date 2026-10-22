import { isAddressFailure, parseAddress } from './address.js';

/**
 * What makes a destination a dd ADDRESS, and why one fails to resolve.
 *
 * Deliberately an unpublished module: everything here is shared vocabulary
 * between dd-core and the links layer, and none of it is a new public symbol.
 * `./links` re-exports `DD_SUFFIX` and `DdLinkUnresolvedReason` under the names
 * it always had, so the published surface does not move.
 */

/** Every deterministic document carries this suffix; enumeration matches nothing else. */
export const DD_SUFFIX = '.dd.json';

/**
 * Why an address failed to reach a target. Every reason is reported under the
 * one class `link-unresolved` (E430), so the class does not discriminate them,
 * the reason does, and it is what a consumer switches on instead of matching
 * message text.
 *
 * `no-interior` is a REASON of its own and not a flavour of `section-unknown`,
 * and the difference is what the doctor reads. `section-unknown` means "this
 * document has no such section", a defect inside a dd document, which the
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

/**
 * Is this inline Markdown destination a dd address rather than a link to an
 * ordinary file?
 *
 * It is when it parses as an address, names a `.dd.json` file, and carries a
 * non-empty interior: `[Halden](world.dd.json#entities/halden)` points at a ROW,
 * and a row is something dd can check. Everything else stays an ordinary file
 * link with an existence-only check: `notes.md#intro`, a whole-file
 * `world.dd.json` (no interior to resolve), and a fragment that does not parse
 * as an interior.
 *
 * The ONE copy of this predicate (backlog row 29 is what three copies of one
 * predicate cost). The collector that turns these into link cells and the
 * traversal that keeps them out of the file arm both call it.
 */
export function isInlineDdAddress(destination: string): boolean {
  const address = parseAddress(destination);
  return (
    !isAddressFailure(address) &&
    address.file !== null &&
    address.file.endsWith(DD_SUFFIX) &&
    address.segments.length > 0
  );
}
