# Pending governance work

**Writer**: `pij-mental-dajeil` (o-prime), single-writer. Drain and delete rows as they land.

This file exists because the o-prime has twice lost a thing it intended to do, and
"remember to apply it later" is the discipline-shaped fix this repo keeps ruling against.
A row here is durable and citable; an intention is not.

---

## P-2 — worktree-per-writer becomes the standing arrangement

> **DRAIN THIS FIRST.** Ruling updated by `pij-particular-scallop` 2026-08-07 after the
> second near-miss: P-2 is **the first thing that happens on clear** — before P-1, before
> packet-ready, before the push. **Nothing concurrent starts until it lands.** It stays
> *after* the loop only because moving a coder mid-commit is likelier to lose work than the
> hazard itself, and the hazard is dormant solely because the o-prime is off the tree.

**Blocked on**: the same fix loop. **Ruled by**: `pij-particular-scallop` (its subtree,
its call), 2026-08-07, and it is already what `orient-local.md` prescribes.

**Three incidents in one phase, from one shared index** — two landed, one was luck:

1. **Landed** — `git add <dir>` staged the `.dlg-0003-fix-review` delegate worktree as an
   unresolvable gitlink. Fixed by ignoring `.dlg-*/`.
2. **Landed** — `648febd`: the same `git add <dir>` swept 185 lines of the coder's live
   `handover-packet.md` under a governance commit message describing none of it. Not
   amended, because rewriting under a live writer is worse; a `git note` carries the
   correction.
3. **Near-miss** — a `.git/index.lock` collision while the o-prime had a file staged and
   the coder was running git. A bare `git commit` from the coder would have taken that
   file: `648febd` in reverse. **The lock fired before the commit did, which is the only
   reason it did not happen.**

**All three between the two agents who have been most careful about everything else** —
which is the argument, not a mitigating detail. The PM explicitly **refused** to serialize
the o-prime's edits through itself, on the grounds that a human-or-agent gate in front of
`git add` would be another instance of choosing discipline over mechanism.

## P-1 — guardrail 9 clause: derive the commit message, don't compose it

**Blocked on**: the phase-4 fix loop closing (`plan.dd.json` is in the tree the coder
holds; the o-prime is off that directory by its own commitment after the `648febd` sweep).
**Raised by**: `pij-particular-scallop`, 2026-08-07, after the third instance.

Add to guardrail 9: **write the commit message body from `git diff --cached`, not from
what you intended to stage.** The o-prime produced this class three times — a task title
(`tk-0005`), a stale first-push premise, and a commit message that omitted 212 lines it
carried. All three are the same shape as the `46` finding: *recorded, not run*. This is
the only one of the three with an obvious instrument, which is why it earns a clause.

## P-3 — guardrail 9 clause: a decaying figure can weaken an ARGUMENT, not just an honesty claim

**Blocked on**: the same fix loop. **Found by**: the phase-4 coder, re-sweeping the packet
on the could-this-rot test after rejecting its own first pass, 2026-08-07.

We had been treating decaying figures purely as an honesty problem. The packet's
**strongest claim was resting on one**: "library consumption is forced" was carried by a
*count* of type-only symbols. The claim never needed the count — the argument is
structural — so it had inherited that number's decay for no reason. **The fix is not to
stamp the figure; it is to notice the argument never needed it.**

Add to guardrail 9: when a figure appears inside an argument, ask what the argument would
lose without it. If nothing, cut it — a structural claim propped on a number decays at the
number's rate for no benefit. Stamp it only where it is genuinely load-bearing.

**Corollary found by auditing that separation one level deeper (o-prime):** decoupling can
also reveal that a claim was leaning on its *weaker* support. Here the type-erasure
argument is rebuttable ("so redeclare the types"). The load-bearing support is that
`MemoizingDocLoader` and `ConventionSchemaResolver` are **injected into** dd's walks and
`escapeCell`/`headingSlug` are called **inline per table cell**. Ask not only *does the
argument need this figure* but *which of its supports is actually carrying it*.

**Second correction, o-prime, after the reviewer refused the strengthened version.** I
then overstated the replacement as "cannot be shelled even in principle" — and sent that
to Jordan before the refusal arrived. It is false: a persistent worker, an RPC boundary,
or one batched invocation would all work. What the value imports actually prove is that
there is **no drop-in CLI substitution for the existing call sites** — object identity,
callbacks, memoized state and synchronous utility calls do not survive an ordinary
subprocess invocation. The accurate, unbeatable form is:

> **An SDK is required to preserve the current integration; a CLI-only option is possible
> only by redesigning the integration.**

**The generalisable lesson is the one that cost the most:** strengthening an argument is
itself a place claims outrun evidence, and *the direction of the error is predictable* —
you overshoot toward the modal claim (impossible, always, never) because it is rhetorically
stronger. A claim about **substitution** is provable; a claim about **possibility** hands
your reader a technicality that discredits a correct recommendation. Prefer the form that
puts a **cost** in front of the decision-maker over the form that puts a **barrier** there:
the cost is true and is theirs to weigh, the barrier is usually false.
