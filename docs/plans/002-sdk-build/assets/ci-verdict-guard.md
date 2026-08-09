# Reading a CI verdict — the guard, and the half of it that is still missing

**Author**: `pij-certain-crab` (PM, plan 002), 2026-08-09. **Status**: one half built and
proven in use, one half NOT built and named here so it is not inherited as complete — plus a
**third** added the same day, after the first two both fired and neither caught it.

> **The document is called "the half that is missing" and there are now five.** Read that as the
> standing warning it is: an enumeration of an instrument's blind spots is itself an instrument,
> and it has the same blind spot — it can only list the failures already suffered. The count in
> this sentence has been wrong three times; assume it is wrong now.
>
> **All five are one shape**: two states sharing one observable. An empty verdict wearing a
> pass's exit code · a partial listing indistinguishable from a complete one · a green that
> expired when the head moved · a count wearing its query window as a denominator · a plant that
> failed wearing a negation's result. **The shape recurs because nothing about a reading tells
> you what it could not have distinguished** — that has to be supplied from outside, every time.

This exists because the guard it describes lived only in ad-hoc command strings. A rule that
survives in a transcript survives exactly as long as the transcript, and the next person
inherits the behaviour without the caveat.

## What went wrong first — absence rendered as success

`gh pr checks <n>` returns **`no checks reported` with EXIT 0**. So a single output covers
three different states:

1. the checks ran and passed,
2. the checks have not registered yet,
3. the checks **cannot run at all**.

State 3 is not hypothetical: while a PR is `CONFLICTING`, GitHub cannot compute the merge ref
that a `pull_request` workflow runs against, so no run is ever created. On 2026-08-08 this
branch sat in state 3 and the watcher reported exit 0 — a verdict that could not exist, wearing
the exit code of one that had.

**Rule, and it is cheap**: *never let an empty result share an exit code with a passing one.*
The watcher asks for the count first and treats zero as a **finding**, not a wait:

```bash
N=$(gh api repos/<owner>/<repo>/commits/<sha>/check-runs --jq '.total_count')
[ "$N" = "0" ] && echo 'VERDICT=EMPTY — FINDING, not a wait'
```

Without that, a false green would have reached the human through two seats, because a green
from a trusted seat gives the seat above it no reason to doubt.

## The half that is NOT fixed — partial rendered as complete

`total_count` **grows as checks register**. Observed twice on this branch: 4 at a 75-second
snapshot, 5 at the end. Those readings are consistent at different times, not contradictory —
and that is exactly the problem.

**`empty is not-green` is safe. `non-empty is a verdict` is NOT.** A partial listing is
indistinguishable from a complete one, and every check in it can be green while a sixth has not
registered. The zero case is fixed; the instrument still collapses **partial into complete**.

This is the passing-side blindness one layer in: an expected red at least ends in an
investigation, an expected green ends in nothing at all.

**Mitigation used today, stated as the weak thing it is**: both reads landed on 5, so the
verdicts on `0f0ed90` and `98e68f0` are sound. *Reading it twice* is a habit, not a guard.

**What a real fix needs — unbuilt, pick one:**

- an **expected count** the verdict is checked against (brittle when the workflow changes, but
  it is the only option that can say *complete*);
- **wait for quiescence** — poll until the count stops moving for N seconds (no oracle needed,
  but it can only ever say *probably done*);
- at minimum, **print the denominator with the verdict** (`5 pass / 0 fail of 5 registered`) so
  a reader can see which denominator the green was measured against.

The third costs nothing and should happen whatever else does. A verdict that hides its
denominator is the same defect as a claim that hides its population — and this plan already
learned that one the expensive way (§4.1, the census that measured the wrong population).

## The third half — a verdict EXPIRES, and nothing announces it

**Added 2026-08-09, hours after the two above, because both of them fired and neither caught
this.** Written by `pij-certain-crab` from a failure that was mine; the sharpest statement of it
is the o-prime's and is quoted below.

The two guards above scope a verdict correctly: it needs its **denominator**, and it needs its
**sha**. Both were satisfied. `98e68f0` was counted at a genuine 5/5 by the o-prime, said out
loud, correctly attributed. Then the branch moved — `d941ece`, `ec2fa1f`, `eec61c6` — and **that
verdict kept being quoted**, by me across a compaction and by the o-prime across four pushes it
was watching happen. The branch had been red since `d941ece`.

> **A verdict is not merely scoped to a sha — it EXPIRES when that sha stops being the head, and
> there is no signal at the moment of expiry.** It goes stale silently while everyone who read it
> keeps quoting it. — `pij-mental-dajeil`

That is the difference from the first two failures, and it is why it survived them: the empty
verdict and the partial verdict are both **wrong when read**. This one is **right when read and
wrong when repeated**. No instrument fires, because nothing changed about the reading — only the
world moved out from under it.

The cost was not academic. The stale green had an argument attached to it (*merge PR #1 to
disarm the main-versus-branch divergence*), so an expired verdict was on its way to the human as
a recommendation to merge a red branch.

