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
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
