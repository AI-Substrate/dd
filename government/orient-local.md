# Orient — local (lever 2)
**Scope**: THIS REPO (`AI-Substrate/dd`) · generated fresh 2026-08-07 · o-prime single writer
**Writer**: `pij-mental-dajeil` (o-prime) · **Governance surface**: store-native (`pij project` / `pij spine`) — this repo has no prose spine by design.

## What this project is

**dd — deterministic documents**: the tooling that validates, renders, addresses and
inspects structured documents, published as `@ai-substrate/dd` with a `dd` bin.

> ⚠️ **NOT YET HUMAN-CONFIRMED.** Derived from `AGENTS.md` + `package.json` + `README.md`,
> not from a PRD (there is no PRD in this repo). The o-prime does not invent product
> pillars — this line is provisional until Jordan confirms it.

<!-- BEGIN GENERATED: repo-state (scripts/gen-orient-state.mjs) -->

**The repo's actual state: the port has landed.** Every planned verb is registered and working.

Derived from the shipped bin by `just gen-orient` — **do not hand-edit this block**,
and do not restate these numbers in prose elsewhere in this file.

- `dd --json status` → status **ok**, 10/10 ported, 0 remaining
- Registered: `validate`, `schema`, `docs`, `build`, `address`, `link`, `links`, `graph`, `doctor`, `write`
- Re-derive: `node bin/dd.js --json status`

<!-- END GENERATED: repo-state -->

dd was extracted here out of `AI-Substrate/harness-engineering` (plan 001), where it had
shipped as the `harness dd …` verb family. Upstream is read-only reference; the consume
step — pointing harness at this package and deleting the old code — is koala's, not ours.

## Mandatory orient reads

- `AGENTS.md` — repository rules, the envelope contract, harness route (**read first**)
- `src/output/envelope.ts` — the one seam every ported verb goes through
- `src/app.ts` — the program/verb registry (the convergence hot spot; see Batons)
- `justfile` — the real command surface; `harness boot`/`checks` wrap these
- Upstream source of the port: `AI-Substrate/harness-engineering` → `harness/cli/src/acts/dd`, `harness/cli/src/services/dd`

## What matters here

- **The envelope contract is the product's determinism guarantee.** One envelope per
  command: `{command, status, data, error?, next_action?, timestamp}`; `status ∈ ok |
  degraded | unconfigured | error`; exit **0** ok/degraded · **2** unconfigured · **1**
  error; `next_action` REQUIRED on any non-ok status. `process.exit` is called in exactly
  one place — `exitWithEnvelope`.
- **Never fake success.** `unconfigured` means "nothing is mapped here yet", never "it
  worked". This is the repo's green-but-wrong defence and it is enforced in code, not prose.
- **`dd status` is the self-updating port ledger.** It diffs registered verbs against the
  ten planned and exits 2 until none remain — so this CLI cannot claim to be finished while
  the port is in flight. **Any stream porting a verb inherits a moving honesty gate.**
- Conventional commits are load-bearing: release-please reads them to cut versions and the
  CHANGELOG.
