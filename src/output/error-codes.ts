/**
 * Stable machine-readable error codes. Ported dd verbs append their own here so
 * the code space stays enumerable in one place.
 */
export const ErrorCodes = {
  /** The requested command is not registered. */
  UNKNOWN_COMMAND: 'E001',
  /** Argument/flag validation failed before any work started. */
  INVALID_USAGE: 'E002',
  /** An unexpected failure escaped a verb. */
  UNEXPECTED: 'E999',
  /** Missing/invalid argument or flag, detected inside a verb body. */
  INVALID_ARGS: 'E108',
  // --- `harness dd` core/validate (plan 065; E400-E409 complete allocation) ---
  /** A `.dd.json` file is not valid JSON or does not carry the required dd envelope. */
  DD_DOCUMENT_INVALID: 'E400',
  /** The document's named schema could not be resolved. */
  DD_SCHEMA_UNRESOLVABLE: 'E401',
  /** Document data does not conform to its resolved section/shape declarations. */
  DD_SCHEMA_SHAPE_INVALID: 'E402',
  /** A dd instance id violates the registered minted-id or explicit-id rules. */
  DD_ID_INVALID: 'E403',
  /** Two instances share an id in one document's single id namespace. */
  DD_ID_DUPLICATE: 'E404',
  /** A dd address violates the locked file/interior grammar. */
  DD_ADDRESS_INVALID: 'E405',
  /** A link cell resolves to a schema/shape level different from its declared type path. */
  DD_LINK_TYPE_MISMATCH: 'E406',
  /** A value is outside the built-in or schema-declared enum vocabulary. */
  DD_ENUM_INVALID: 'E407',
  /** A `blocked` or `na` completion state is missing its required explanatory note. */
  DD_STATE_NOTE_REQUIRED: 'E408',
  /** A `human-skipped` completion state is missing a receipt with the human's verbatim words. */
  DD_HUMAN_SKIP_RECEIPT_REQUIRED: 'E409',
  // --- `harness dd schema|docs` (plan 065 Phase 2; E410-E419 complete allocation) ---
  /** No schema package exists for the requested qualified name. */
  DD_SCHEMA_NOT_FOUND: 'E410',
  /** A discovered schema package is malformed or incomplete. */
  DD_SCHEMA_PACKAGE_INVALID: 'E411',
  /** Multiple schemas in one precedence root declare the same qualified name. */
  DD_SCHEMA_NAME_CONFLICT: 'E412',
  /** A lower-precedence schema is shadowed by the selected schema. */
  DD_SCHEMA_SHADOWED: 'E413',
  /** A schema package declares an unsupported dd/schema version. */
  DD_SCHEMA_VERSION_UNSUPPORTED: 'E414',
  /** A schema enum or its gate-terminal declaration is invalid. */
  DD_SCHEMA_ENUM_INVALID: 'E415',
  /** Searching the convention-based schema roots failed. */
  DD_SCHEMA_SCAN_FAILED: 'E416',
  /** A schema path resolves outside an allowed discovery root. */
  DD_SCHEMA_PATH_ESCAPE: 'E417',
  /** Writing or regenerating a schema-owned artifact failed. */
  DD_SCHEMA_WRITE_FAILED: 'E418',
  /** `dd docs get`: no baked dd documentation entry exists for the requested id. */
  DD_DOCS_ENTRY_NOT_FOUND: 'E419',
  // --- `harness dd build` render/adapters (plan 065 Phase 3; E420-E429 complete allocation) ---
  /** Deterministic rendering failed before a complete markdown result was produced. */
  DD_RENDER_FAILED: 'E420',
  /** Writing the generated sibling `.dd.md` failed. */
  DD_RENDER_WRITE_FAILED: 'E421',
  /** `dd build --check`: committed markdown differs from a fresh deterministic render. */
  DD_RENDER_DRIFT: 'E422',
  /** A schema-declared custom type has no discoverable render adapter. */
  DD_ADAPTER_NOT_FOUND: 'E423',
  /** A discovered render adapter could not be loaded. */
  DD_ADAPTER_LOAD_FAILED: 'E424',
  /** A render adapter threw while converting a value. */
  DD_ADAPTER_RUNTIME_FAILED: 'E425',
  /** A render adapter returned a non-string or otherwise invalid fragment. */
  DD_ADAPTER_OUTPUT_INVALID: 'E426',
  /** Refreshing a live references-ledger basis during render failed. */
  DD_LIVE_BASIS_REFRESH_FAILED: 'E427',
  /** Phase 3 watcher support could not subscribe, process, or regenerate a changed document. */
  DD_WATCH_FAILED: 'E428',
  /** `dd build` received an unreadable path or unsupported input shape. */
  DD_BUILD_INPUT_INVALID: 'E429',
  // --- `harness dd address|link|links|graph|doctor` (plan 065 Phase 4; E430-E439 complete allocation) ---
  /** An address could not be resolved to the named document/section/instance. */
  DD_LINK_UNRESOLVED: 'E430',
  /** The target file named by a dd address does not exist. */
  DD_LINK_TARGET_MISSING: 'E431',
  /** The target file named by a dd address exists but is not tracked. */
  DD_LINK_TARGET_UNTRACKED: 'E432',
  /** A dd address resolves outside the repository boundary. */
  DD_LINK_PATH_ESCAPE: 'E433',
  /** A references-ledger sha does not match the current target document. */
  DD_BASIS_STALE: 'E434',
  /** Phase 4 basis verification or explicit re-verification could not complete. */
  DD_BASIS_VERIFY_FAILED: 'E435',
  /** Computing inbound/outbound links by local scan failed. */
  DD_LINK_SCAN_FAILED: 'E436',
  /** Building the standalone mermaid graph failed. */
  DD_GRAPH_FAILED: 'E437',
  /** `dd doctor` found one or more ERROR-class document findings. */
  DD_DOCTOR_FINDINGS: 'E438',
  /** The repo-wide doctor discovery/validation sweep itself failed. */
  DD_DOCTOR_SCAN_FAILED: 'E439',
  // --- flow dd-gate integration (plan 065 Phase 6; E440-E449 complete allocation) ---
  /** Navigation attempted to leave a node whose linked dd gate is incomplete. */
  DD_GATE_UNSATISFIED: 'E440',
  /** A flow node's dd gate address does not resolve to a completable target. */
  DD_GATE_TARGET_INVALID: 'E441',
  /** The schema needed to evaluate a linked dd gate could not be resolved. */
  DD_GATE_SCHEMA_UNRESOLVABLE: 'E442',
  /** The basis recorded beside a flow dd gate is stale. */
  DD_GATE_BASIS_STALE: 'E443',
  /** Computing a dd gate result failed for a non-classified reason. */
  DD_GATE_EVALUATION_FAILED: 'E444',
  /** A requested dd gate override is malformed or not permitted by the caller contract. */
  DD_GATE_OVERRIDE_INVALID: 'E445',
  /** A gate item carries a state outside the schema-declared vocabulary. */
  DD_GATE_STATE_INVALID: 'E446',
  /** Recording a successful `--force` gate override in the flow event log failed. */
  DD_GATE_EVENT_WRITE_FAILED: 'E447',
  /** Rendering or orienting the computed dd gate surface failed. */
  DD_GATE_SURFACE_FAILED: 'E448',
  /** A gate-enabled flow node is missing its required dd link data. */
  DD_GATE_LINK_MISSING: 'E449',
  // --- dd writer verbs + the plan semantic layer (plan 070 Phase 1; E450-E459 complete allocation) ---
  /** An address does not name a target the requested mutation can act on. */
  DD_MUTATION_TARGET_INVALID: 'E450',
  /** The mutation would introduce a schema violation; nothing was written. */
  DD_MUTATION_SCHEMA_REFUSED: 'E451',
  /** Writing the mutated document (or its regenerated sibling) failed. */
  DD_MUTATION_WRITE_FAILED: 'E452',
  /** A supplied value cannot be read as the type the schema declares for that cell. */
  DD_MUTATION_VALUE_INVALID: 'E453',
  /** No collision-free id could be minted under the requested registered prefix. */
  DD_ID_MINT_FAILED: 'E454',
  /** A schema declares a link relation that is not a non-empty string. */
  DD_REL_INVALID: 'E455',
  /** A gate-terminal item links to a target that is not itself gate-terminal. */
  DD_PLAN_CONTRADICTION: 'E456',
  /** `plan validate --complete` found open completables or unclaimed acceptance criteria. */
  DD_PLAN_INCOMPLETE: 'E457',
  /** A `--address` scope did not resolve to an item inside the plan. */
  DD_PLAN_SCOPE_UNRESOLVED: 'E458',
  /** The plan semantic validation pass itself could not complete. */
  DD_PLAN_VALIDATE_FAILED: 'E459',

  // --- builder fence + review documents (plan 071 ph-7103; E460-E469) ---
  /** `harness plan fence`: a touched path is refused by an active fence row. */
  DD_FENCE_VIOLATION: 'E460',
  /** `harness plan fence`: the fence document itself cannot be read as a fence. */
  DD_FENCE_INVALID: 'E461',

  // --- plan readiness gate (plan 072; E462) ---
  /** `harness plan ready --strict` reached a not-ready verdict; CI asked for teeth. */
  DD_PLAN_NOT_READY: 'E462',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
