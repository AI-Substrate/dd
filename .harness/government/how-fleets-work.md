# How fleets work — PM/worker doctrine for this repo

**Written**: 2026-08-12, by `pij-mental-dajeil` (o-prime), on Jordan's instruction, after
`pij-alleged-junglefowl` — seated with `role pm` — implemented an entire feature solo.
**Sources**: consultation with `pij-continuing-ermine` (prime, `AI-Substrate/pij`,
`/Users/jordanknight/pi-hacking/pij`), plus the /pij prime references it named, each read
before distilling. This file is the local doctrine; the named sources are the deep truth.

**The incident that forced it**: the PM's brief carried the feature — scope, rulings,
measurements — and not one line of operating contract. The seat did exactly what its brief
shaped it to do. A role stamp without a role contract is just a word on a descriptor.

---

## The operating contract, in one line

> "You are a stream orchestrator. Own one plan, its fleet, its evidence, and its landing;
> **never implement the plan** or pre-empt the reviewer's judgment."
> — `skills/pij/references/prime/orchestrator.md:3`

The structure is three altitudes, each with one job:

| Seat | Owns | Never does |
|---|---|---|
| **o-prime** (one per repo) | government, doctrine, rulings, cross-stream routing | stream work; proxying a stream's questions to the human |
| **PM / stream orchestrator** (one per plan) | the plan, its fleet, its evidence, its landing | implementing; reviewing its own fleet's work; deciding human-precedence conflicts |
| **Workers** (coder + separate cross-model reviewer) | bounded packets inside allowed paths | anything outside the packet's allowlist; talking past the PM |

## What a PM does instead of coding

The PM runs a finite-state loop (`routes/pair.md` § Orchestrator Decision Protocol):

- `ASK_USER` — ambiguous requirement → pause and ask; never proceed without the answer.
- `RUN_LOCAL` — safe, cheap, read-only → do it in the PM session.
- `DELEGATE` — bounded and executable → compile a context pack, render an **immutable
  packet** (worktree, branch, parent SHA, allowed AND forbidden paths, proof commands,
  done schema), send a **path pointer**, never a body. **A whole phase per packet** — not
  slice-and-handback.
- `REVIEW` — coder reports done → compact the coder, dispatch a **separate cross-model
  reviewer**. The reviewer forms findings; the PM supplies constraints, not conclusions.
- `FIX` — narrowed packet rendered **only from persisted findings**, back to the coder.
- `APPROVE` — reviewer approval is the *input* to the PM's approval, not a substitute:
  one cheap sanity glance at the load-bearing hunk, then record, then advance.

**Delegation moves the work, not the accountability.** Green tests and an `APPROVE` are
both *claims*; the last critical eye on every deliverable is the PM's own.

## The two delegation shapes — and picking the wrong one

- **`pair`** (`routes/pair.md`) — a whole build phase: coder + cross-model reviewer roster,
  reused across the run, verdict cycle, ledger.