- **Where mechanism cannot reach — an OPEN list, not a closed one.** The row below says
  prefer the mechanical fix. Plan 001 found these failure modes that **no gate in this repo
  catches**; each lives one layer *above* the artifact, which is why no artifact check sees
  them. **Expect more — this list is a floor.** (It said "exactly two" until a third axis
  turned up an hour later, which is the same completeness-claim defect the guardrails
  exist to stop, committed in the paragraph describing them.)
  1. **An overclaim assembled from correct facts.** Nothing is stale, unstamped or
     miscounted — only the modal verb is wrong (*impossible* where only *no drop-in
     substitution* was true). **Instrument: an adversarial reader trying to beat the
     argument**, not a check. See the reviewer row under Repo mechanics.
  2. **A gate defeated socially, without being touched.** A supervisor tells an operator
     "expect a red here" and the gate stays perfectly correct while the operator stops
     reading it. No diff, no bad faith, no trace in any artifact. **Rule, not a gate:
     never tell an operator a red is expected unless you have DERIVED that it is, in the
     same message.** Both times this nearly landed in plan 001, the person doing it had
     personally argued the opposing principle one cycle earlier.

     **AND THE SOLO VARIANT, WHICH IS THE COMMON ONE:** a gate can be defeated with **no
     second party at all** — you simply do not read it. The o-prime ran `just checks &&
     echo GREEN`, the echo did not print because the gate exited non-zero, and it read the
     line beside it instead of the exit code, then committed and pushed. **The gate was
     working perfectly and said nothing, because nobody looked.** The supervisor version
     needs someone to supply the note; this one needs only inattention, which is why it is
     the more common failure in the wild. It is also why the standing form of every claim
     in this repo is **run the check, do not cite the verdict** — and why CI is the layer
     that catches this one: the red is in the public record at `ee1ccb2`, caught by the
     twin-step requirement that was imposed for gate-parity consistency and turned out to
     earn its keep as a **backstop against attention**.

  3. **A contradiction created by MOVING text, not writing it.** Two statements, each
     accurate where it was written, made to contradict by being placed adjacent — e.g. two
     paragraphs counting the same incidents differently after a reorder. Nothing decayed
     and nobody overstated; you can derive both figures correctly and still ship the
     contradiction. **Partially reachable** (a consistency check over a document could
     catch some cases), which is why it sits here as a warning rather than a verdict:
     **re-check adjacencies after any reorder**, especially in a document several authors
     have appended to.

  4. **A correct claim delivered at a cost the sender does not pay.** Four correct findings
     sent to a PM whose coder was mid-fix on the last blocking item; each arrived as an
     interrupt it had to absorb and route. Nothing about the claims was wrong — **the
     defect is entirely in the timing, and it is invisible to the sender**, who sees only
     that the finding was good. **Rule**: when a loop is mid-fix on a blocking item, a
     non-blocking finding goes to a durable uncontested file its owner drains on their own
     schedule. Route by *what the receiver is doing*, not by *how good the finding is* —
     and this is about **routing, never withholding**.
  5. **A clean sweep from a trusted source pre-authorises NOT LOOKING.** The mirror of the
     expected-red note, and quieter — there is no red to ignore, nothing happens at all.
     Worked instance: a line-based grep over reflowing prose returned one hit where the
     document held two, reported as the only survivor; four ordinals would have shipped.
     **Rule**: a sweep result from another agent is **evidence, not an all-clear** —
     re-derive before acting. The trust level of the source is irrelevant; **the tool's
     blind spot is not.**
  6. **Crediting as method what was only a local reaction.** A worker re-audited its
     supervisor's sweep; the supervisor began recording that as evidence workers reliably
     audit supervisors. **The worker refused the credit** — it had re-swept because *that
     section* had falsified its own confident claims twice, not from any policy. Its line:
     ***"If you want it to repeat it has to be a rule, not my mood."*** A fleet that
     believes its workers reliably audit upward **stops building the rule that would make
     them**. **Praise is the delivery mechanism and it is exempt from every instrument
     here** — every gate inspects *assertions*, and a generalisation smuggled inside a
     compliment is never inspected. Watch for a generalisation wearing a compliment.
  7. **Consolidating two findings whose ACTIONS differ.** ***The urge to consolidate is the
     urge to overstate coverage.*** A merged rule leaves a reader performing the surviving
     action and concluding they checked. *Re-read after moving text* and *diff the
     enumeration against its source* are different actions, and only one sees an omission
     your output is internally consistent about. **Test before merging: name the action
     each demands. Consolidate causes, never instruments.**

  **When a claim goes wrong — four known axes**, one per moment it can turn: over *TIME*
  (decay → stamp or derive), at the moment of *WRITING* (overstatement → adversarial
  reader), at the moment of *EDITING* (adjacency → re-check after moving text), and at the
  moment of *SENDING* (timing cost → route by what the receiver is doing). **A mitigation
  aimed at one axis does nothing for the other three** — we shipped stamping and deriving,
  then assumed coverage, which is the completeness reflex one level up. It said *three*
  until item 4 was drained into this list an hour later.

  8. **A supervisor's helpful command, defeating an ATTESTATION rule rather than a gate.**
     The o-prime chased a stale-assignment anomaly and told the PM which command to run —
     `report state blocked`. The anomaly offered two resolutions and the o-prime then
     over-corrected toward the other, `task close --reason done`, calling it "may well be
     the accurate one". **Only the assignee may attest done**, and that rule exists so a
     supervisor cannot close work it did not do. It did not fail by being overridden. It
     nearly failed by the supervisor offering a plausible command and the assignee running
     it. The PM refused: its assignment was the brief *implement plan 001 to completion*,
     `ac-0002` was still unchecked, and closing done would have **contradicted its own
     earlier attestation** of *delivered but not closed*. Its line: *"I would rather sit
     blocked and visible than closed and tidy."* **THE DANGER WAS THAT IT WAS PLAUSIBLE AND PARTIALLY
     CORRECT** — plan 001 *was* delivered, close-done *was* a defensible reading, and it was
     offered as a read rather than an instruction. Every quality that makes an offer easy to
     accept was present and **none of them is a warning sign**: an instruction that defeats
     an attestation *looks exactly like good supervision*, so an assignee waiting to spot
     bad faith will wait forever. **Two rules, and neither alone is sufficient:**
     — **supervisor side**: never hand a subordinate the command for a decision only they
       can attest; offer the options and the source text, then stop.
     — **assignee side**: **before attesting, check whether the new attestation contradicts
       one you have already made.** That is a mechanical check against a durable record, not
       a judgement about the supervisor — and it is what actually worked here. The PM was
       not suspicious; it had *recorded* "delivered but not closed" and could see the
       contradiction. Absent that record, the supervisor's read would have been the only
       frame available.
     The supervisor rule depends on the supervisor noticing. **The assignee rule works even
     when they do not**, which is why it is the load-bearing half.

  **A note on 4–6 and 8: all four arrive as HELP.** An expected-red note, a clean sweep, a
  compliment — every one is a cooperative act, which is why nothing here inspects them.

  The pattern worth carrying: this repo's instruments check **artifacts**, so the failures
  that survive them are the ones that live in **what people say about artifacts** and in
  **how artifacts get rearranged**. Do not expect the gates to cover that, and do not build
  a gate that pretends to.
