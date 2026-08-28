# Stream brief — links from a dd to an ordinary file

**Written by**: `pij-mental-dajeil` (o-prime), 2026-08-16.
**Worktree**: `/Users/jordanknight/substrate/dd-worktrees/file-links`
**Branch**: `feat/file-links`, cut from `main` at the merge of PR #11.
**Wishlist row**: `wl-0023` — RULED by Jordan 2026-08-16; it had been deliberately
parked as UNRULED pending the SDK design pass. That parking is now lifted **for the
narrow scope below** and for nothing else.

## The ask, in Jordan's words

> "need to be able to link from a ddoc to a different file type, e.g. md or code file.
> During build they are just validated to exist and thats it. they dont address a
> section, just the file. However later we might allow addressing a particular method
> in a file using file#method or what ever is best practice."

Then, on shape: **"yes b and c together"** — both the typed-column form and the
markdown-in-prose form, in this stream.

## Two shapes land, and they are different features

**B — a typed link column.** Schema declares the field once:

```json
"implemented_by": {
  "type": "array",
  "items": { "type": "link", "target": "file", "rel": "implemented_by" }
}
```

Document rows then carry plain repo-relative paths:

```json
{ "id": "ac-1a2b", "claim": "Queries under 100ms at p95",
  "implemented_by": ["src/search/index.ts", "docs/adr/0007-search.md"] }
```

These are **structured** edges — one per row, queryable, visible to `ddocs links` and
`ddocs graph`, rendered as working links in the `.dd.md`.

**C — markdown links inside a prose field, checked.**

```json
{ "id": "ac-1a2b",
  "note": "the hot path is [the query planner](src/search/planner.ts)" }
```

These are **incidental** references. `[text](path)` is an explicit marker, so nothing
is guessed. **Bare paths in prose stay unchecked, deliberately** — a validator that
sniffs which strings look like paths would fire on every filename mentioned in a
sentence. The marker is the opt-in.

## Rulings (settled — do not re-open without coming to me)

1. **Missing file → WARN, never an error.** Jordan's explicit call. `ddocs build`
   reports `degraded` and names the finding; it never blocks. The reason is worth
   understanding rather than obeying: every other dd check is self-contained — a
   `.dd.json` plus its schema fully determine the verdict, so `validate` answers the
   same on any machine. **A file link is the first check whose answer depends on files
   dd does not own**, so a sparse clone, a vendored `.dd.json`, or a consumer without
   the sources would see failures that are not real. WARN is what keeps a
   working-tree-dependent answer from becoming a gate.
2. **Existence, and nothing else.** No content hashing, no `verify-basis` integration,
   no freshness. That is `wl-0023`'s other half and it stays out of this stream.
3. **`target: "file"` is the marker**, plain, with no further constraint — no
   `file:ts`, no globs, no extension allowlists. My call, not Jordan's: constraining is
   purely additive later, and shipping the constraint first would fix a vocabulary
   before any consumer has asked for one. If you think this is wrong, say so before you
   build it.
4. **`file#method` is OUT OF SCOPE and must stay POSSIBLE.** Measured on main before
   this brief was written: `ddocs address validate "src/foo.ts#parseThing"` already
   returns **ok** with `classified: false` — the grammar accepts it today, it is simply
   never resolved. **Nothing you ship may make that form harder to reach later.** If
   your design would foreclose it, that is a finding for me, not a decision for you.
5. **Whole-file addressing is the actual grammar change**, and it is the risky part.
   `src/core/address.ts:36` requires exactly one `#`; a whole-file link has no interior
   to name, so `ddocs address validate "notes.md"` is refused today with E405. How the
   whole-file form is expressed — a bare path, a trailing `#`, or something else — is
   **the one design decision in this stream** and I want it in a short written proposal
   before it is implemented. The address grammar is the most load-bearing thing in dd.

## Why this is not a small feature

Two independent external consumers hit this wall cold, in unrelated domains, neither
prompted:

- `pij-industrial-leopard` (novels repo) — could build a ledger *beside* the prose but
  never a graph *over* it; every reference from ledger into chapter was an untyped
  string the validator never saw.
- `osk-data` (NDIS/SaH invoicing) — pinned PDF and email exhibits, and has already
  **hand-written the missing primitive as a shell script**.

Their reports are in `docs/plans/wishlist.dd.json#items/wl-0023`, and you should read
that row before designing anything. A third consumer asking is why it is being built.

## Scope fence

- Allowed: `src/core/address.ts`, `src/core/model.ts`, `src/core/validate.ts`,
  `src/links/**`, `src/render/**`, `src/acts/**` as required, `test/**`, and the schema
  fixtures under `test/`.
- Forbidden: `src/acts/status.ts`'s `PLANNED_VERBS` (this adds no verb to the port
  ledger — it must still read 10/10), `.harness/government/**`, the baked docs content,
  `.the-flow-state.json`, `the-flow.json`, `the-flow.md`.
- Any `.dd.md` you touch is regenerated by the tool in the same commit, never hand-edited.

## Shape of the work

This is size `l` and it changes load-bearing grammar. **Do not go straight to code.**
Run an explore + plan pass first (`/builder`), produce the whole-file-form proposal
called for in ruling 5, and send me that proposal before dispatching an implementation
packet. Dogfood `ddocs` throughout — if the tool fights you while you are using it to
plan work on itself, that friction is a finding worth more than the feature.

## The trap, stated in advance

The obvious test — *"a link to a missing file produces a warn"* — passes against an
implementation that warns on **everything**, including files that exist. This repo's
most-repeated defect is a test whose name is stronger than its assertions
(`docs/backlog.md` rows 25–27; `orient-local.md`: *"a name is the cheapest thing to read
and the most expensive to trust"*). Prove both directions: existing file → no finding,
missing file → exactly one finding naming that path. And prove non-vacuity the way this
repo has learned to — **break the world, not the test**.

Two more, specific to shape C: a prose field containing `[text](https://example.com)`
must NOT be treated as a file link, and a prose field containing a bare path must NOT be
checked. Both are easy to get wrong in a way every happy-path test passes.

## Standing constraints

- **npm resolves through the corporate supply-chain proxy.** Never
  `--registry=https://registry.npmjs.org`, never hand-edit a `resolved` URL. `AGENTS.md`
  carries the rule and a live instance. Unreachable package = the control working; come
  to me.
- **Never hand-edit a `.dd.md`.** Write through `ddocs set`/`add`/`rm`.
- Conventional commits, via `harness commit`.

## Definition of done

`just checks` green, PR up against `main`, CI green. Report to me at **PR up + CI
green** — and separately, earlier, with the ruling-5 proposal.

## Operating contract

You are a **stream orchestrator**. You own the plan, the fleet, the evidence and the
landing. **You do not implement it**, and you do not pre-empt the reviewer's judgment.
Read `.harness/government/how-fleets-work.md` before dispatching — especially that a
reviewer is a **second instrument on the measurement, not a second opinion on the
conclusion**, and that re-running the coder's own probe is not independence even when it
produces fresh numbers.

And the newest entry, earned last night at real cost: **before reconstructing whether
something happened, list what it would have produced.** Cheap non-destructive reads
before anything expensive or irreversible.
