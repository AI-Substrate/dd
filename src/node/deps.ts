import type { Clock } from '../adapters/clock/clock-port.js';

/**
 * Dependencies every act receives. Ported dd verbs extend this with their own
 * ports (fs, git, hash…) rather than reaching for Node built-ins directly.
 *
 * @experimental Admitted because the measured trial floor requires it, and it is
 * honestly one-consumer-shaped. A rename or reshape is a plausible outcome of the
 * koala trial (design-decision D-5), and this marking is what makes that revision
 * non-breaking in policy terms.
 */
export interface ActDeps {
  clock: Clock;
}

/**
 * Upstream's name for the same container. The ported acts ask for `DdActDeps`;
 * this package's own acts ask for `ActDeps`. Keeping both names is what lets the
 * ported act bodies stay byte-verbatim.
 *
 * @experimental See {@link ActDeps} — a koala-trial reshape is anticipated (D-5).
 */
export type DdActDeps = ActDeps;
