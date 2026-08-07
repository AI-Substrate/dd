# Standing constraints — dd repo

**Authority**: `pij-related-koala`'s mission brief to the o-prime (Jordan's words,
relayed), plus Jordan's own rulings in this repo. **Binding on every seat in the dd
subtree**, including seats that never saw the original brief.

**Why this file exists.** These constraints lived only in the o-prime's context. On
2026-08-07 the PM escalated ESC-1 (a permanently-red Release workflow) as a *policy
question needing a new decision* — when constraint 4 below had already ruled it. The
PM escalated correctly and diagnosed it wrongly, because it could not have known. It
named the gap itself: *"I do not hold koala's brief, so for anything touching koala or
release I should ask you rather than characterise."* Asking every time is discipline;
this file is the mechanical fix. **A constraint that lives in one agent's head is a
single point of failure** — and the o-prime is not reliably that agent, having already
had to be corrected against measurement once this phase.

Cite these by number. If a decision looks new, **check here first** — it may already be
ruled, in which case the work is *meeting an existing constraint*, not choosing a policy.

---

## 1 — harness-engineering is READ-ONLY reference

Never write it, never build or install there. Copy out of it only. The port basis SHA
is recorded in phase 1 and is rebased deliberately, never silently.

## 2 — No publish, no tags, no releases from agents

Jordan publishes. No `npm publish`. No `--provenance` experiments. Local commits only.
**Superseded for landing only** by Jordan's ruling of 2026-08-07: pushing `main` and
driving CI to green *is* authorized, and no PR is required. That ruling settles
**whether** we push — not the sequence, and not anything about releasing.

## 3 — Flow files are engine-owned and a forbidden path

`.the-flow-state.json`, `the-flow.json`, `the-flow.md` — never read or written by hand,
in either repo. builder guided mode is their sole writer. **Reading them is forbidden
too, not merely writing**: see guardrail "AUTHORITY IS A SHA, NEVER A WORKING TREE" for
the near-miss that proves why.

## 4 — Release workflows sit INERT until Jordan enables release

Verbatim from the brief: *"Release enablement (RELEASE_PLEASE_TOKEN + npm trusted
publisher) is Jordan's; the workflows sit inert until then."*

**"Fails closed" is not "inert."** A workflow that fires on push and goes red is not
inert — it is a false-alarm generator inherited by every future contributor, and by
koala. Gating such a workflow is *compliance with this constraint*, not a new policy
decision. (Applied 2026-08-07 as the ESC-1 ruling; see the phase-4 flow node.)

## 5 — The consume step is koala's, not ours

Handover completes when the SDK surface is stable and the packet is sent. Upgrading
harness-engineering to consume `@ai-substrate/dd` and stripping the old code is
**koala's work**. Never start it.

## 6 — Handover traffic is prime-to-prime

`pij-related-koala` is a peer prime. The PM prepares the handover packet; the **o-prime
sends it**. A worker messaging another fleet is the wrong altitude, and an unreviewed
packet makes our defects their problem.

## 7 — Human rulings are transcribed verbatim before anyone acts

Whoever receives a ruling from Jordan writes it verbatim into the durable artifact and
sends the other party the pointer **before** acting on it. Do not paraphrase a ruling
into an implementation.

## 8 — Open questions block only what depends on them

OQ-1 (SDK-as-library vs CLI-shelled) and OQ-2 (does `plan/` ship public) gate the
exports freeze — phase-4 `tk-0002` — and **nothing else**. Do not guess them, and do not
let them stall independent work.
