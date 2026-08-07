import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Resolve from THIS file's location, not cwd — the suite must read true from any
// invocation directory. This test lives at test/architecture/.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SEMANTICS = join(REPO_ROOT, 'src', 'plan', 'semantics.ts');

/**
 * The SHA-256 of the PORTED `semantics.ts`.
 *
 * RE-PINNED for this repo (plan 001, tk-0001). Upstream
 * (harness-engineering `harness/cli/test/architecture/dd-plan-semantics-frozen.test.ts`,
 * basis d08f4942d28b7e5181d5845a56a63b0cbb1d3402) pinned
 * `3856153824f7fd3448aaf285197054a2f4a2524ed80c0fffe6dc9a3f8526f150` against
 * `src/services/dd/plan/semantics.ts`. The port is byte-verbatim, so this digest
 * MUST equal that one — if it ever differs, the copy was not verbatim and that is
 * the defect, not the pin.
 *
 * Changing this constant is how you change that file — deliberately, in a diff a
 * reviewer sees, with the reason in the commit. That is the entire mechanism: the
 * pin does not forbid the edit, it forbids the SILENT edit.
 */
const FROZEN_DIGEST = '3856153824f7fd3448aaf285197054a2f4a2524ed80c0fffe6dc9a3f8526f150';

/**
 * AC-09 (upstream plan 072) — `semantics.ts` is byte-unchanged by the readiness gate.
 *
 * The backpressure survey recorded finding 03's mitigation as "checkable by
 * diff", and nothing actually checked it. A mitigation nobody runs is a promise,
 * and the specific promise here matters: `CLAIMING_RELS` excludes `pressure` on
 * stated grounds — a backpressure row has no state to contradict and gates
 * nothing, so treating a missing instrument link as a claim failure would
 * re-invent the coverage predicate the design explicitly threw away.
 *
 * The readiness gate is a CONSUMER of that decision. It composes
 * `readPlanSemantics` and gates on the survey CHORE, never on per-criterion
 * pressure links. The failure this guard exists to catch is the quiet one: a
 * future change that "just adds one more finding class" to make readiness easier
 * to compute, and reverses a written architectural decision as a side effect
 * while every test still passes.
 *
 * A digest is used rather than a behavioural assertion on purpose. Behaviour
 * tests can only catch the semantics somebody thought to test; the decision being
 * protected is about what the file is ALLOWED to become, and only the bytes carry
 * that.
 *
 * OQ-2 CAVEAT (plan 001): whether `src/plan` ships in the public SDK surface, stays
 * internal, or returns harness-side is UNRULED. This pin travels with the code
 * either way — it protects the bytes, not the packaging — but an OQ-2 ruling that
 * moves or re-homes `plan/` may legitimately re-rule this guard. Until then it
 * holds here, and `./plan` is absent from the public exports map (tk-0005).
 */
describe('architecture — dd/plan semantics is frozen (upstream plan 072, AC-09)', () => {
  it('has not changed since the readiness gate composed it', () => {
    const digest = createHash('sha256').update(readFileSync(SEMANTICS)).digest('hex');

    expect(digest).toBe(FROZEN_DIGEST);
  });

  it('still carries the written rationale for excluding `pressure` from the claiming relations', () => {
    // The digest above would also fire on a whitespace change, which tells a
    // reader nothing about WHY the file is pinned. This second assertion names
    // the decision, so a failure points at the argument rather than at a hash.
    const source = readFileSync(SEMANTICS, 'utf8');

    expect(source).toContain(
      "const CLAIMING_RELS = new Set(['proven_by', 'satisfies', 'derives'])",
    );
    expect(source).toContain('`pressure` is deliberately absent');
    expect(source).toContain(
      're-invent the\n * coverage predicate the design explicitly threw away',
    );
  });
});
