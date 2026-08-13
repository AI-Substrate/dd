import type { Envelope } from './envelope.js';

/** The sink the kernel exits through. */
export interface OutputPort {
  emit(env: Envelope): void;
}

export type OutputMode = 'json' | 'human';

/**
 * Resolved per-invocation I/O, computed ONCE by the entrypoint and threaded to
 * acts. Acts must NOT re-derive the mode from `program.opts()` — commander
 * collapses `--json`/`--no-json` to a boolean and loses the "flag absent" state
 * that lets env/TTY decide.
 */
export interface CliIo {
  mode: OutputMode;
  writers: Writers;
  /**
   * Whether human-mode renderers may emit ANSI colour. Resolved ONCE by the
   * entrypoint (human mode + a TTY, minus NO_COLOR/FORCE_COLOR overrides), so no
   * act re-derives it; optional so test call sites that omit it get plain text.
   */
  useColor?: boolean;
}

/** Where rendered text goes. Injected so renderers are unit-testable. */
export interface Writers {
  out(text: string): void;
  err(text: string): void;
}

/** Default writers — the real process streams. */
export const processWriters: Writers = {
  out: (text) => {
    process.stdout.write(text);
  },
  err: (text) => {
    process.stderr.write(text);
  },
};

/**
 * Human-vs-JSON selection precedence (highest wins):
 *   1. explicit --json / --no-json flag
 *   2. DD_JSON=1 env (CI, where TTY detection is unreliable)
 *   3. TTY detection: piped (!isTty) => json, interactive => human
 */
export function selectMode(
  flags: { json?: boolean },
  env: NodeJS.ProcessEnv,
  isTty: boolean,
): OutputMode {
  if (flags.json === true) {
    return 'json';
  }
  if (flags.json === false) {
    return 'human';
  }
  if (env.DD_JSON === '1') {
    return 'json';
  }
  return isTty ? 'human' : 'json';
}

/** JSON renderer — one parseable line to stdout. */
export function renderJson(env: Envelope, writers: Writers = processWriters): void {
  writers.out(`${JSON.stringify(env)}\n`);
}

/**
 * Human renderer — diagnostics (here, the next_action) go to stderr; the final
 * one-line summary goes to stdout, so `ddocs … | …` pipes the summary.
 */
export function renderHuman(env: Envelope, writers: Writers = processWriters): void {
  if (env.next_action) {
    writers.err(`→ ${env.next_action}\n`);
  }
  writers.out(`${env.command}: ${env.status}\n`);
}

/** Build an OutputPort for a selected mode. */
export function createOutputPort(mode: OutputMode, writers: Writers = processWriters): OutputPort {
  return {
    emit(env: Envelope): void {
      if (mode === 'json') {
        renderJson(env, writers);
      } else {
        renderHuman(env, writers);
      }
    },
  };
}
