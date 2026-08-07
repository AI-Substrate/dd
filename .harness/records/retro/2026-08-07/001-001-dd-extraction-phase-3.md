---
schema_version: "1.2"
retro_id: "2026-08-07T06:44:03Z-agent-p3drain"
agent: agent
plan_id: 001-dd-extraction
started_at: "2026-08-07T03:46:02.454Z"
ended_at: "2026-08-07T06:44:03Z"
summary: "retro --drain phase-3 close-out (13 entries; first drain of this plan — the buffer had accumulated across phases 1-3)"
entries:
  - id: DL-001
    kind: difficulty
    description: |-
      harness plan new cannot target an existing plan folder: no --folder flag, so it minted docs/plans/dd-extraction beside the real docs/plans/001-dd-extraction created at explore time; fixed by rsync+rm by hand
    severity: annoying
    fp: 28d02a80bc07
    first_seen_at: "2026-08-07T03:46:02.454Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-002
    kind: difficulty
    description: |-
      consumer repo had no .dd/schemas: harness plan new wrote 5 documents that could not render (builder/plan unresolvable) and the error offers no install path — schemas had to be hand-copied from harness-engineering/.dd; no 'harness dd schema install' or ship-with-CLI mechanism exists
    severity: degrading
    fp: 905fd7a3dd8a
    first_seen_at: "2026-08-07T03:46:02.588Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-003
    kind: difficulty
    description: |-
      harness plan new scaffolds only 6 of builder/plan's 22 schema sections and no verb can add a section to an existing document (dd set/add both E450 section-unknown) — gate_matrix, key_findings, clarifications etc. are unreachable through the paved path; workaround: structural JSON insert of empty sections + immediate plan validate + render to prove schema-validity and no drift. Sibling of dd-next #7 (document birth).
    severity: degrading
    fp: 8db15ad9474d
    first_seen_at: "2026-08-07T03:49:21.788Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-004
    kind: difficulty
    description: |-
      copilot gpt-5.6-sol spawns in this repo hang at boot on 'still waiting on mcp' (1 MCP server configured) — two consecutive seats (squid, sma) stuck in bind-limbo with the queued task never injected; flash-model copilot seat (vicuna) bound fine earlier
    severity: degrading
    fp: 789dff979bb7
    first_seen_at: "2026-08-07T04:01:46.120Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-005
    kind: difficulty
    description: |-
      flow-pair context-pack compiler found '(no tasks found)' for a dd-format plan: it globs tasks.md but dd repos render tasks.dd.md/.dd.json — a worker packet ships with an empty task list and the coder improvises
    severity: degrading
    fp: 2c40694524ea
    first_seen_at: "2026-08-07T04:19:17.040Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-006
    kind: difficulty
    description: |-
      pij spawn --task '<label>' is delivered to the peer as a real first turn, not stored as metadata: an opus-5 coder spawned with a task label began implementing a 6-task phase before its packet arrived
    severity: degrading
    fp: f63ac8d116f5
    first_seen_at: "2026-08-07T04:19:22.882Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: INS-001
    kind: insight
    description: |-
      Phase-1 port discoveries (from coder+PM, recorded in context-brief): upstream services/dd is 48 files not 45 (3 docs assets beside 45 .ts); zero bare npm specifiers confirmed — KF-1 stronger than stated; upstream isolation test leans on dependency-cruiser absent here, replaced with SDK-tree external-import gate; reviewer proved only 1 of 2 guards non-vacuous before PM closed the gap by mutation
    fp: facaf8097432
    first_seen_at: "2026-08-07T04:50:32.077Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-007
    kind: difficulty
    description: |-
      macOS mkdtemp returns /var/... or /tmp/... while process.cwd() reports the resolved /private/... path, so a dd verb given an ABSOLUTE temp-dir path refuses with E429 'outside the repository root'. Temp-repo CLI tests must address documents RELATIVE to cwd.
    severity: degrading
    fp: ab994ddd317e
    first_seen_at: "2026-08-07T05:11:03.590Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: INS-002
    kind: insight
    description: |-
      Phase-2 port discoveries (coder+PM, verified in review): top-level verb registration is the correct structural translation (binary IS dd; upstream nests under a dd sub-command) and dd status derives from exactly that registry; PLANNED_VERBS name-matching could never reach ported[10] for the write family (get/set/add/rm) — PROVING_COMMANDS map with .every() is the fix; background-* exec adapters are dead weight for dd; cross-slice dep resolved as module-in-slice-2/verb-in-slice-3 preserving ledger honesty
    fp: acc87a1a9185
    first_seen_at: "2026-08-07T05:45:55.114Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-008
    kind: difficulty
    description: |-
      A ruled rename of a GENERATED-file banner collides with the tool that generates it: after renaming the banner to the local bin's name, every upstream 'harness dd set/build' call silently regresses it — and that is the same command the governing agent uses to record the rename's completion
    severity: degrading
    fp: 8cfe58f20428
    first_seen_at: "2026-08-07T05:51:31.134Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-009
    kind: difficulty
    description: |-
      Two defects escaped code review from OUTSIDE the diff: a CI assertion falsified by a change that never touched .github/, and a ledger name-match gap. Diff-scoped review structurally cannot see an assertion invalidated in an untouched file
    severity: degrading
    fp: 80b75fa2638d
    first_seen_at: "2026-08-07T06:16:23.180Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-010
    kind: difficulty
    description: |-
      The renderer-authority guardrail was violated by its own author within minutes of writing it: muscle-memory 'harness plan render' after switching to the local bin regressed all banners; caught by local dd build --check (E422), repaired same beat. The guardrail needs a MECHANICAL enforcement, not discipline — candidate: a repo-local shim or just recipe that shadows the render path
    severity: degrading
    fp: 753b6bfc758c
    first_seen_at: "2026-08-07T06:18:41.467Z"
    disposition: kept
    system:
      compound:
        status: open
  - id: DL-011
    kind: difficulty
    description: |-
      git add -A in a repo where the PM's delegation flow leaves .dlg-* worktrees stages them as unresolvable gitlinks; caught only by reading git's embedded-repo warning. Fixed by ignoring .dlg-*/ — mechanical enforcement, since every agent doing git here can hit it.
    fp: a0a50190cd5f
    first_seen_at: "2026-08-07T06:40:15.965Z"
    disposition: fixed-now
    resolved_by: e1c47d8
    system:
      compound:
        status: encoded
system:
  compound:
    bubble_action: "all-save"
---
