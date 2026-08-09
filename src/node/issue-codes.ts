import type { DdIssueClass } from '../core/validate.js';
import type { DdLinkIssueClass } from '../links/model.js';
import { ErrorCodes } from '../output/error-codes.js';

/**
 * Finding class → frozen E-code, for **every** class dd can produce.
 *
 * dd-core, the schema layer and the links layer all stay free of `output/`, and
 * the architecture gate proves it: `test/architecture/dd-core-isolation.test.ts`
 * walks every import edge out of the SDK tree and fails on one. So the map from a
 * structured finding to the CLI's error vocabulary cannot live beside the
 * findings — it lives HERE, in the host-bound tier, which is the nearest module
 * to the consumer that is allowed to name `output/`. That constraint is why the
 * ratified landing moved (amendment A-1): `./core/validate` could not hold it
 * without either duplicating the E-code literals or inverting the boundary.
 *
 * There used to be three copies of this table — one per act that reports findings
 * — and they had already drifted: `address-path-escape` answered to the generic
 * address code in `dd validate` and to the specific link-escape code in
 * `dd doctor`, so one finding had two codes depending on which verb reported it.
 * One exported map, one answer (P5 T004).
 *
 * The collapse arbitrates exactly ONE class — `address-path-escape`, where the
 * specific code was ruled the winner. Every other class keeps the code its
 * general consumers already gave it: `link-scan-failed` stays
 * `DD_LINK_SCAN_FAILED`, NOT the doctor's `DD_DOCTOR_SCAN_FAILED`, because a
 * class code says what went wrong and must not change with the verb that reports
 * it. `dd doctor` still answers a failed sweep with `DD_DOCTOR_SCAN_FAILED` —
 * that is its ENVELOPE code, hardcoded at its own exit site, so the sweep needs
 * no override in this table (P5 review F002).
 *
 * TypeScript's exhaustive `Record` is the guard that matters: a new issue class
 * cannot be added to any dd layer without this map failing to compile.
 */
export const DD_ISSUE_CODES: Record<DdIssueClass | DdLinkIssueClass, string> = {
  'address-malformed': ErrorCodes.DD_ADDRESS_INVALID,
  'address-path-absolute': ErrorCodes.DD_ADDRESS_INVALID,
  // The specific code wins over the generic one: a path that leaves the
  // repository is a link-path escape, and it is called that wherever it is
  // reported (P5 ruling, PM-confirmed).
  'address-path-escape': ErrorCodes.DD_LINK_PATH_ESCAPE,
  'address-path-non-posix': ErrorCodes.DD_ADDRESS_INVALID,
  'address-target-missing': ErrorCodes.DD_LINK_TARGET_MISSING,
  'address-target-untracked': ErrorCodes.DD_LINK_TARGET_UNTRACKED,
  'adapter-gap': ErrorCodes.DD_ADAPTER_NOT_FOUND,
  'basis-stale': ErrorCodes.DD_BASIS_STALE,
  'duplicate-id': ErrorCodes.DD_ID_DUPLICATE,
  'enum-invalid': ErrorCodes.DD_ENUM_INVALID,
  'human-skipped-receipt-required': ErrorCodes.DD_HUMAN_SKIP_RECEIPT_REQUIRED,
  'id-invalid': ErrorCodes.DD_ID_INVALID,
  'link-scan-failed': ErrorCodes.DD_LINK_SCAN_FAILED,
  'link-scan-incomplete': ErrorCodes.DD_LINK_SCAN_FAILED,
  'link-type-mismatch': ErrorCodes.DD_LINK_TYPE_MISMATCH,
  'link-unresolved': ErrorCodes.DD_LINK_UNRESOLVED,
  'schema-shape': ErrorCodes.DD_SCHEMA_SHAPE_INVALID,
  'schema-unresolvable': ErrorCodes.DD_SCHEMA_UNRESOLVABLE,
  'state-note-required': ErrorCodes.DD_STATE_NOTE_REQUIRED,
};
