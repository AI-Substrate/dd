import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineExtension } from '@ai-substrate/engineering-harness/contract';

/** `just boot` = tsc emit, then the spawned-bin smoke test. The fast "does it run" lane. */
const LANE = 'just boot';
const LANE_TIMEOUT_MS = 600_000;

function tail(text: string, lines = 20): string {
  return text.trimEnd().split('\n').slice(-lines).join('\n');
}

export default defineExtension({
  name: 'boot',
  summary: `Prove dd compiles and its envelope contract holds (wraps \`${LANE}\`).`,
  verbs: {
    boot: {
      summary: `Prove dd compiles and its envelope contract holds (wraps \`${LANE}\`).`,
      async run(ctx) {
        // Dependencies absent is NOT a failing product — the lane simply cannot
        // run yet. Saying `unconfigured` (exit 2) with the exact fix beats a wall
        // of module-resolution errors that reads like the code is broken.
        if (!existsSync(join(ctx.cwd, 'node_modules'))) {
          return ctx.unconfigured(
            'Dependencies are not installed. Run `npm ci`, then re-run `harness boot`.',
            { data: { command: LANE, reason: 'node_modules missing' } },
          );
        }

        const result = await ctx.exec('just', ['boot'], { timeoutMs: LANE_TIMEOUT_MS });
        if (result.ok) {
          return ctx.ok({ command: LANE, stdout: tail(result.stdout) });
        }
        return ctx.error('E_BOOT_FAILED', `${LANE} failed (exit ${result.code})`, {
          details: { stdout: tail(result.stdout), stderr: tail(result.stderr) },
          next_action:
            'Read the failure above and fix it, then re-run `harness boot`. ' +
            'Reproduce a step with `just build` or `npx vitest run test/smoke.test.ts`.',
        });
      },
    },
  },
});
