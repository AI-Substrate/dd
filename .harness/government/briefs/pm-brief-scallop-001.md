# PM brief — plan 001 dd-extraction
**To**: `pij-particular-scallop` (PM) · **From**: `pij-mental-dajeil` (o-prime, dd) · 2026-08-07
**Reply**: `pij send pij-mental-dajeil` — append this line to every send.

## The work

Implement plan 001, one phase at a time, with your standing coding-pair config (your
2026-08-07 relay — not restated here). Canonical documents:

- Plan (READY, validated, sol-reviewed): `docs/plans/001-dd-extraction/plan.dd.json` — read the rendered `plan.dd.md`
- Phase 1 tasks: `docs/plans/001-dd-extraction/assets/tasks/phase-1/tasks.dd.json` (tk-0001…tk-0006) + `context-brief.md` (order, guardrails, state-mutation contract)
- Evidence base: `assets/research-dossier.md`

## Operating model (Jordan's ruling, on the plan node)

1. I author phase-N tasks → you implement with your coder (peers use `/builder 6 implement`).
2. **The moment you dispatch your reviewer, tell me "going to review: phase N"** — that message is what lets me pipeline phase N+1 tasks. Do not wait for the verdict to say it.
3. Review verdict clean → tell me; I hand you the next phase. Findings → your fix loop, then re-review.
4. Repeat to completion. End state: **CI green on main, no PR** (push authorized by Jordan 2026-08-07).

## Hard constraints (full list: plan `#execution_guardrails` — binding on your whole subtree)

- harness-engineering checkout is **READ-ONLY** — copy from it, never build/write there.
- No npm publish / tags / releases. Conventional commits (release-please reads them).
- Flow files (`the-flow.json`/`.md`) are engine-owned; task state moves ONLY via `harness dd set … state checked` (contract in the context brief). The `.dd.md` siblings are generated.
- `dd status` ledger honesty: a verb registers only in the commit where it actually works. Phase 1 registers **nothing**.
- `src/app.ts` is the registry convergence hot-spot — serialize edits there if you ever have two things in flight.
- Canary every peer you spawn (`pij canary <id> --expect-model <m>`) before trusting it. **Known friction: sol-model copilot spawns here can hang at boot on "waiting on mcp" — if bind-limbo >2min, keystroke-inject the first turn or respawn** (it cost me two spawns today).

## Reporting

`pij report now` at start and end of each unit (both edges). Your peers' stale cards are
your chase list. Escalate to me on: a boundary conflict with the upstream architecture
tests (KF-5), any need to touch a guardrail, or a gate refusing for a reason the context
brief does not explain. Work-local questions that only Jordan can answer: ask him
directly (pij telegram), send me the pointer.

## GO signal

This brief is live the moment I send you its path. Phase 1 starts on your ack.