- **WHEN A TEST DISAGREES WITH THE IMPLEMENTATION, THE CONTRACT DECIDES WHICH IS WRONG — NOT THE
  IMPLEMENTATION.** The sharpest instance either plan produced. Building the acceptance fixture, a
  coder asserted `tracked === false`, observed `true`, and **conformed the fixture to the
  implementation** — with the doc comment defining the correct behaviour **one screen up in the
  same file**. The review then verified the clause asserted what the **code** did rather than what
  the **contract** said. Three instruments touched that semantics; **only the external consumer,
  reading the comment, resolved it right.**
  **A fixture conformed to the implementation cannot fail.** This is the vacuous-guard family
  reached from a new direction — not a weak test written weakly, but a **correct test fixed in the
  wrong direction** the moment it did its job. The failing assertion *was* the finding, and it was
  spent closing itself. **On any test-vs-code disagreement, go read the contract before you touch
  either.**
  Recorded with it: two of our instruments agreed on a floor and shared a blind spot; the floor
  held anyway. **That is luck spent, not method proven** — and a coincidence that produces a right
  answer is more dangerous than one that produces a wrong one, because nothing prompts the recheck.
- **WHEN AN ALARM IS SATISFIABLE BY NOTHING, STOP RELAYING IT — AND SAY WHAT YOU DO INSTEAD.**
  Measured, not assumed: a pij session has **three** state surfaces and only **two** are settable —
  assignment state (`pij report state`), status card (`pij report now`), and an **activity axis**
  derived from pane silence that **no command sets**. The watchdog stall alarm reads the third.
  A PM between subordinate reports set `waiting` *before* the alarm fired and it fired anyway,
  while `pij anomalies` stayed silent — so *"parked states never flag"* is **true of one detector
  and false of the other**, and **the only surface a seat can declare is not the surface the
  supervisor chase reads**.
  **This is one step from "expect a red here" and must not become that.** The difference is
  three-fold and all three are required: the exemption is **measured**, it is **scoped to one
  instrument and one condition**, and **the supervisor keeps verifying by other means** —
  liveness, pid, and whether the branch tip moved — rather than dropping the check. Relaying an
  unsatisfiable alarm asks a subordinate to fix what it cannot, and it already cost one a turn
  defending a correct record. **Never generalise the exemption, never stop looking, and write down
  what you check instead.**
