---
schema_version: "1.2"
retro_id: "2026-08-08T00:26:57Z-agent-p4drain"
agent: agent
plan_id: 001-dd-extraction
started_at: "2026-08-07T06:52:10.770Z"
ended_at: "2026-08-08T00:26:57Z"
summary: "retro --drain phase-4 close-out (8 entries) — the phase that delivered CI green on main, the koala handover, and the OQ-1/OQ-2 rulings"
entries:
  - id: SUGG-001
    kind: improvement-suggestion
    description: |-
      Guardrail rows earn their keep only where the rule is NOT yet mechanized (PM's generalization, phase 4). Of the three rows covering the claim-outran-implementation class: claim-outran-implementation is partly mechanized (dd schema refuses a state change with no written reason; mutation tests red a vacuous guard), but OUT-OF-DIFF ASSERTION SWEEP and MEASURED-AT STAMPING are still pure human discipline — nothing fails if a reviewer skips the sweep or a receipt omits its SHA. Both are mechanizable: the sweep as a repo-wide grep gate over assertions naming changed behaviour, the stamping as a check that count-claims in execution logs carry a resolvable SHA.
    target: harness-itself
    suggested_encoding: |-
      two harness verbs: an out-of-diff assertion sweep gate, and an execution-log measured-at linter
    fp: 4e0f41f70bbe
    first_seen_at: "2026-08-07T06:52:10.770Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-001
    kind: difficulty
    description: |-
      scripts/self-host-check.sh used mapfile (bash 4+); macOS ships bash 3.2 so it died with 'mapfile: command not found' while ubuntu CI would have stayed green. Same trap for empty-array expansion under set -u. scripts/pack-gate.sh already avoided both — the convention existed but was undiscoverable, so I re-found it by breaking. A shellcheck gate over scripts/ would have caught both mechanically.
    severity: degrading
    fp: 28ea2d00ffd0
    first_seen_at: "2026-08-07T06:58:57.822Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-002
    kind: difficulty
    description: |-
      harness flow comment --text composed in a shell silently loses any backticked content to command substitution — a ruling recorded on a flow node came out with two branch names eaten, leaving the mechanism ambiguous. Comments are append-only so the only repair is a second comment. Bites hardest for the artifact class that MUST be verbatim: rulings, receipts, quoted human decisions.
    severity: degrading
    target: harness-itself
    suggested_encoding: |-
      a --text-file flag on harness flow comment, so verbatim text never transits a shell
    fp: ab6f548126f8
    first_seen_at: "2026-08-07T07:00:04.457Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-003
    kind: difficulty
    description: |-
      Agent-to-agent text passed through shell-evaluated CLI args silently loses content: backticks in harness flow comment --text ate two branch names out of a governance ruling, and the same class blocked a pij send. Verbatim-critical text needs a file+pointer path, not an argv string
    severity: degrading
    fp: c2b26db115c0
    first_seen_at: "2026-08-07T07:01:09.685Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: INS-001
    kind: insight
    description: |-
      Pointer delivery makes a claim outrun its evidence BY CONSTRUCTION: the body travels as a file behind a pointer, but the summary line carrying that pointer is unverified prose written by READING the evidence rather than deriving from it. koala's wrong 'six symbols' travelled in its pij summary while the correct table of nine sat in the file. The recipient reads the summary; only a diligent one opens the pointer. This is a structural hazard in pij invariant 2's own delivery model, and every agent-to-agent message in this fleet has the same shape — including mine.
    target: harness-itself
    suggested_encoding: |-
      derive every figure in a summary line in the same operation that prints the evidence block; never retype a count from a table you just wrote
    fp: 4404e83dd633
    first_seen_at: "2026-08-07T07:11:36.657Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-004
    kind: difficulty
    description: |-
      Two agents writing one git tree with no worktree separation produced two sweep defects in one session: a .dlg-* delegate worktree staged as an unresolvable gitlink, and 185 lines of a coder's in-progress file committed under a governance commit message that described none of it. Both from git add of a path rather than named files. The repo's own orient-local prescribes one worktree per stream and we were not doing it. No amount of care with git add fixes this — it is a structural collision, and the careful-agent version of the fix is exactly the kind this repo has twice ruled against.
    severity: degrading
    target: tooling
    suggested_encoding: |-
      either enforce worktree-per-stream for concurrent writers, or a pre-commit hook that refuses a commit touching paths outside the committer's declared scope
    fp: f2f6bc494fe4
    first_seen_at: "2026-08-07T07:35:17.134Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: INS-002
    kind: insight
    description: |-
      Stood up a PA (pij-major-vicuna) as a bootstrap deliverable, then did essentially all governance work myself across four phases — it has spent the session reporting ready every ~45min with nothing dispatched. Its standing chore (chasing stale status cards) correctly found nothing because the seats stayed current. So the PA was well-configured and structurally under-used: the o-prime never decomposed any of its own work into PA-shaped units, and a cheap tier sitting idle beside an expensive one doing mechanical sweeps is a fleet-design failure, not a PA failure.
    target: harness-itself
    suggested_encoding: |-
      at dispatch time ask which parts of THIS unit are mechanical/read-only and route those to the PA, rather than treating the PA as an exception-handler that only wakes on anomalies
    fp: dc4a9d1077ad
    first_seen_at: "2026-08-07T08:09:24.968Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-005
    kind: difficulty
    description: |-
      dd add --mint only accepts a hard-coded prefix set (ph-, tk-, ac-, bp-, lg-, dw-, fn-, fd-, vd-), all from the builder schema family. A newly authored schema family cannot mint ids at all — authoring project/wishlist and then adding a row failed with 'wl is not a registered id prefix'. The workaround is supplying the id by hand, which is exactly the hand-computed value dd exists to remove, and it scales badly: the author must know the highest existing ordinal.
    severity: annoying
    target: tooling
    suggested_encoding: |-
      let a schema DECLARE its own id prefix (e.g. an id_prefix key beside dd_schema), so mint derives the registry from resolved schemas rather than a constant
    fp: 60140bbfd82d
    first_seen_at: "2026-08-07T23:42:21.055Z"
    disposition: kept
    system:
      compound:
        status: open
system:
  compound:
    bubble_action: "all-save"
---