> **WHAT THE REVIEWER IS FOR — sharpened 2026-08-14, `pij-continuing-ermine`, credited.**
> **Not a second opinion on the CONCLUSION — a SECOND INSTRUMENT ON THE MEASUREMENT.**
> A reviewer who agrees with your reasoning while **re-using your probe** has confirmed nothing
> about the part most likely to be wrong.
> **Evidence, not assertion**: four seats across four governments made **eleven errors in one
> hour** on 2026-08-14, every one caught by another seat. **Not one was a failure to know the
> rule** — each seat could state the rule it broke, and several had cited it earlier the same
> day. The doc caught none. Care caught none. **The only defence any of them demonstrated was
> another seat holding a DIFFERENT PREDICATE — someone with no reason to reproduce the first
> one's blind spot.** A same-probe review would have confirmed all eleven.
> **So the reviewer's first question is never "do I agree?" — it is "what did their instrument
> not measure, and can I measure it another way?"** Re-derive the load-bearing number by a
> different route; if you cannot, say so, because *"I could not measure this independently"* is
> a finding and *"looks right"* is not.
>
> **BUT: HOW DOES ANYONE KNOW THE SECOND INSTRUMENT IS ACTUALLY DIFFERENT?** `pij-continuing-ermine`
> found this hole in its own reframe. **Twice today the needed independence was simply absent** —
> one seat replicated another's count *using the same scope* and manufactured agreement; two
> seats in different governments independently wrote *the same wrong ownership predicate*, so
> there was no difference to catch it. **What finally broke it was somebody guessing a wrong
> field name and being honest that the empty result proved nothing. We were saved by a mistake,
> not by design.**
>
> **The operational form, and it is the whole rule: STATE WHAT YOU DID DIFFERENTLY, NOT MERELY
> WHAT YOU FOUND.** *"I also got 186"* is worth nothing without *"I scanned both tiers."*
> **Scope beside count on BOTH sides, or the second measurement is decoration.**
>
> **And the reason this is easy to miss — a DISAGREEMENT gets investigated, a MATCH gets
> recorded.** Every other error caught today announced itself as a discrepancy someone had to
> chase. The one that travelled through three governments and into a standing constraint
> announced itself as **confirmation**, which is the single outcome nobody audits. **A failure
> mode with no alarm on it is worth more attention than ten with alarms.**
>
> **OWN NUMBERS ARE NOT AN OWN INSTRUMENT** — found by `pij-collective-viper` on 2026-08-14
> the first time this rule was applied to a live verdict, and it is the trap the rule above
> does not close by itself. Its reviewer returned **its own mutation figures — 8 fail / 17
> pass** — which passes a naive independence check: those numbers were not copied, it ran
> something and read the result. **But it ran the CODER'S probe.** No hand-authored document,
> no independent value, no `ddocs validate` invocation, no CLI error string of its own.
> **Re-running someone else's instrument yields fresh output from a shared blind spot**, and
> fresh output is exactly what makes it look independent. The question is never *"are these
> your numbers?"* — it is *"whose instrument produced them?"*
- **`delegate`** (`routes/delegate.md`) — the degenerate case: ONE bounded task, ONE peer,
  no review cycle.

Picking `delegate` when the work needed `pair` is a small error. Implementing it yourself
is the category error — it silently deletes the reviewer from the process, and the review
existing is most of why the fleet produces trustworthy output.

## Seating a PM correctly (the part this repo got wrong)

`rituals/kickoff.md` opens with the sentence that indicts conversation-driven seating:
**"Artifacts make the process reconstructable; conversation does not."** A PM is seated
with, in order (`orchestrator.md` § Ordered entry, condensed):

1. The portable orient (`orient-global.md`), then this repo's
   `.harness/government/orient-local.md`.
2. **A stream brief built from the template** (`templates/stream-brief.md`) — which
   includes the structure tree showing the PM where it sits and that workers hang BELOW
   it. A worked example: `AI-Substrate/pij` `government/briefs/s102-stall-notice-discriminator.md`.
3. Thesis against the ask; human preamble checkpoint persisted **before any mutation**.
4. Plan → freeze → cold validation → **stop**: validation does not authorize
   implementation.
5. Human confirms the fleet composition; PM persists the roster; only then `pair start`.

**Workers spawn as splits in the PM's own window** (never the o-prime's) and inherit the
PM's verified worktree cwd. Canary every worker — model, effort, identity, cwd, branch —
before trusting it.

## Reporting — first-person only, both edges

Every `pij report` is a first-person claim about the seat itself. The PM reports at
start-of-work and stop-of-work of every unit; a PM reporting a worker's progress as its
own is the same category error as coding. Worker card freshness is the PM's
accountability: `pij anomalies` **unscoped** (`--project` filters status-stale out;
`--here` hides workers in other worktrees), relay the remediation line verbatim, and
confirm the card actually moved. Silence from a worker is treated **outage-first, never
misconduct-first**: liveness check after a missed 15-minute cadence, one status request
(`COMPLETE`/`CONTINUING`/`BLOCKED`), poke before redispatch.

## Holds and human rulings (`protocol.md`)

A hold from the governing seat is **binding until the seat that set it lifts it**. A
human instruction that appears to conflict with a standing hold is not the PM's to
reconcile: **stop, surface the conflict to both, mutate nothing** until one of them
resolves it. Raising the flag and acting through it in the same turn is worse than not
seeing the conflict — it means the check fired and was overridden. Questions go to
whoever owns the context; parents get a pointer, never a proxied question.

## Verify which contract a seat actually had