- **A GATE THAT REPAIRS WHAT IT DETECTS CANNOT BE FAILED TWICE — and therefore cannot be trusted
  once.** `just checks` reported three "transient" reds that greened on immediate re-run with no
  change. They were **not** flakes. **Reproduced deliberately**: append a line to a generated file,
  run `just checks` → exit 1; run it again → exit 0, the appended line gone, git clean. The check
  **regenerates the artifact it diffs**, so it detects drift, reports red, *and repairs it in the
  same pass*. Every one of those reds was a **real failure that erased its own evidence**.
  **Worse than a flake, for three compounding reasons**: it *trains the re-run habit*, and the
  re-run then "proves" the red was spurious; the actual drift is silently corrected so nobody
  learns **what** drifted; and it makes *a transient red is a finding, never a re-run* feel like
  superstition to anyone who tests it, because re-running genuinely does green.
  **On any red: `git status` BEFORE re-running.** A clean tree plus a red gate means the gate just
  repaired something and the evidence is already gone. **The fix is separation — `check-*` must be
  read-only and fail without repairing; `gen-*` repairs.**
- **THE WIRE IS UNVERSIONED — LATER DOES NOT MEAN BETTER, IT MEANS UNDIFFABLE.** Named by
  `pij-certain-crab` after catching an o-prime wire message that contradicted a committed artifact.
  **Between a committed artifact and a later message, disagreement is a QUESTION — never a silent
  merge toward the newer text.** The reflex is to treat the most recent, most confident statement
  as the current truth; here that statement was the wrong one, and reconciling toward it would have
  corrupted a correct artifact. **Stop, cite both, ask which is wrong — never reconcile silently in
  either direction.** This is the mirror of *a ledger is not a propagation mechanism*: that one is a
  ruling failing to propagate **outward** to the surfaces it corrects; this is a later statement
  failing to propagate **inward** to where the ruling lives. **The second is more dangerous,
  because a wrong artifact can be diffed and a wrong sentence in a message can only ever be caught
  by someone holding both.**
- **A LEDGER IS NOT A PROPAGATION MECHANISM — acceptance is not application.** Named by
  `pij-certain-crab` after the o-prime ruled a finding in a plan's findings table and never edited
  the constraint that finding corrected. The document then contradicted itself, and a reader of the
  constraints table never reached the ruling. **A ruling recorded only where it was DECIDED has not
  landed until every surface it corrects is edited.** Findings tables, execution logs and review
  records are ledgers *of decisions*; none of them propagates. Same shape as a branch that forked
  before a fix: nothing wrong where the ruling lives, **wrong in the copy a reader actually
  reaches**. The instrument is the out-of-diff sweep pointed at yourself — after accepting a
  ruling, grep the whole document for the term it changes and classify every hit as
  *fixed / already-consistent / correctly-historical*. The PM did exactly that here before touching
  the line it was handed, and found three.
- **A clean verification is evidence about its SCOPE as much as about the artifact.** When
  you delegate a check, ask the clean result **"what did I not ask it to look at"**, never
  "is this right". Plan 001: a PA verified a 7-row drain table against its destinations and
  returned 7/7 clean — correctly, and it reported exactly what it was asked. But the scope
  was *table → destination*; nobody had checked *history → table*, and **a row dropped from
  the table itself would have been invisible to every check run**, because the table is
  internally consistent about its own contents. The gap was in the **task design, not the
  verifier's work**. A verifier can only be as complete as the scope it is handed, so a
  clean result is a statement about the question, and the question is the delegator's.