**The rule, stated so it can be applied**: *a verdict names a sha; if that sha is not the current
head, you do not have a verdict, you have history.* Re-count or say nothing. Cheap form — never
say "green", say **"green at `<sha>`"**, which makes the expiry visible the moment the head moves
and is unsayable when you have not checked.

**And the aggravating detail, recorded because it is the useful part**: the o-prime had flagged
this exact shape at me hours earlier — *"your green does not cover the branch head, `80233da` is
untested, the push is what tests it"* — and then did not run the command itself. Both of us, on
the same day, wrote the rule down and then failed to apply it to our own reading. **A rule you
can state is not a rule you have applied**; that gap is where all three halves of this document
live.

### Two corollaries, both found the same hour

**1. Recording a finding can invalidate the measurement the finding is about.** I committed the
expiry rule above and *that push expired the verdict I was waiting on* — my watcher was still
keyed to a sha that had stopped being head. This is not carelessness, it is the rule's hardest
case: **any commit expires the head's verdict, including one whose entire content is
documentation.** There is no version of "write it down" that avoids it.

The practical resolution is not to write less, it is to **batch**: do the whole set of writes,
push once, count once. Expiry is unavoidable; *repeated* expiry is a choice. And re-counting
after your own documentation push is **not optional** — that is precisely the push you will feel
entitled to skip.

**2. A skipped check in a red run is not a neutral row.** `package-smoke` read `skipped` on every
red run here and `success` the moment the branch went green — it had not been passing, it had
been **absent**, gated behind the job that failed. Absence rendered as harmless, which is this
document's founding defect wearing a third face.

So a green count is only comparable to a green count: **`5 registered` where one was skipped is
not the same instrument as `5 registered` where all five ran.** Read the conclusions, not just
the total — and treat a `skipped` row as a gate whose findings you do not have, because the
failure that skipped it was hiding whatever it would have found.

### The fourth — a count taken from a limited window is not a count, it is the window

**Added 2026-08-09, the same day as the three above, and it caught both seats inside ten
minutes.** Main went red. The PM reported **four** consecutive failures, read off
`gh run list --limit 4`. The o-prime corrected it to **six** and *named all six*. A 30-row
window shows **eight** — `8a34a09` → `6807cac`, last green `a29b58a`.

Nobody misread anything. Both numbers were accurate *about the window they came from*, and
neither number carried its window. **`--limit N` silently becomes the denominator**, and a
truncated listing is indistinguishable from a complete one — the partial-versus-complete gap
from earlier in this document, arriving through the query instead of through the clock.

The o-prime's version is worse than the PM's and it is worth saying why: **naming the six read
as completeness.** A bare count invites "of how many?"; an enumeration answers a question nobody
then asks.

**Rule**: state the window with the count — *"8 consecutive failures in the last 30 runs"* — or
widen until you see the boundary you are claiming. A red run whose start you have not seen is a
red run of unknown length.

**Corollary, from the same incident**: `--check` passing proved the embed drift was gone and
**proved nothing about CI**. Repairing a cause and inferring the branch state from it is the
stale-green error in a new costume — you verified the thing you fixed, not the thing you claimed.

### The fifth — a negation arm that does not verify its own plant is a control arm

**Added 2026-08-09. This one is about the instrument of last resort, which is why it is the
worst of the five.** Doctrine form on main at `9bf70fd`; the operational form belongs here,
because here is where someone about to run a negation is actually looking.

The pattern this repository reaches for whenever a green looks too easy: **plant the defect, prove
the test fails, restore, prove it passes.** Both arms ran. The negation **passed**, which should
have meant the new test pinned nothing.

It meant something else. **The plant never applied** — single quotes nested inside a
single-quoted shell string, silently a no-op — so the "negation" re-ran the control and reported
the control's result. Exit code, output, everything identical.

> **A negation arm that does not verify its own plant landed IS a control arm, and it reports the
> same outcome either way.**

**The only instrument that can tell them apart is a count across the mutation**, because both
arms produce identical output when the plant silently fails:

```bash
grep -c 'section-absent' src/mutate/locate.ts   # 1   before
<mutate>
grep -c 'section-absent' src/mutate/locate.ts   # 0   PLANT LANDED — now the arm means something
<run: 1 failed / 26 passed>
<restore>
grep -c 'section-absent' src/mutate/locate.ts   # 1   restored
<run: 27 passed>
```

**Rule**: *observe the mutation, not just the outcome.* A negation is two claims — "the defect is
present" and "the suite noticed" — and only the second is ever reported.

**Why this is worse than the other four**: the negation arm is what we fall back to when we stop
trusting a green. It is the appeal court. **And it has the exact failure mode it was invented to
catch** — a silent absence wearing the appearance of a pass. Every planted-defect proof in this
plan rests on the plant having landed, and until this one, none checked.

## The general form

Both halves are one shape: **an instrument whose output cannot distinguish two states is not
evidence for either until you add the instrument that can.** Applies equally to the empty
diff with no direction, the count with no denominator, and the green with no scope.
