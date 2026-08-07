# Context brief — Phase 3: Package & release readiness
**Plan**: `docs/plans/001-dd-extraction/plan.dd.json` · **Tasks**: `tasks.dd.json` (tk-0001…tk-0006) · authored 2026-08-07 at the phase-2 review signal (pipelined)

## Executive briefing
**Purpose**: turn working code into a consumable artifact. The npm proxy lag makes the
tarball the consume path, so "packs standalone" is a CHECKED GATE (committed script),
never an assumption. This phase also carries the one ruled rename (43 `harness dd`
strings → `dd`) and the exports FREEZE.

✅ tk-0001 precondition (OQ rulings) → tk-0002 freeze → tk-0003 rename ∥ tk-0004 prepack
→ tk-0005 pack gate → tk-0006 docs.
❌ Non-goals: publish/tags/releases (Jordan's); self-hosting (phase 4); ANY new verb.

## Rulings folded here
1. **43-string rename RULED IN (o-prime 2026-08-07)**: user-facing correctness for a
   binary named `dd`. The GENERATED banner is a wire format — per-package banners are
   self-consistent; upstream siblings diff on koala's swap, EXPECTED, note travels in
   the handover packet. Regenerate every sibling in the same commit as the rename.
2. **tk-0001 is a HARD precondition**: no exports freeze on a guessed ruling. Jordan
   asked via telegram (recs 1a/2a); silence at dispatch time → escalate to the prime,
   hold tk-0002, run tk-0003/0004/0006 which are ruling-independent.
3. **Latent ledger defect is CLOSED** (lg-0002): PROVING_COMMANDS map landed in phase 2;
   nothing in this phase re-opens it — but the pack gate's file-list assertion is the
   same honesty pattern: assert the mechanism, not the claim.

## Key constraints
- Registry/proxy access is PERMITTED in the pack gate for the two declared deps only —
  the proof is repo-absence, not network-absence (sol review F3).
- `.dd/schemas` exemplar VALUES stay verbatim (backlog #8–11 ordering).
- Conventional commits; release-please reads them; version alignment is tk-0004's check.
- State mutation contract as prior phases (CLI-only, siblings generated).

**Environment-first posture** (invariant #14): observe friction as it bites.
