/**
 * Injected time source. Ported dd verbs get deterministic timestamps in tests by
 * substituting a fixed clock — envelope construction must never read the wall
 * clock directly.
 */
export interface Clock {
  nowIso(): string;
}
