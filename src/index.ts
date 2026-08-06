#!/usr/bin/env node
import { main } from './app.js';

// Pipe-friendly raw output can have stdout closed by the reader before we finish
// writing, which Node surfaces as EPIPE. Treat a broken pipe as a normal early
// close (not a failure); re-surface any other stream error unchanged. Uses
// process.exitCode (never process.exit) so the single-exit architecture holds.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') {
    process.exitCode = 0;
    return;
  }
  throw err;
});

// Thin bin entry — always runs. All composition lives in app.ts (testable, never
// auto-runs). main() routes every expected failure through the exit kernel; this
// .catch() is a CATASTROPHIC-only net so the async bin can never float an
// unhandled rejection that would bypass the kernel and the Envelope contract.
main().catch((err: unknown) => {
  process.exitCode = 1;
  process.stderr.write(
    `dd: unexpected error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
});
