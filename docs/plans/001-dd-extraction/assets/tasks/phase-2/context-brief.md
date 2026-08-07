# Context brief — Phase 2: CLI acts + plumbing parity
**Plan**: `docs/plans/001-dd-extraction/plan.dd.json` · **Tasks**: `tasks.dd.json` (tk-0001…tk-0007) · authored 2026-08-07 while phase-1 review ran (pipelined)

## Executive briefing

**Purpose**: land dd-the-binary. Phase 1 delivered the SDK green; this phase gives it the
CLI: plumbing parity with upstream acts, the ten verbs registered honestly, postfix
`--json`, and the docs-generation pipeline. Exit condition the ledger enforces:
`dd status` → ok, exit 0, `ported[10]`.

✅ **Goals**: plumbing (style + 6 adapter families + jiti dep); 13 acts in three slices;
postfix `--json`; docs gen/check scripts; phase-2 test corpus green.
❌ **Non-goals**: exports freeze (phase 3, post-OQ rulings); pack gate (phase 3);
self-hosting (phase 4); ANY behaviour change beyond the --json wart.

## Rulings folded into this phase (o-prime, 2026-08-07 — from the PM's phase-1 report)

1. **Docs-drift scope gap → OWNED HERE (tk-0006)**: `scripts/gen-dd-docs.mjs` +
   `check-dd-docs.mjs` port in this phase; `dd-docs-drift.test.ts` joins the corpus.
   Until tk-0006 lands, editing `src/docs/content/*.md` drifts silently — don't.
2. **Audit numbers govern**: stay=11 / port=49 (the plan's ~9/~51 were estimates; the
   committed audit table is the artifact). `plan/ready.test.ts` (imports
   `services/flow/chores-read`) and `dd-native-dryrun.int.test.ts` (imports
   `services/telemetry`) STAY upstream; ready.test.ts is additionally noted against OQ-2.
3. **biome override accepted**: `noUnsafeOptionalChaining` off for ported test dirs only,
   verbatim-upstream preservation beats editing assertions. It must NEVER widen to
   `src/**` — tk-0007's done_when checks the diff.

## Order & dependencies

tk-0001 (plumbing) → tk-0002/0003/0004 (verb slices — **serial through `src/app.ts`**,
the registry hot-spot; each slice lands its registrations in its own commit) →
tk-0005 (--json, needs all verbs present to parameterize) · tk-0006 (docs pipeline,
independent after tk-0002's docs act) · tk-0007 (corpus, last).

## Key constraints

- **Ledger honesty is per-commit**: a verb registers only in the commit where it works —
  `dd status` must never overstate mid-phase (ac-0003's history clause).
- Envelope seam: every act exits through `exitWithEnvelope`; the coverage map binds
  ac-0004 to envelope tests, ac-0005 to postfix tests (post-review fix — don't re-cross).
- jiti lands in tk-0001 but is only PROVEN in tk-0004's custom-type load test.
- Upstream is READ-ONLY; basis SHA `d08f4942` (phase-1 recorded); the same SHA governs
  this phase's copies — a drifted upstream is a deliberate rebase, never silent.

## State mutation contract

Same as phase 1: `harness dd set "…/phase-2/tasks.dd.json#tasks/tk-XXXX/state" checked`
+ per-assertion `#done_when/...`; siblings are generated; gate rehearsal via
`harness plan validate … --address ".../phase-2/tasks.dd.json#tasks"`.

**Environment-first posture** (invariant #14): observe friction as it bites.