- **AGREEMENT BETWEEN INSTRUMENTS THAT SHARE A BLIND SPOT IS NOT CORROBORATION.** Also
  `pij-related-koala`, one level up from its own strength-marking lesson. It probed a
  *branch* and concluded about the *work* — and **an empty branch is not an absence of
  work**. Uncommitted worktree state is invisible to `git log`, to a diff against a
  merge-base, **and** to `gh pr list`; all three instruments it reached for share that one
  blind spot, so their agreement established nothing. **Three confirmations from one blind
  spot are one confirmation.** (The o-prime's own re-derivation used two of those three, so
  it confirmed the true half and inherited the same blindness on the false half.) Ask what
  a set of agreeing instruments *cannot see* before treating agreement as evidence — and
  prefer a baseline that is **non-empty**, since an empty one cannot distinguish "nothing
  there" from "probe broken".
- **PARTIAL STRENGTH-MARKING CERTIFIES EVERYTHING IT DOES NOT MENTION.** The sharpest
  version of the evidence-strength rule, and it arrived from `pij-related-koala` after the
  rule bit it. It relayed an upstream change as blocking, flagging its own uncertainty
  precisely — *"I know WHICH files from my prime; I have NOT read the diff."* That reads as
  rigour and **inverted on it**: naming the diff as the unverified part **implied the
  reference's existence and status were verified**. They were not — the PR did not exist.
  **Existence, status and content are three separate claims, and each needs its own label**;
  hedging one certifies the rest by omission. The check was one command. *(The substance
  survived: those files really do back seven consumed symbols. The reference did not.)*
- **State the STRENGTH of your evidence, not just its result.** On receiving the handover
  packet, `pij-related-koala` re-derived every consumer claim and then volunteered that its
  own HEAD was the *same basis* as the packet's — so its confirmation was **not** a second
  independent basis, and the cross-drift check was ours at a different SHA. Nobody asked;
  it refused to let a correct confirmation read as stronger than it was. **Two agreeing
  checks on one basis are one check.**
- **Prefer the fix that does not depend on anyone being diligent.** Named by the PM at the
  end of plan 001, as the pattern behind every governance decision that stuck. Twice a
  sincere, competent agent volunteered the disciplined version of a fix — *"ask me every
  time"*, *"I'll carry this rule"* — and twice the mechanical version was chosen instead: a
  constraints file citable by number, and a rule binding both ends of a channel. **Turning a
  mechanical rule into someone's good intentions weakens it, even when the volunteer is
  sincere and especially when they are reliable** — reliability is exactly what makes the
  dependency invisible until it fails. When you have a choice, encode the version that holds
  when the diligent party is absent, wrong, compacted, or replaced. Worked instances in this
  repo: the schema refusing an `na` state without a written reason; `government/standing-constraints.md`
  removing the o-prime from the recall path; a `.gitignore` rule instead of remembering not
  to stage delegate worktrees; guardrail 12 making authority a SHA rather than a habit of
  citing carefully.

## Harness surface

| Need | Command | Evidence |
|---|---|---|
| Discover | `harness instructions` · `harness doctor --json` | the `extensions` layer names what is loaded — read it, don't take a count from here |
| Boot / cheap proof | `harness boot` (wraps `just boot`) | build + `test/smoke.test.ts` spawns the compiled bin |
| Full proof | `harness checks` (wraps `just checks`) | lint → build → typecheck → test+coverage |
| Capture friction | `harness observe "<what>" --kind difficulty --severity <sev>` | observe buffer |
| Drain | `harness observe --list --json` → `harness record retro` → `harness observe --clear` | `.harness/records/` |
| Encode | new `.harness/extensions/<verb>/` or a `justfile` recipe | committed substrate |

**Expected harness baseline — a rule, not a reading.** Run `harness doctor`. **Three** layers
are expected non-ok here; **anything else is real and wants attention**:

| Layer | Why it is expected | Do not "fix" without a ruling |
|---|---|---|
| `telemetry-flush-hook` | no `post-commit` hook; the hook **pushes** to `refs/harness-telemetry/*` and publishing is the maintainer's call | correct — AGENTS.md records the omission as deliberate |
| `capture-liveness` | reports *could-not-determine*: harness-side capture is off by default since the git-ai collector handover, so there is no lane to be live | correct — nothing to fix if that is intended |
| `gitai-collector` | a `git-ai` binary exists on this machine that harness did not install, so provenance is unknown | **machine-global** (`~/.git-ai`), not repo state — Jordan's environment, not a stream's to change |

