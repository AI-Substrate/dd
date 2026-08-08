# PM 002 — intake review (fresh eyes, pre-dispatch)

**From**: `pij-certain-crab` (PM, plan 002) · **To**: `pij-mental-dajeil` (o-prime, dd)
**Stamped**: 2026-08-08, against `main` @ `465d490` and `s002/sdk-build` @ `053072e`
**Status**: read-only intake. No dispatch, no spawn, worktree untouched (reads only, no writes).

Read: `government/briefs/pm-brief-002-sdk-build.md`, `docs/plans/002-sdk-build/requirements.md`
(worktree copy), `government/standing-constraints.md`, `government/orient-local.md`
§ *where mechanism cannot reach*.

> **Location.** Homed here by o-prime ruling of 2026-08-08 (received after `0f6fa60`): plan
> artifacts live in `docs/plans/002-sdk-build/assets/` on `s002`. Originally written to the PM's
> session scratchpad, deliberately outside both trees, pre-go. **Rulings on all eight findings
> are in `requirements.md` §10** — this file is the historical intake, not the current state:
> F-1 is fixed, F-2/F-3 accepted, F-4 open (the five is UNVERIFIED), F-5–F-7 fixed, F-8 confirmed.

---

## F-1 · BLOCKING · The worktree is 4 commits behind main and is missing three things the brief itself depends on

Derived now:

```
git merge-base main s002/sdk-build              -> 1dbd233
git merge-base --is-ancestor c210d3a s002/...   -> NO
git merge-base --is-ancestor 465d490 s002/...   -> NO
git diff --stat 1dbd233..main -- government/ AGENTS.md package.json
   AGENTS.md          | 22 +++++
   orient-local.md    | 19 ++--
   package.json       |  1 +
```

Three consequences, each confirmed by grep against the worktree files:

1. **`package.json` in `s002` has no `"prepare"`.** That is exactly the one-line fix
   `requirements.md` §4.4 records as *"FIXED at `114b2c1`"*. Two effects: a seat that tests the
   git-URL path from this branch reproduces the **broken** install and can report a regression
   that is not one; and C-2 says pin to a SHA — a pin to any `s002` SHA today ships the defect
   the plan believes it fixed.
2. **`AGENTS.md` in `s002` has no `## Committing in this repo`.** Brief §6 sends me there for the
   `harness commit` detail. It exists only on main (`AGENTS.md:91`). The brief points its reader
   at a section absent from the tree the brief tells them to work in.
3. **`orient-local.md` in `s002` is the superseded harness baseline** — the version `465d490`
   exists to correct (*"it was wrong within the hour"*). A seat running `harness doctor` in the
   worktree reads *one* expected non-ok layer where the corrected rule says **three**. It will
   either chase two false anomalies, or "fix" `gitai-collector`, which the corrected text says
   is machine-global and explicitly not a stream's to change.

**Why this is the interesting one**: nothing is wrong on `main`, and everything is wrong where
the work happens. This is orient-local's axis-1 failure (decay over TIME) reproduced
**structurally** rather than temporally — the governance surface did not decay, it forked. The
existing mitigations (stamp, derive) do not fire, because every figure is correctly stamped in
the copy nobody in this plan reads.

**Action**: bring `s002/sdk-build` up to `465d490` before any seat enters the worktree, and make
"the branch carries current governance" a thing checked at seat-boot rather than remembered.

---

## F-2 · The plan's acceptance test is not attestable by my subtree

The acceptance test is *"Harness re-implements `plan validate` using public exports only."*
That is an event in koala's fleet. Standing 5 forbids us starting the consume step; standing 6
routes fleet traffic prime-to-prime, so I may not ask koala directly. So pass/fail lives behind
a channel I may not use, on work I am forbidden to do.

The five-symbol count is the proxy, and it is the only thing my subtree can actually move.

**Question for you**: do you want the mechanical version — an in-repo consumer fixture that
re-implements `plan validate` importing **only** through public entry points, wired into
`just checks`? That converts a cross-fleet event into a gate, and it is the
*prefer-the-fix-that-does-not-depend-on-anyone-being-diligent* pattern applied to the plan's own
success criterion. If yes, it is plausibly the first dispatch after the R-1 research step (F-5).
If no, name who attests the acceptance test and over what channel.

---

## F-3 · The progress bar has no gate; the gate measures something else

`just check-exports` / `exports-reachability-probe.mjs` measures **subpaths** (11/12, §4.2).
The progress bar is **symbols** (5, §4.1). Different instruments, different scopes — and only the
one that is *not* the acceptance test is CI-gated.

So the five-symbol figure is a stamped prose measurement with no owner and no expiry, which is
guardrail 9's defect exactly. Nothing re-derives it; it will read as current forever.
One artifact fixes this and F-2 together.

---

## F-4 · Internal inconsistency in §4.1's derivation — in the number the brief calls the progress bar

§4.1 states: *"`src/plan/` imports six modules absent from the `exports` map; one (`links/model`)
is reachable because `links/index` re-exports it wholesale."* 6 − 1 = **five** modules
unreachable. The table beneath names **four** modules (`core/constants`, `core/derive`,
`core/rel`, `core/value`).

One module is unaccounted for: either it is reachable by a route the text does not state, or it
is missing from the table. **I have not re-derived it** — that means reading `src/plan/` in the
worktree, and I am holding. I am not using the figure, only flagging that a reader cannot get
from the prose to the table, and this is the number designated as the plan's progress bar.

---

## F-5 · MISSING FROM THE BRIEF · R-1's attached conditions

Brief §1 restates `requirements.md` §1 but drops R-1's **attached conditions** — in particular
that the SDK design flow *"researches best-in-class SDK design guidelines via perplexity BEFORE
designing"*. That is Jordan's condition (requirements §2, R-1), and §8 lists the research as
**not yet gathered**.

A PM working from the brief alone would dispatch design work first and break a Jordan ruling
without ever seeing it. The brief is the durable artifact a replacement seat inherits, so the
condition belongs in the brief, not only in the file the brief points at.

**Consequence for sequencing**: the first dispatch is the research step, not design.

---

## F-6 · C-2's "tag or SHA" is SHA-only for every agent in my subtree

C-2 says pin to a tag **or** SHA. Standing 2 / C-4 says no tags from agents. The choice is
therefore not free for anyone I dispatch: **SHA-only**, and any tag step requires Jordan.
Worth saying inside C-2 so a seat does not propose a tagging step and then stall on it.

---

## F-7 · Minor · enumeration vs list, brief §6

§6 opens *"Two failure modes that already bit us:"* and then lists **three** bullets. The third
(derive the message from `git diff --cached`) is either a third failure mode or a rule filed
under the wrong header. Trivial in itself — flagged only because orient-local guardrail 7 makes
*diff the enumeration against its source* a named instrument, and this is that check firing on
the brief that cites it.

---

## F-8 · Question · who lawfully writes plan 002's flow file

R-1 requires plan 002 to be *"its own builder flow"*. Standing 3 makes flow files forbidden to
**read and write**, with builder guided mode the sole writer. Confirm plan 002 runs through
`/builder` guided, so the flow artifact has a lawful writer — otherwise the plan requires an
artifact nobody in my subtree is permitted to create.

---

## What I did not check

- Did **not** re-derive the five-symbol / six-module figure (F-4) — requires reading `src/plan/`
  in the worktree; holding per the brief.
- Did **not** run `harness doctor`, `just checks`, or the exports probe anywhere.
- Did **not** verify koala's consumer census (§4.5) or the git-URL install evidence (§4.4)
  against a live install.
- Read the worktree's files; wrote nothing anywhere except this scratchpad file.
