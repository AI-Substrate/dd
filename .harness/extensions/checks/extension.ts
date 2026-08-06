import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineExtension } from '@ai-substrate/engineering-harness/contract';

/** `just checks` = biome + tsc emit + typecheck + vitest. The full quality gate. */
const LANE = 'just checks';
const LANE_TIMEOUT_MS = 900_000;

function tail(text: string, lines = 30): string {
  return text.trimEnd().split('\n').slice(-lines).join('\n');
}

export default defineExtension({
  name: 'checks',
  summary: `The quality gate — lint, build, typecheck, test (wraps \`${LANE}\`).`,
  verbs: {
    checks: {
      summary: `The quality gate — lint, build, typecheck, test (wraps \`${LANE}\`).`,
      async run(ctx) {
        // Dependencies absent is NOT a failing gate — it never ran. Say so
        // honestly (exit 2) with the exact fix, rather than reporting a failure
        // that reads like the code is broken.
        if (!existsSync(join(ctx.cwd, 'node_modules'))) {
          return ctx.unconfigured(
            'Dependencies are not installed. Run `npm ci`, then re-run `harness checks`.',
            { data: { command: LANE, reason: 'node_modules missing' } },
          );
        }

        const result = await ctx.exec('just', ['checks'], { timeoutMs: LANE_TIMEOUT_MS });
        if (result.ok) {
          return ctx.ok({
            command: LANE,
            gates: ['lint', 'build', 'typecheck', 'test'],
            stdout: tail(result.stdout),
          });
        }
        return ctx.error('E_CHECKS_FAILED', `${LANE} failed (exit ${result.code})`, {
          details: { stdout: tail(result.stdout), stderr: tail(result.stderr) },
          next_action:
            'Fix the failing gate above, then re-run `harness checks`. Reproduce one gate at a ' +
            'time with `just lint`, `just build`, `just typecheck`, or `just test`; ' +
            '`just fix` applies biome’s safe fixes automatically.',
        });
      },
    },
  },
});