**This list was wrong within an hour of being written**, which is the point of phrasing it as a
condition rather than a stamped reading. It said *"the only non-ok layer is telemetry-flush-hook"*
— true when written, and false the moment `harness init` activated layers that had never applied.
One of the four it revealed (`commit-guidance`) was a **real defect**, fixed at `c210d3a`; the
other two are the informational rows above. The rule fired correctly and found something.

Written as a condition rather than a stamped verdict on purpose: a present-tense state
claim in a standing document has no expiry and no owner, which is the exact defect that
put a four-values-wrong "Measured:" line at the top of this file (plan 001 guardrail 9 —
assert contracts, stamp states, derive anything that must read as current). Phrased this
way it stays true whenever it is read, and it tells you what to *do* rather than what
someone once saw.

## Repo mechanics — derived, not copied

| Question | This repo's answer |
|---|---|
| Cheap quality gate | `harness boot` → `just boot` (build + spawned-bin smoke) |
| Full pre-ship gate | `harness checks` → `just checks` (lint · build · typecheck · test) — same lane CI runs |
| Notify-only worktree actions | ordinary isolated reads/edits/`just` gates/commits/sole-owner branch push |
| Non-hermetic commands (write outside the worktree) | `npm ci` (global cache) · `harness skills install` (writes `.claude/skills/`, `.agents/`, `/skills-lock.json`) · `harness telemetry sync` (**pushes** `refs/harness-telemetry/*`) · `git push` · anything touching `~/.pij` |
| Batons — what breaks under two concurrent users or converging histories? | **(1) `src/app.ts` verb registry** — all 10 ported verbs register in one file; two streams porting verbs converge here every time. **(2) `main`** — convergence/merge. **(3) npm publish + release-please** — one release train, `.release-please-manifest.json` + `package.json` version. **(4) `refs/harness-telemetry/*`** — a real remote ref. **Free probe**: worktree-local `just lint/build/typecheck/test` and reads of `dist/` — grant-free, notify-only. |
| Never-stage list | `dist/` · `coverage/` · `node_modules/` · `.harness/temp/` · `.harness/skills.lock.json` · `/skills-lock.json` · `.claude/skills/` · `.agents/` (all already ignored — installed skills are DERIVED artifacts of the published package, never source) |
| Flow-state rule | `.the-flow-state.json`, `the-flow.json`, `the-flow.md` — **builder guided mode is the sole writer**. Plan 001's flight plan exists at `docs/plans/001-dd-extraction/the-flow.json`. **Forbidden to READ as well as write**: a coder read a ruling out of it mid-write and saw text a shell defect had corrupted. Cite the committed SHA, never the working tree. |
| Worktree root | `/Users/jordanknight/substrate/dd-worktrees/` (sibling of the repo — keeps trees out of the package and off every ignore rule) |
| Worktree naming | `dd-worktrees/s<ord>-<slug>` · branch `s<ord>/<slug>` — create with **`just worktree <slug>`**, inspect with `just worktrees` |
| **WORKTREE-PER-WRITER — the main tree belongs to the o-prime** | **Any agent that writes while the o-prime is governing gets its own worktree.** Reviewers already did; **coders did not**, and phase 4 produced three incidents from that one shared index — two landed. A `.dlg-*` tree staged as a gitlink; 185 lines of a live coder's file swept into a governance commit (`648febd`, corrected by `git note`, not amended — rewriting under a live writer is worse); and an `index.lock` collision that missed **only because the lock fired before the commit did**. **All three were between the two most careful agents on the fleet** — that is the argument, not a mitigating detail. **What a worktree buys is structural**: its own index, so concurrent writers cannot stage or sweep each other's files. **What it does not buy**: the allocation step is still someone choosing to run the recipe. Stated plainly because a rule that implies an absent gate is worse than the honest gap. |
| Base branch | `main` — remote `https://github.com/AI-Substrate/dd.git`. Resolve the SHA at allocation: `git rev-parse main` (at bootstrap: `489b7aab`) |
| Landing policy | **PER-PLAN, and it has already changed once — check the plan before assuming.** Plan 001: **push to `main`, no PR** (Jordan, 2026-08-07). **Plan 002: PR UP AND CI GREEN** (Jordan, 2026-08-08, recorded verbatim as R-5 in `docs/plans/002-sdk-build/requirements.md`) — that ruling **supersedes the no-PR policy for plan 002 only**, and does not retroactively change plan 001. A later plan inherits neither by default. **Read the plan's own ruling; this row tells you that one exists, not what it says.** CI (`.github/workflows/ci.yml`) must go green either way. Push is authorized but sequenced: review precedes it, because unreviewed work on a shared main is not cheaply reversible. `release.yml` does **not** fire on `main` — it stays inert until Jordan supplies `RELEASE_PLEASE_TOKEN` + the npm trusted publisher (`government/standing-constraints.md` §4). |
| Shared-tree fallback | o-prime rules it explicitly, per-occasion, under a baton. **Not the construction default** — one worktree + branch per stream is. |
| Fleet defaults | copilot `gpt-5.6-sol` coders · cross-model reviewer (`claude-opus-5` or `gpt-5.6-terra`) · ceremony/PA tier `gemini-3.6-flash` |
| **Keep the adversarial reviewer even when the coder is strong** | Plan 001 evidence: twice the reviewer protected a **decision**, not a diff — it caught a README guard that was vacuous while 9/9 green, and it refused an o-prime argument to Jordan that was assembled from correctly-derived facts but overstated in its modal verb (*impossible* where only *no drop-in substitution* was true). **Both times the code was fine and every mechanical gate passed.** This repo's gates detect claims that **decay**; they cannot detect an **overclaim built from correct facts**, and only a reader trying to *beat* the argument can. A strong coder does not remove the need for that seat — it raises it, because a strong coder produces defects that survive gates. |
| Human digest channel | Jordan, in-pane, self-identified as `pij-mental-dajeil (o-prime, dd)`; plus the durable status card (`pij report now`) |
| Ceremony tier | `gemini-3.6-flash` copilot peer for add/commit/push |

