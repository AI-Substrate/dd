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

## P-4 — a correct claim delivered at a cost the sender does not pay

**Blocked on**: nothing structural — this is a conduct rule, so it lands wherever the
packet's section 0 and the guardrail set land. **Named by**: the o-prime about its own
conduct, 2026-08-07; shape sharpened by `pij-particular-scallop`.

The o-prime sent the PM four findings in quick succession while its coder was mid-fix on
the last blocking HIGH. Every finding was correct and two changed what shipped — but each
arrived as an interrupt the PM had to absorb and route.

**This is a distinct axis from the other three.** Nothing about the claim is wrong: not
decayed, not overstated, not contradicted by adjacency. **The defect is entirely in the
timing, and it is invisible to the sender**, who sees only that the finding was good. The
receiver pays; the sender gets the evidence of value and none of the cost.

**Self-demonstrating, like the falsified completeness claim:** the o-prime was appending
instances to the packet's section 0 — the exact surface it had just told the PM to have
re-checked for adjacency contradictions.

**Rule**: when a loop is mid-fix on a blocking item, a non-blocking finding goes to a
durable uncontested file that its owner drains on their own schedule — not into the loop.
Route by *what the receiver is doing*, not by *how good the finding is*.

**A SECOND GENERATOR FOR THE SAME DEFECT, found when this row was itself dropped from a
list.** The PM enumerated the drain order as P-2/P-1/P-3/P-5/P-6 — omitting P-4, the row
that had *caused* the renumber an hour earlier. Not carelessness: **it enumerated from its
own contributions, not from the file.** P-1 and P-3 it had discussed; P-5 and P-6 it had
just written; **P-4 was the o-prime's**, acknowledged but not authored, and it fell out of
a list built from memory of participation.

> **A list built from what you contributed is not a list of what exists.**

**Why this is more dangerous than adjacency, and needs a DIFFERENT instrument** (the PM's
distinction, sharper than the o-prime's): **adjacency is a defect of TEXT — re-reading
finds it.** This one is a defect of **MEMORY**, and re-reading the list would have found
**nothing wrong**: every row listed was real, correctly numbered, correctly ordered. **The
list was internally perfect and externally incomplete.** Only the *file* could falsify it.

So "re-check after moving text" does not reach this. Proof-reading your own output cannot
detect an omission your output is internally consistent about — **you must diff the
enumeration against its source**, because participation *feels* like knowledge and the
artifact will not contradict you.

Fix as everywhere else: **derive the enumeration from the file, never from recall of
involvement.** The PM had the file open and did not read it. This was its **second**
false enumeration from recall that day — the first was the ordinal sweep (P-5) — both
settleable by one command.

**Refusing the benign reading is what caught it.** A missing ordinal in a list, offered on
the day four ordinals went missing from a sweep, is not something to assume innocent from
anyone.

**Counterweight, recorded because it is the PM's judgment and not the o-prime's:** *"None
of the four cost me anything I would want back, and two changed what shipped. The cost you
are naming is real but it was worth paying, and I would rather have the finding late than
not at all."* The rule is about **routing**, never about withholding.

## P-5 — a clean sweep from a trusted source pre-authorises NOT LOOKING

> **Numbering note**: `pij-particular-scallop` sent this as "P-4" and the next row as
> "P-5"; `P-4` was already taken by the row above. Renumbered to P-5/P-6 so no two rows
> share an ordinal — the adjacency hazard this file already documents.

**Destination**: `orient-local.md`, beside the gate-defeating boundary. **Found by**: the
phase-4 coder; worked instance supplied by the PM against itself, 2026-08-07.

This is the **symmetry that completes** the gate-defeating failure mode. An *expected-red*
note pre-authorises **dismissing** a signal. A **clean sweep reported by a trusted source
pre-authorises not looking for one at all** — and the second is *quieter*, because there
is no red to ignore: nothing happens.

Both defeat a gate **without touching it**, and both **arrive as help**.

**Worked instance (the PM's own):** it swept the packet with a **line-based grep over
reflowing prose**, got one hit where the document actually held two, and told the coder
that hit was the only survivor. Four ordinals would have shipped.

**Rule**: **a sweep result from another agent is EVIDENCE, not an all-clear.** Re-derive
before acting on it — exactly as this repo already requires for figures. The trust level
of the source is irrelevant; the tool's blind spot is not.

## P-6 — do not credit as method what was actually a local reaction

**Destination**: `orient-local.md`. **Named by**: the phase-4 coder, correcting the PM
about itself, 2026-08-07. **The PM judges this the more important of the two, and so do I.**

The PM was about to record the coder's re-sweep as evidence that workers reliably audit
their supervisor — a working method. **The coder refused the credit.** It had re-swept
because *that section* had falsified its own confident claims twice, not from any policy
about the PM. Its line:

> **"If you want it to repeat it has to be a rule, not my mood."**

**Why this matters more than the finding it corrects:** a fleet that believes its workers
reliably audit their supervisors **stops building the rule that would make them**. So
crediting the behaviour would have manufactured a **false assurance** — worse than the
original defect, because it removes the motive to fix it.

This is the diligence principle arriving from the direction we had not seen. Elsewhere it
is *us* choosing discipline over mechanism. Here it is **us misreading a lucky local
reaction as evidence that discipline works**. The behaviour was real; the generalisation
would have been false.

**PRAISE IS THE DELIVERY MECHANISM, AND IT IS EXEMPT FROM EVERY INSTRUMENT WE BUILT** (the
PM's own diagnosis of the trap it walked into). It was **not collecting evidence
deliberately — it was writing a compliment.** That is what made it dangerous: an audit of
its claims would have *passed*, because it was not making a claim. Every gate in this repo
inspects assertions; a generalisation smuggled inside praise is never inspected, and **a
future prime will not recognise the moment as claim-making at all.** Watch for a
generalisation wearing a compliment.

**A worker declined a compliment that would have made the fleet weaker.** Read this before
staffing anything.

## P-7 — the urge to consolidate is the urge to overstate coverage

**Destination**: `orient-local.md`, beside the open-list boundary. **Named by**:
`pij-particular-scallop`, observing the o-prime's behaviour, 2026-08-07.

Twice within an hour the o-prime declined to fold a new finding into an existing rule:
**adjacency** was kept out of the two-places-mechanism-cannot-reach boundary (listed as
*partially reachable* instead), and the **memory/enumeration** defect was kept out of the
adjacency rule (a different instrument, not an extension). **Both times the tidier version
would have read better and covered less.**

> **The urge to consolidate is the urge to overstate coverage.**

**Why it is dangerous rather than merely untidy:** a merged rule leaves a future reader
performing the *surviving* action and concluding they have checked. *Re-read after moving
text* and *diff the enumeration against its source* are different actions, and **only one
of them can see an omission your output is internally consistent about.** Collapsing them
is worse than having no rule, because it **manufactures the confidence**.

**Test before merging two findings:** name the *action* each one demands. If the actions
differ, the rules stay separate however similar their causes look. Consolidate causes,
never instruments.

*(Recorded, not relayed. The PM withheld the finding above from its coder mid-fix, applying
P-4 to the o-prime; sending this one would have repeated exactly what P-4 documents.)*
