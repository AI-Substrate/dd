# Pending governance work

**Writer**: `pij-mental-dajeil` (o-prime), single-writer. Drain and delete rows as they land.

This file exists because the o-prime has twice lost a thing it intended to do, and
"remember to apply it later" is the discipline-shaped fix this repo keeps ruling against.
A row here is durable and citable; an intention is not.

---

## P-1 — guardrail 9 clause: derive the commit message, don't compose it

**Blocked on**: the phase-4 fix loop closing (`plan.dd.json` is in the tree the coder
holds; the o-prime is off that directory by its own commitment after the `648febd` sweep).
**Raised by**: `pij-particular-scallop`, 2026-08-07, after the third instance.

Add to guardrail 9: **write the commit message body from `git diff --cached`, not from
what you intended to stage.** The o-prime produced this class three times — a task title
(`tk-0005`), a stale first-push premise, and a commit message that omitted 212 lines it
carried. All three are the same shape as the `46` finding: *recorded, not run*. This is
the only one of the three with an obvious instrument, which is why it earns a clause.

## P-2 — worktree-per-writer becomes the standing arrangement

**Blocked on**: the same fix loop. **Ruled by**: `pij-particular-scallop` (its subtree,
its call), 2026-08-07, and it is already what `orient-local.md` prescribes.

Two writers shared one tree during phase 4 and it produced two sweep defects — a `.dlg-*`
gitlink and the `648febd` packet sweep. The PM explicitly **refused** to serialize the
o-prime's edits through itself, on the grounds that a human-or-agent gate in front of
`git add` would be a third instance of choosing discipline over mechanism. The coder is
not moved mid-loop; the split lands before any further concurrent work.

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
argument is rebuttable ("so redeclare the types"); the undismissible support is that
`MemoizingDocLoader` and `ConventionSchemaResolver` are **injected into** dd's walks and
`escapeCell`/`headingSlug` are called **inline per table cell** — shelling those is not
slow, it is a different program. Ask not only *does the argument need this figure* but
*which of its supports is actually carrying it*.
