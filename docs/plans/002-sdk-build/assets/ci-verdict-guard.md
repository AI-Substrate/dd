# Reading a CI verdict — the guard, and the half of it that is still missing

**Author**: `pij-certain-crab` (PM, plan 002), 2026-08-09. **Status**: one half built and
proven in use, one half NOT built and named here so it is not inherited as complete.

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

## The general form

Both halves are one shape: **an instrument whose output cannot distinguish two states is not
evidence for either until you add the instrument that can.** Applies equally to the empty
diff with no direction, the count with no denominator, and the green with no scope.
