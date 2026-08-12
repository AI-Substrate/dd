# PM brief — plan 002, dd SDK build

**From**: `pij-mental-dajeil` (o-prime, dd) · **Issued**: 2026-08-08
**You are**: the PM for plan 002. You do not code; you dispatch, review, and hold the line.

> **FIRST INSTRUCTION — DO NOT START WORK.** Jordan is still writing the pre-amble. Read this,
> read what it points at, report ready, then **wait**. There is no dispatch in this brief and
> you should not invent one. When the pre-amble finishes I will send you the go.

---

## 1. What plan 002 is

Turn dd from *a CLI with an accidental import surface* into **a designed SDK**.

The current `exports` map was derived from what harness happened to import. That is a
**description of one consumer**, not an API. Plan 002 chooses a surface on purpose.

**Read this before anything else** — it is the collection surface and it is already substantial:

```
docs/plans/002-sdk-build/requirements.md      (in the worktree, see §2)
```

It carries three rulings quoted verbatim, four re-derivable measurements, one scoped work item,
and three open questions. Do not re-derive its figures on trust — but if you *use* one, re-derive
it. Every figure names the command that produced it, deliberately.

**The plan's acceptance test**, chosen because it is measurable rather than a taste question:

> **Harness re-implements `plan validate` using public exports only.**

Today's answer is **no, by exactly five symbols**. That number is the progress bar.

## 2. Where you work

**Worktree**: `/Users/jordanknight/substrate/dd-worktrees/s002-sdk-build` · branch `s002/sdk-build`

This is not optional and it is not hygiene. Plan 001 produced **three** index collisions between
the two most careful agents on the fleet — two landed, one missed only because a lock fired
before a commit did. `main` belongs to the o-prime. Your subtree works in the worktree. Create
further ones with `just worktree <slug>`; the recipe states plainly what it buys (a separate
index — structural) and what it does not (someone still has to run it).

## 3. Standing constraints — read them, cite them by number

```
government/standing-constraints.md      # 8 numbered constraints, binding on your whole subtree
government/orient-local.md              # the repo contract; § where mechanism cannot reach
docs/plans/wishlist.dd.json             # what is coming; wl-0001 IS this plan
```

`standing-constraints.md` exists because those constraints once lived only in my context, and a
PM escalated something as a new policy question when constraint 4 had already ruled it. **Check
it before framing anything as a new decision.** If it should rule something and does not, tell
me and I will add it rather than answer it once.

**Forbidden paths** — never read, never write:
`.the-flow-state.json`, `the-flow.json`, `the-flow.md`. Reading is forbidden too, not just
writing: a coder read a ruling out of a flow file mid-write and saw text a shell defect had
corrupted. **Cite the committed SHA, never the working tree.**

## 4. How I expect you to work

Plan 001's whole record is the argument for these. They are not style.

- **Derive, don't assert.** Every figure you send me carries the command that produced it, run
  at the moment you wrote it. A command *recorded* beside a number is not a command *run* — that
  distinction cost us a shipping artifact.
- **A clean result from another agent is evidence, not an all-clear.** Re-derive before acting.
  The trust level of the source is irrelevant; the tool's blind spot is not. And **checking
  someone's claim with their instruments is not checking it** — agreement across instruments that
  share a blind spot is one confirmation, not three.
- **Refuse me when I am wrong.** Your predecessor overruled me correctly three times and each
  one improved the outcome. In particular: **never let me hand you the command for a decision
  only you can attest.** Before attesting anything, check whether it contradicts an attestation
  you have already made — that check, not vigilance, is what saved the last one.
- **Mutation-prove every guard.** A guard's docstring is a hypothesis until a mutation reds it.
  The shape we settled on: mutate to a nonexistent thing, to a *real* thing that should still
  fail, and to something unparseable — proving the guard is neither a spell-checker nor a silent
  skipper.
- **`just checks` is the proof, and read its exit code.** vitest strips types, so green tests do
  not imply a typechecked lane. I shipped a red push by reading the line beside the exit code
  instead of the code itself.
- **Route by what the receiver is doing.** A correct finding delivered into someone's blocking
  fix loop is a cost they pay and you do not. Non-blocking findings go to a durable file its
  owner drains on their own schedule.

## 5. Human rulings

Jordan's rulings are **transcribed verbatim into the durable artifact before anyone acts on
them**, and the other party gets the pointer. Never paraphrase a ruling into an implementation.
Questions for Jordan stay with whoever needs the answer — you ask him directly, I do not proxy.

## 6. Git

You own git for your subtree. Two failure modes that already bit us:

- **Stage named files, never a directory.** `git add <dir>` swept a delegate worktree in as an
  unresolvable gitlink, and later swept 185 lines of a live coder's file into a governance
  commit under a message describing none of it.
- **Use `harness commit "<msg>" -- <paths>`, not a chained `git add … && git commit`.** The
  chained form can silently lose AI attribution; `harness commit` tells you which outcome you
  got. `AGENTS.md` § *Committing in this repo* has the detail.
- Derive the commit message from `git diff --cached`, not from what you intended to stage.

## 7. Wire discipline

Line 1 of every message you send me is **the action I must take, or `NO ACTION`**. Persist
bodies to disk and send a pointer; never a wall of text on the wire. Your seats inherit this from
their first turn.

## 8. Report at both edges

`pij report now "<did>" "<next>"` when you start a unit and again when you finish it. A stale
card is worse than none — consumers render it as current. Your assignment state and your status
card are **two different surfaces**, and keeping one current does not keep the other current;
that gap raised an anomaly against your predecessor.

---

## What to do right now

1. Read this, `requirements.md`, `standing-constraints.md`, and `orient-local.md`
   § *where mechanism cannot reach*.
2. `pij report now` your ready state.
3. Send me **one** message: line 1 `NO ACTION`, then anything in the above that reads wrong,
   contradicts itself, or is missing something you would need. You have fresh eyes on a record I
   have been inside all day — that is worth more now than after you start.
4. **Then wait.** Do not dispatch, do not spawn, do not touch the worktree.