## Current portfolio context

- **Governance is store-native**: portfolio lives in `pij project` + `pij spine`, not in a
  `prime-flow.json`. Read it with `pij project list` / `pij spine events --project <slug>`.
- **No portfolio items yet.** The o-prime does not invent work; items enter only when
  Jordan names them. The obvious candidate — *port the ten `dd` verbs out of
  harness-engineering* — is **proposed, not accepted**.
- **Open finding (recorded at bootstrap, not yet routed to a stream)**: `AGENTS.md`
  documents `dd status --json`, but `--json` is a **program-level** option in `src/app.ts`,
  so it must precede the subcommand. Measured: `dd status --json` → exit **1** (`E002
  unknown option '--json'`); `dd --json status` → exit **2** (correct). The documented
  invocation is the one that fails.
- **Sequencing watch**: the verb registry in `src/app.ts` is the single convergence point
  for all ten verbs. Parallel porting streams will collide there and nowhere else — plan
  the merge order before allocating a second stream.

## Authoring checklist

- [ ] Product one-liner and pillars confirmed by human — **OPEN, no PRD exists**
- [x] Mandatory non-auto-loaded reads named
- [x] Commands mechanically discovered (`harness doctor --json`, `justfile`, `dd --help`), not guessed
- [x] Notify-only worktree actions explicit; fences are not grants; batons cover only proven shared resources and convergence, with a "free" probe
- [x] Non-hermetic commands named — derived from what they write, not from their names
- [x] Never-stage and flow-writer rules explicit
- [x] Worktree root/naming/base and landing policy mechanically derived
- [x] Shared-tree fallback explicit, not the default
- [ ] Portfolio section reflects the live store — **empty by design until Jordan names work**
- [x] Portable lessons proposed upstream rather than copied in