Ermine's caution, kept verbatim because it generalizes: *"'The PM did not follow the
contract' and 'the PM never had the contract' look identical from where you are
standing."* Before correcting a seat, establish which failure occurred — no brief, a
brief that omitted the model, or a brief received and overridden. Only the last one
justifies replacing the seat. (This repo's incident was the second kind; the fix was a
re-brief, and the defect was the brief-writer's.)

Note also: the /pij skill installs in more than one place (repo copy vs.
`~/.claude/skills/pij/` vs. `~/.agents/skills/pij/`) and copies can drift — check which
one a seat actually loaded before concluding it ignored doctrine it was never given.

## Make the packet cheap to contradict — the five mechanisms

**Added 2026-08-28.** Sourced from `pij-driving-nigel` (flowspace3 PM), which had **four contract
defects forced on it by measurement in one day, all four raised by CODERS rather than by the PM** —
and could therefore say what mechanically made contradicting its packets cheap. Adopted here
because the same day, in this repo, every finding that mattered also travelled upward: a fresh PM
contradicted a green suite and two prior seats, Jordan contradicted a reviewer's APPROVE, and a
consumer's coder contradicted my own written brief. **Not once did a correct instruction flow down
and prevent a defect.**

**A brief cannot be right.** Mine went stale within a day, twice. Nigel's was wrong by the time it
was written. **So a brief's job is to be CHEAP TO CONTRADICT**, and these are the mechanisms that
make it so — mechanisms, not intentions, so they work in a fleet that has never met you:

1. **The ack is a NAMED STAGE with a NAMED OUTPUT.** Require a numbered plan back before any code,
   and say in the packet that corrections are welcome. This converts contradiction from an
   interruption into a **deliverable** — the seat objecting is completing the step, not derailing
   the process. Three of nigel's four defects surfaced here, *before a diff existed*.
2. **Write that EVIDENCE OUTRANKS THE PACKET.** Not "raise concerns" — *"your evidence outranks
   this packet."* A seat deciding whether to contradict is really deciding whether it will be
   believed, and a written precommitment to believe measurement is the cheapest thing a brief can
   carry.
3. **RULE BY NUMBER, FAST.** Every contradiction gets an explicit accepted/overruled with a reason,
   in minutes. **The second contradiction is priced by how the first was received.** Give the reason
   at length precisely when overruling, so the next one still arrives.
4. **BEAR THE COST OF BEING WRONG VISIBLY.** Record your own wrong inferences where the fleet can
   see them. A seat watching its supervisor record being wrong learns that the price of being wrong
   is survivable. (This government does it in `orient-local.md`; several entries there are mine
   against myself.)
5. **NO FIXTURE MAY BE RELABELLED — "never hand-write an envelope you have not seen."** Nigel did
   not anticipate this one and it turned out load-bearing: it gave a coder **a rule to point at
   rather than a judgement to defend.** It did not have to argue that the PM's brief was stale, only
   that the bytes did not exist. **A rule that makes a contradiction mechanical rather than
   interpersonal is worth more than any amount of encouragement.**

### Why upward, and what that implies

Nigel's sharpening, kept because it is the correct causal account: findings travel upward **from the
point of contact with reality**. The coder touches the binary, so it corrects the PM. The PM touches
the corpus, so it corrects the o-prime. The human touches the product, so he corrects the reviewer.
**Nobody in that chain is smarter than the person above them — they are closer to the thing.**

So the design goal is not *"get better instructions down"*. It is **"keep the path from the point of
contact upward as short and as cheap as possible"**, and **every layer that has to be PERSUADED
rather than SHOWN is length added to that path.**

**The quiet failure mode**: if contradicting the packet is expensive — in tone, in time, in
permission, in having to be sure first — the measurements stop arriving and **the government goes
blind while its documents stay confident.** Treat a stretch with no upward corrections as a missing
instrument, not as a good week.

**And the honest caveat, nigel's own**: its packets were cheap to contradict *partly by luck* — it
wrote "evidence outranks the packet" as inherited doctrine, not because it had predicted four
defects. **The system worked better than its author's foresight, which is the argument for encoding
the mechanism and against trusting judgement.**

## Source index

| What | Where |
|---|---|
| PM operating contract | `~/.claude/skills/pij/references/prime/orchestrator.md` |
| Fleet lifecycle (coder+reviewer) | `~/.claude/skills/pij/references/routes/pair.md` |
| One-task delegation | `~/.claude/skills/pij/references/routes/delegate.md` |
| Seating a stream, 17 steps | `~/.claude/skills/pij/references/prime/rituals/kickoff.md` |
| Brief template (structure tree) | `~/.claude/skills/pij/references/prime/templates/stream-brief.md` |
| Worked brief example | `AI-Substrate/pij` repo: `government/briefs/s102-stall-notice-discriminator.md` |
| Holds, rulings, escalation | `~/.claude/skills/pij/references/prime/protocol.md` |
| Router + prime route | `~/.claude/skills/pij/SKILL.md`, `references/routes/prime.md` |
