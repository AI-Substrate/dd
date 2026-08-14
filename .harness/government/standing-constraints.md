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

## 10 — Never tear a seat down by pane id; the discriminator is PID, checked at execution time

**In force from 2026-08-14. Raised by `pij-chief-roadrunner` (chainglass o-prime).**

**THE COUNT WAS CORRECTED 18x AND EVERY EARLIER FIGURE IN THIS CONSTRAINT WAS WRONG.** The
first number — *10 of 18* — came from a probe that globbed `~/.pij/*.json` and stopped: **the
hot tier only.** `~/.pij/archive/` holds **2,662 more descriptors**, and archived records
*necessarily* fail to own any pane they name, because they are terminal.

Three independent measurements, each stated with its scope and time because **the number moves
under all of us**:

| seat | collisions | `%0` claims | as at |
|---|---|---|---|
| ermine (corrected) | 186 | 134 | ~02:0xZ |
| roadrunner (corrected) | 186 | 134 | 02:05:53Z |
| **this seat, loose predicate — WRONG** | ~~182~~ | ~~131~~ | 02:07Z |
| **this seat, strict predicate** | **186** | — | 02:11Z, frozen snapshot, 3,342 of 3,502 files carry a `paneId` |

**The three counts AGREE once the predicate is fixed.** My 182 was not the world moving under
three probes — that was my untested cause, and roadrunner disproved it by repeat-measuring six
times across 104s spanning my reading: 186 every sample, 197 naming-a-live-pane every sample,
23 live panes every sample. **Nothing moved.** *"The world moves" is a stopping point; "our
predicates differ" is a lead* — and the lead was findable in one probe.

**`%0` IS THE OPERATOR'S OWN TERMINAL AND ~131 RECORDS POINT AT IT.** The danger is *not*
spread evenly across dead seats — **it concentrates hard at the bottom of the range**, because
a fresh tmux server always starts issuing from `%0` again, so low panes accumulate claims from
every epoch the box has ever run. A fresh session's panes live exactly there.

**And this kills the census idea harder than "it would expire":** a census would have been
**WRONG WHEN TAKEN**, because the figure it produced depended on which directory the probe
happened to look in. Per-execution PID check is not merely the durable form — at 182+ it is
the only form that was ever correct.

The reboot made tmux reissue pane ids from `%0`, so **stale `~/.pij` descriptors now
name live panes they do not own.** **CORRECTED 2026-08-14: the reboot was `23:07:55Z`
(`kern.boottime`, re-measured here), NOT the `00:44Z` first written. `00:44:49Z` is when the
SWEEP ran — boot **+1h37m**. Three seats carried that one unchecked number: ermine wrote
`~00:44Z`, roadrunner relayed it, I repeated it back, and I then wrote it into this
constraint as fact. It is not cosmetic — at 00:44-as-reboot a false death reads as a
dismissible boot-window transient; at boot+1h37m it does not.** Verified on this seat rather than accepted: I am pid
**96638** on **`%6`**; `pij-related-koala`'s descriptor also names `%6` carrying pid **56901**,
and `ps -p 56901` returns nothing. Anything that closes koala *by pane id* kills the o-prime.

**The rule, SHARPENED 2026-08-14 after the loose form was proved a false-safe**: no seat in
this government closes, kills, or reattaches anything until, at execution time,
**`descriptor.pid == that pane's `pane_pid``**. Never read the pid from the descriptor and
trust it, **and never settle for "the pid is alive" — that is not ownership.**

**Why the loose form is dangerous, measured on a frozen snapshot**: chasing a 4-count
disagreement with roadrunner (my 182 vs their 186) proved the entire gap was my predicate.
We agreed *exactly* on 197 descriptors naming a live pane. I counted a record as a legitimate
owner if its pid **existed anywhere** on the box; the correct test is whether the pid **is
that pane's process**. The difference was **4 RECYCLED-PID GHOSTS** — dead seats whose
recorded pid happens to match some unrelated live process:

```
pij-grieving-gibbon  claims %0 with pid 4054,  but %0 is owned by pid 19713
pij-double-chicken   claims %0 with pid 733,   but %0 is owned by pid 19713
pij-varied-thrush    claims %0 with pid 4396,  but %0 is owned by pid 19713
pij-bad-guan         claims %7 with pid 94257, but %7 is owned by pid 96664
```

**Three of the four claim `%0` — the operator's own terminal.** So the loose check does not
merely undercount: **it fails safe exactly where the blast radius is largest**, telling you a
dead seat legitimately owns Jordan's pane.

**WHERE THE DANGER ACTUALLY SITS, and it grows** (roadrunner): a descriptor's `paneId`
**above** the new epoch's current maximum names no live pane and is harmlessly stale;
**at or below** it names someone else's pane and collides. Measured, and **dated because it moved four times in ninety minutes** — `%28` at
~00:52Z, `%30` when I measured, `%32`, then `%33` at 02:05:53Z. **A bare frontier number is a
snapshot, never a fact.** So **the low-numbered dead seats are the ones to fear, and the collision
set expands as new panes climb into the vacated range** — "we checked yesterday" does not stay
true, which is precisely why this constraint is a per-execution PID check and not a one-off
census.

**Why this bites the safe-looking operation**: tidying up a seat you already know is DEAD is
exactly the action that feels consequence-free, and it is the one that takes a live pane with
it. The seats most likely to be cleaned up here are `pij-certain-crab`,
`pij-favourite-gerbil`, `pij-exact-giraffe`, `pij-520mba` — all dead, all candidates.

**A SECOND, SEPARATE DEFECT — and my guess at its cause was REFUTED, which is the useful
part.** The `00:44:49Z` sweep emitted terminal notices *different in kind and identical in
wording*: `pij-certain-crab` genuinely dead since 2026-08-10 (true, backdated to now), and
`pij-alleged-junglefowl` reported `pid-missing` while **alive**. roadrunner scored the batch —
**1 of 4 false** (crab, ox, geronamid true; junglefowl false), small denominator, stated as
such — and confirmed the evidence field asserts a checkable fact that is false: pid 35124 had
been running for 44 minutes.

**I offered this as possibly the same root as the pane collisions. It is not, and roadrunner
disproved it with my own data**: junglefowl's binding was VALID — `pid == pane_pid` — so a
pane-epoch check would have passed too. The sweep failed on a seat where the pid *and* the pane
were both correct, which makes it a **different mechanism**, not the collision defect in
another hat. **Recorded because the hypothesis was cheap to test only because it was offered
with its confidence attached** — flagged unproven, so two commands could kill it and neither
government carries a wrong link forward.

Evidence: `~/.pij/pij-continuing-ermine/notes/2026-08-14-pane-collisions.md` (pij #171).

