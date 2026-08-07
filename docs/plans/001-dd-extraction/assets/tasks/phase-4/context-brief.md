# Context brief — Phase 4: Self-hosting + handover
**Plan**: `docs/plans/001-dd-extraction/plan.dd.json` · **Tasks**: `tasks.dd.json` (tk-0001…tk-0006) · authored 2026-08-07 at the phase-3 review signal, WITH THE LOCAL BIN (the authoring of this phase is itself self-hosting evidence)

## Executive briefing
**Purpose**: proof by consumption, then handover. The port is done when this repo runs on
its own tool, the latent CI assertions match reality, koala holds the packet, and the
first push comes back green.

## Order
tk-0001 CI fix (independent, first — it guards tk-0006) → tk-0003 self-host CI step →
tk-0004 backlog ∥ tk-0005 packet → tk-0002 freeze (HELD on Jordan, inherits P3 tk-0002)
→ tk-0006 push + green (LAST — everything proves itself here).

## Rulings binding this phase
1. **Renderer authority split + correction rows** (plan `#execution_guardrails`, incl.
   the superseding correction): local bin owns writes + drift; harness owns semantics.
2. **Out-of-diff sweep** is now a standing guardrail — tk-0001 applies it to CI itself.
3. **Exemplar corpus NOT ported** (esc-4 ruling): dd-overview's pointing paragraph is
   amended in the P3 fix-loop, corpus stays upstream (dd-next #10 contested-value
   hazard — porting would propagate a value Jordan hasn't ruled). The backlog row
   (tk-0004) carries the revisit.
4. **Push authorization**: Jordan 2026-08-07 — CI green on main IS the end state; no PR,
   no tags, no publish. tk-0006 is the one and only push.

## Watch-outs
- 34+ unpushed commits meet CI for the first time at tk-0006 — expect surprises beyond
  the one latent defect already found; fix-forward, record each in the execution log.
- tk-0002 held ≠ phase blocked: five of six tasks are ruling-independent.
- Handover ≠ done-done: koala's integrate-and-strip is explicitly out of scope.

**Environment-first posture** (invariant #14): observe friction as it bites.
