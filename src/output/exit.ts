import type { Envelope, Status } from './envelope.js';
import type { OutputPort, Writers } from './output-port.js';

/** Status → exit code (authoritative). */
const EXIT_BY_STATUS: Record<Status, number> = {
  ok: 0,
  degraded: 0,
  unconfigured: 2,
  error: 1,
};

export function exitCodeFor(env: Envelope): number {
  return EXIT_BY_STATUS[env.status];
}

/**
 * Make the process streams BLOCKING before the final write.
 *
 * `process.exit()` terminates without draining pending stream writes, and on a
 * PIPE Node's stdout is asynchronous — so the envelope could be queued and then
 * discarded by the exit that follows it. Measured on this repo's own output:
 * `dd --json graph` emits 34,316 bytes and a piped consumer received only 8,192
 * or 16,384 of them on Node 22, every single run. Node 24 tolerated that payload
 * and truncated above ~60,000 instead, which is why the loss showed up as a
 * one-platform mystery rather than an obvious bug. Both are lossy; 22 is simply
 * lossier, and 22 is this package's `engines` floor.
 *
 * Blocking streams make the write complete before it returns, so there is
 * nothing left to drain and `process.exit` cannot race it. This is what Node
 * already does for TTYs and regular files — pipes are the exception, and this
 * puts them on the same footing.
 *
 * WHY NOT the `emitRawAndExit` treatment (set `process.exitCode` and return)?
 * Because it is not equivalent here. `exitWithEnvelope` is declared `never` and
 * 43 of its 59 call sites rely on that: they emit a terminal envelope as a bare
 * statement and let the guarantee of not-returning stop the act. Measured, with
 * the returning version built: `dd address validate` emitted TWO envelopes — an
 * `ok` one and then an `error` one — and `dd <unknown-verb>` printed its error
 * envelope followed by an unhandled `dd: unexpected error:` line. `tsc` catches
 * 34 of those sites; the rest compile clean and break the one-envelope contract
 * silently. Draining by returning is the right architecture, but it is a
 * 59-call-site change across `src/acts/**` and `src/app.ts`, not a change to
 * this file.
 *
 * Guarded rather than assumed: `_handle` is internal, so if it or `setBlocking`
 * ever disappears this quietly does nothing — and the regression test in
 * `test/acts/envelope-flush.test.ts` reds the moment that silence costs bytes.
 */
function makeOutputBlocking(): void {
  for (const stream of [process.stdout, process.stderr]) {
    const handle = (stream as unknown as { _handle?: { setBlocking?(on: boolean): void } })._handle;
    handle?.setBlocking?.(true);
  }
}

/** Single exit point for the whole CLI — only the kernel calls process.exit. */
export function exitWithEnvelope(env: Envelope, io: OutputPort): never {
  makeOutputBlocking();
  io.emit(env);
  process.exit(exitCodeFor(env));
}

/**
 * Verbatim passthrough exit: write raw text to stdout and let the process exit
 * NATURALLY with `code` (0 by default) — set `process.exitCode` and return, never
 * `process.exit`. A large raw payload (e.g. `dd docs get <id>`) piped or
 * redirected must not be truncated by an early `process.exit` that races the
 * stdout flush; a natural return lets Node drain stdout first (companion F002).
 * Envelope-bearing commands still use `exitWithEnvelope`.
 */
export function emitRawAndExit(text: string, writers: Writers, code = 0): void {
  writers.out(text);
  process.exitCode = code;
}
