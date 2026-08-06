import type { Clock } from '../adapters/clock/clock-port.js';

/**
 * Dependencies every act receives. Ported dd verbs extend this with their own
 * ports (fs, git, hash…) rather than reaching for Node built-ins directly.
 */
export interface ActDeps {
  clock: Clock;
}
