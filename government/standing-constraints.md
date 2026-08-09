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

## 6 — Handover traffic is prime-to-prime — AMENDED 2026-08-09, trial channel opened

`pij-related-koala` is a peer prime. The PM prepares the handover packet; the **o-prime
sends it**. A worker messaging another fleet is the wrong altitude, and an unreviewed
packet makes our defects their problem.

**AMENDED by Jordan, 2026-08-09, verbatim — given in the PM's pane, answering its
"have you told it?" about the measured install route:**

> "go direct, i allow it"

**WIDENED WITHIN THE HOUR — Jordan again, verbatim, relayed via koala:**

> "you may comms direct with crab btw throughout your work to iterate on the SDK. i can
> make fixes rapidly. we will source sdk from its branch to get this done fast."

**So the exception is STANDING FOR THE DURATION OF KOALA'S PLAN 080**, not the one-off
exchange the first ruling covered. The o-prime's narrow reading of the first ruling was
correct when written and was overtaken by the second within the hour; **the shape holds and
only the duration changed.**

**Scope now in force**: **PM↔koala SDK-iteration traffic is DIRECT** for the duration of
koala plan 080 — install routes, surface measurements, re-pin coordination, defect reports
and fixes. **Handover packets and anything at prime altitude remain the o-prime's.** It is
**not** a general collapse of prime-to-prime routing.

**AND THE RULING CARRIES A DISTRIBUTION DECISION, which is easy to miss inside a comms
permission**: *"we will source sdk from its branch to get this done fast."* Harness consumes
dd **from the branch**, by SHA-pinned `github:` install, **for this period** — so cutting the
first npm release is **NOT a blocker for koala's work** and should be decided on its own
merits, not as an unblocking step. `wl-0014`, backlog 24 and `wl-0015` all describe install
routes; this ruling says which one is in use meanwhile.

**Why this is written down within the minute**: the PM went direct and told the o-prime
inside the same minute so the change would not be discovered as a breach. A constraint
contradicted by an unrecorded ruling is the surface-versus-wire gap this repo hit four
times on 2026-08-09 alone — the artifact must say which reading is in force, or the next
reader inherits the old rule and treats correct behaviour as a violation.

## 7 — Human rulings are transcribed verbatim before anyone acts

Whoever receives a ruling from Jordan writes it verbatim into the durable artifact and
sends the other party the pointer **before** acting on it. Do not paraphrase a ruling
into an implementation.

## 8 — Open questions block only what depends on them

OQ-1 (SDK-as-library vs CLI-shelled) and OQ-2 (does `plan/` ship public) gate the
exports freeze — phase-4 `tk-0002` — and **nothing else**. Do not guess them, and do not
let them stall independent work.


## 9 — OQ-2 is HELD pending koala's trial verdict on primitive sufficiency

**Ruled by Jordan, 2026-08-09**, verbatim. Asked: *"Do you want `plan/` stripped for good now that
harness re-implements on the primitives, or held open until koala's trial says whether the
primitives are sufficient?"* — Jordan: **"held please"**.

**Settles**: `./plan` stays forbidden in the exports map and `src/plan` is **not** stripped. The
question does not close on our judgement — it closes when **`pij-related-koala`'s trial reports
whether the public primitives are sufficient** to re-implement plan semantics.

**Consequences, not inferred beyond the ruling**:
- `acts/plan/index.ts` and `acts/plan/pr-body.ts` remain **untrialable** until then. That is the
  design working, not a blocker to route around.
- **Nobody strips `src/plan`**, and `wl-0011` (it is dead code in our fork) stays deferred — the
  same trial informs both.
- Plan 002 can be complete with OQ-2 open. Its exit was *PR up and CI green*, which is met; OQ-2
  was never in that exit condition.

**Who closes it**: koala, by reporting sufficiency or a gap. Routing is now **direct PM↔koala**
for the duration of plan 080 — see §6 as amended; that supersedes the prime-to-prime line here.

### R-4a — what an INSUFFICIENCY verdict actually means (Jordan, plan-080 workshop D-3)

**Relayed via koala, verbatim:**

> "this is dogfooding and we will make sure dd is what it needs to be for folks to use it welll"

**Settles the branch this constraint left open.** If round 3 finds the primitives **insufficient**,
**dd exports the missing primitives** and koala's plan-semantics phase **waits on our cycle**.
Harness keeps **no fork and no private copies**.

**Two consequences that change how this seat should read a verdict:**

1. **An insufficiency verdict is INBOUND WORK FOR THIS REPO, not a deferral.** The hold on OQ-2 is
   not a way of parking the question — either verdict produces work here, and the insufficient
   branch produces *more*. Nobody should read "held" as "quiet".
2. **It makes the branch-sourced consume route LOAD-BEARING rather than convenient.** koala waiting
   on our cycle only works if it can consume our fixes as we ship them, which today means the
   SHA-pinned `github:` install off `s002/sdk-build` (§6's distribution note). A merge or release
   decision that disrupts that route now has a dependency it did not have this morning.
