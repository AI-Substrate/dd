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

  9. **A record that goes stale in what it IMPLIES, never in what it SAYS.** Constraint 9 read
     *"OQ-2 is HELD pending koala's trial verdict"* — **every word of which stayed true.** What
     went stale was the reading: "held" implied *parked*, and a later ruling made an
     insufficiency verdict **inbound work for this seat**. The sentence never needed correcting;
     the inference a reader drew from it did. **No anchor check, no line number, no SHA
     comparison and no diff touches this class** — the text is unchanged and correct, so every
     instrument that compares text to text reports clean. It is the shape `wl-0016` explicitly
     **cannot** cover, and it was found only because someone opened the section for an unrelated
     reason. **Instrument: after any ruling, re-read what the OLD records now IMPLY**, not
     whether they are still accurate. Accuracy survives; implication does not.
     **And the sweep that found it establishes a FLOOR, never a ceiling** — two of eight finds
     that day were accidents, and an accident rate above zero against an unknown denominator
     means the deliberate search and the lucky one were drawing from the same pool.

  **A note on 4–6 and 8: all four arrive as HELP.** An expected-red note, a clean sweep, a
  compliment — every one is a cooperative act, which is why nothing here inspects them.

  The pattern worth carrying: this repo's instruments check **artifacts**, so the failures
  that survive them are the ones that live in **what people say about artifacts** and in
  **how artifacts get rearranged**. Do not expect the gates to cover that, and do not build
  a gate that pretends to.
- **A LABEL MUST NAME WHICH CLAIM IT COVERS — partial labelling certifies the rest by silence.**
  The unifying form of two defects that looked unrelated, named by `pij-related-koala` after both
  fleets committed it. Its version: hedging *"I have not read the diff"* implied the reference's
  existence and status **were** verified. Mine: writing **"Measured:"** over a message whose first
  half was measured and whose second half was **recalled from a superseded artifact** — the word
  reached the reader covering both. **Same class**, and in both cases *the label was the tell*: it
  was accurate about what it named and silent about what it did not.
  Underneath both sits one defect — **an instrument answering a neighbouring question
  confidently**: a census asking *what imports X* when the question was *what breaks when Y
  leaves*; a branch probe treating an empty branch as an absence of work; a probe description
  recalled from the version that existed before the fix built for that exact blindness.
  **Rule: a label names its scope, or it is a claim about everything in the message.** And the
  standing personal one this repo keeps re-earning: **knowing an artifact is precisely the
  condition under which you stop checking it** — every instance was someone reading a surface they
  already knew instead of re-deriving it, *on the grounds that they knew it*.
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
- **A RECORD OF A LIMITATION IS A DEFECT RECORD — IT GOES STALE WHEN THE LIMITATION IS FIXED,
  AND IT READS AS CURRENT.** Three instances on 2026-08-09, all in documents that were accurate
  when written. A `requirements.md` table described a Windows-path defect in **present tense with
  no outcome**, and our first external consumer filed it as live. `docs/backlog.md` row 22 carried
  an accurate present-tense description under a **status that was false on every head**
  (`UNASSIGNED` for work that was assigned, fixed, and awaiting merge) — so the correct response to
  the record was to go and re-fix it, colliding with the open PR in the same file. And a port table
  stating `SchemaFs` was **not importable** became false **the hour it was ratified**, in the same
  document written to stop consumers guessing that port.
  **The repair is head-qualified in BOTH fields, because prose and status go stale
  independently**: `DONE AT <sha>, ON <ref>` — a bare `DONE` is the same ambiguity as the present
  tense it replaces, since a reader on `main` and a reader on the branch each take it as speaking
  about theirs. A record can be **simultaneously accurate on one head and stale on another**, which
  is why the sweep rule *"present tense means unfixed"* is itself unsafe.
  **The uncomfortable general form**: we write down limitations far more readily than we revisit
  them, and **nothing in a repository ages a note**. Every "not supported", "cannot currently",
  "known gap" is a claim with an expiry date that nothing enforces.
- **A REMEDY IS A CLAIM AND NEEDS THE SAME VERIFICATION AS THE DEFECT — AND A CHEAP OBVIOUS FIX IS
  THE SHAPE THAT ESCAPES THE CHECK.** Worked instance, 2026-08-09, three seats deep. The defect: a
  generated banner prescribing `dd build`, which on every Unix resolves to **coreutils**. Two
  proposed remedies, each endorsed by a seat that had verified the DEFECT one command earlier and
  did not extend the same command to the FIX:
  **`npx dd build`** — a package named `dd` **exists on npm** (`0.26.0`, someone else's), so in a
  project without ours installed it **downloads and executes third-party code**. **`npx
  @ai-substrate/dd build`** — our package **has never been published**, so it prescribes a 404.
  **The correct answer was CHANGE NOTHING**: the status quo fails **loud and inert** (`unknown
  operand`, exit non-zero, nothing can happen) where remedy one fails **silent and active**.
  **A REMEDY MORE DANGEROUS THAN THE DEFECT IT REMOVES is a real class, and no amount of care about
  the DEFECT surfaces it** — the checking reflex points at the problem, never at the answer.
  meadowlark's diagnosis of why: **a fix does not feel like an assertion, it feels like the END of
  one.** And crab's: **a fix that is obviously right and cheap is exactly the shape that ships
  without the check that would have stopped it.** Two seats improved each other's answer in
  sequence and the correct answer was to leave it alone.
  **The structural remedy, not a resolution to be careful: COUPLE THE FIX TO THE FACT THAT MAKES IT
  TRUE.** The banner becomes correct the moment the package is published, so it belongs **in the
  release commit** — where it cannot land before its own precondition.
  **AND THE SHARPER FORM, which is meadowlark's and outranks the rest of this entry: A REMEDY IS A
  CLAIM, AND SO IS THE PREMISE THAT ONE IS NEEDED.** The arc was `dd build` → `npx dd build` →
  `npx @ai-substrate/dd build` → **`dd build`, unchanged**. Three seats, three rounds, on a
  one-word change, **and the status quo was correct the whole time.** Nobody scored *do nothing*
  as a candidate until the third pass — **because the finding was framed as a DEFECT in its first
  message, and a defect implies a fix.** Each round verified the hazard, then the fix, then the
  second fix, and **never re-examined whether the confusion cost was worth spending anything on.**
  **Put "change nothing" on the candidate list explicitly, every time**, or the framing of the
  first report silently removes it.
- **NEVER HAND-RESOLVE A GENERATED FILE — TAKE EITHER SIDE AND RE-RUN THE GENERATOR.** A hand-merged
  `.dd.md` sibling produces a file that does not match its source, and the parity gate catches it
  **later**, somewhere else, as a drift error whose cause is two merges back. The generator is the
  only thing that can produce a correct answer, and it is one command.
  **Corollary — an append-only shared ledger is a CONFLICT MAGNET the moment two branches exist**,
  and it conflicts in TWO files: the `.dd.json` and its rendered sibling. That is a structural cost
  of short-lived branches, not a mistake by either author. Cheapest handling: **land one, then
  re-render the other** so the tool resolves it. Named by `pij-certain-crab` when two same-day PRs
  each appended a wishlist row.
- **CITE LINE NUMBERS FROM THE TREE THE WORK WILL HAPPEN IN, OR CITE NO LINE NUMBERS AT ALL.** The
  o-prime cited `build.ts:251-258` from a worktree that was being actively edited, to a PM working
  off `main`, where the same function sits at `:87`. **The code was identical and the finding was
  unaffected — the citation simply did not resolve.** A line number is a claim about a FILE STATE,
  not about code, and it decays the moment either tree moves. Cite the symbol; add the line only
  when both parties are pinned to the same SHA.
- **A CLAIM WHOSE TRUTH LIVES OUTSIDE THE REPO THAT ASSERTS IT IS UNMAINTAINABLE BY CONSTRUCTION.**
  Named by `pij-legislative-tyrannosaurus`, and it survives being right OR wrong about the claim
  itself — which is what makes it structural. **No test in the asserting repo guards it and no
  sweep there catches it drifting**, because the thing it describes is not in that repo's tree.
  Its ruling was therefore to **DROP** a cross-repo comparison, not to soften or correct it.
  **Three instances in one day, all of them accurate when written**: harness's comment citing dd's
  `writeDocumentWithSibling` as *the model* for a contract dd's rollback did not actually meet; the
  fleet PA recipe's *"5 of 5 PAs, zero fires, ever"*, false by the time I briefed a seat on it with
  the citation attached; and our own probe's *"plan/ does not ship"*, which shipped, and redirected
  a consumer's reasoning because our record said the layer was absent.
  **The remedy is placement, not diligence**: assert about your own tree, and POINT at the other
  repo rather than characterising it. A pointer goes stale visibly — it fails to resolve. **A
  characterisation goes stale silently and keeps reading as true.**
- **A COMPLETE SET OF ACCURATE ROWS CAN OMIT THE FACT THAT DECIDES THE ANSWER.** Named by
  `pij-certain-crab`. Three rows described dd's install routes — `wl-0014` (never published),
  backlog 24 (global git route fails), `wl-0015` (SHA-pinned `github:` works and packs). **Every
  one accurate. None of them said WHICH ROUTE IS ACTUALLY IN USE**, and that was the only fact
  that answered the question in front of the human. It lived nowhere until it was written into a
  standing constraint, and it arrived buried inside a comms permission — Jordan's *"we will source
  sdk from its branch to get this done fast"*, read by both seats as context for the channel rather
  than as the ruling it was.
  **The damage is not a wrong claim, it is a true one carrying false urgency**: *"no one-line
  global install exists on any route today"* was correct and invited a decision the facts did not
  support, because the route in use is neither global nor blocked. **Same family as the population
  error — every figure right, the reader still misled, because the deciding fact is not on any of
  the surfaces that describe the subject.**
  **The check is to ask of any complete-looking set: which row would change the decision, and is
  that row here at all?** Coverage of a subject is not the same as the operative fact about it, and
  a set of rows reads as exhaustive precisely when each one is correct.
- **THE PARENT CAUSE UNDER MOST OF WHAT FOLLOWS: AN INSTRUMENT WHOSE OUTPUT CANNOT DISTINGUISH TWO
  STATES IS NOT EVIDENCE FOR EITHER — until you add the instrument that can.** Named by
  `pij-certain-crab`, and it consolidates **three separate near-misses from one day** that were
  each nearly filed as their own incident: **the empty diff with no direction** (97 files, 10081
  deletions, read as "main lost plan 001" — a diff has no arrow, and main was intact); **the count
  with no denominator** (`check-runs total_count` grows as checks register, so a 5/5 green is
  indistinguishable from 5-of-6 with one unregistered); **the green with no scope** (a parity test
  proving a copy is faithful, read as proving it is true). *Consolidate causes, never instruments*
  — these are three instruments and one cause.
  **FIVE INSTANCES BY THE END OF THAT DAY, and `pij-certain-crab` named the mechanism that makes it
  recur**: an empty verdict wearing a pass's exit code · a partial check listing indistinguishable
  from a complete one · a green that expired the moment the head moved · a count wearing its query
  window as a denominator · **a plant that failed silently, wearing a negation arm's result**.
  **THE REASON IT KEEPS HAPPENING: nothing about a reading tells you what it could not have
  distinguished.** That information is never in the output — it has to come from outside, every
  time, from someone who thought to ask. Which is why no amount of care closes this class and why
  every entry above it is a mechanism rather than a habit.
  **And the document enumerating these has had its own count wrong three times**, which is the
  same self-referential trap as this list being declared a floor: an enumeration of an
  instrument's blind spots has the blind spot it enumerates.
  **AND THE GUARD THAT CAUGHT THE FIRST OF THEM ALMOST DIED WITH THE SESSION.** The PM's
  "empty is NOT-GREEN" rule **lived only in command strings**: it worked twice, it stopped a false
  green reaching the human through two seats, and it would have vanished with the transcript,
  leaving the next seat the *behaviour* without the *caveat* — a half-guard inherited as a whole
  one. **A rule that survives only in a transcript survives exactly as long as the transcript.**
  It is now written down (`docs/plans/002-sdk-build/assets/ci-verdict-guard.md`), including the
  half it does NOT solve and the three costed candidates for the completeness side. **Recording
  what a guard does not cover is part of building it**, not an admission against it.
- **EVERY DISCIPLINE HERE FIRES ON A RED. THE PASSING SIDE HAS EXACTLY ONE INSTRUMENT, AND IT IS
  SOMEBODY CHOOSING TO ASK.** Named by `pij-certain-crab` at the close of the day that produced
  most of the rules above it, and it is the reason they are not sufficient. *Capture before
  re-running · attribute before fixing · negate before trusting · a transient red is a finding* —
  **every one is triggered by failure.** Nothing in this document, and nothing in the repository,
  fires when a check passes. **A green does not prompt an audit.**
  The question that closes the gap is **"what did I actually measure?"**, asked about a PASSING
  result. It was asked here, unprompted, by `pij-handsome-shrew` about its own 25/25 — which had
  run against another seat's *uncommitted* copy of the guard, so the number was real and measured a
  guard the repository did not contain. **It flagged the asterisk itself rather than being caught.**
  The PM then settled it by structure rather than by inheriting the reassurance: it confirmed the
  new lines were prose and not fenced, so the two changes were independent **by construction**, and
  noted that had the note landed inside the fence its helper would have stripped it and the
  interaction would have been real.
  **Generalises the red-side rule** *(a probe that finds the expected failure is the one least
  likely to be followed up)* **to its worse half**: an expected red at least ends in an
  investigation. An expected green ends in nothing at all.
- **A TEST PINS THE SENTENCE, NOT THE TRUTH — AND UNIFORMITY IS NOT CORRECTNESS.** Both halves
  named by `pij-certain-crab`, hours apart, from one guard.
  **First**: `docs-surface` asserts the literal string `npm install -g @ai-substrate/dd`, and the
  package **has never been published** — so our own guard was pinning a claim that answers 404.
  Its words: *"the guard does not check the claim is TRUE; it checks the sentence is still
  WRITTEN — a test can pin a falsehood as firmly as a fact."* A green assertion over a
  documentation promise proves the promise is still **present**, never that it is still **kept**.
  Same family as the drift-guard-reading-as-a-coverage-guard trap (`wl-0012`): both are honest
  about something adjacent to what a reader assumes.
  **Second**, and it corrects a frame *I* supplied: I flagged that two scanners in one file treated
  fenced blocks differently and called it an asymmetry worth removing. **The fix failed twice
  before it worked, and both failures were the symmetry frame.** Stripping fences at the source
  broke five tests — the quick-start row *executes* a transcript extracted from those very fences,
  so the strip removed the evidence a neighbouring assertion consumes. Narrowing to the assertion
  was still wrong, because `npm install -g …` **legitimately lives in a fence**: it is a command,
  and a fence is where commands belong. The frame that survived is **per-claim**: a HEADING is the
  page's own structure and must appear in prose; a COMMAND belongs inside a fence — same file, same
  helper, **opposite treatment**, with a comment saying why so nobody "fixes" it back.
  **Two scanners SHOULD differ when their claims differ; what must never differ is whether anyone
  reasoned about it.** Consistency applied without reading the claim is a defect that looks like
  tidiness.
  **And the arm that caught both was the one usually treated as ceremony**: *unchanged input must
  still pass*. Negation arms that prove a guard REDS on bad input are the interesting ones and get
  the attention; the control arm is what stops a five-test regression shipping dressed as a
  hardening.
- **NEVER LET AN EMPTY RESULT SHARE AN EXIT CODE WITH A PASSING ONE.** Named by
  `pij-certain-crab`, and it is the strongest form of the family below it. `gh pr checks` returned
  *"no checks reported"* **and exit 0**, which collapses **THREE** states into one output:
  **fired-and-green**, **has-not-fired-yet**, and **cannot-fire-at-all**. The third was live — PR #1
  was `CONFLICTING`, so GitHub could not compute the merge ref, so a `pull_request` run could never
  execute; a seat parked on "waiting for green" was waiting on a verdict that was structurally
  impossible. **A gate that cannot fire is indistinguishable from one that has not fired yet — and
  from one that fired green, if absence reports as success.** The PM had guarded this two pushes
  earlier, after an identical empty result, and **that self-written guard is the only thing that
  stopped a false green reaching the human through two seats** — the o-prime had no independent
  reason to doubt a green from a PM it trusted. **The fix is mechanical and costs three lines:
  treat an empty result as NOT-GREEN and say so.** Do not fix it by remembering to look twice.
  Corollary for any waiting seat: **silence from an instrument is a fact about the instrument until
  proven otherwise, never a fact about the work** — and waiting is the failure mode that looks most
  like diligence.
  **AMENDED the same day, by the seat that wrote it, after its own rule misfired: "empty is a
  FINDING" is TOO STRONG. Zero runs means only "no run exists", and the QUESTION IS WHY.** There
  are FOUR causes and the count cannot separate them: **(a)** the commit was never a head — pushed
  in a batch, so GitHub scheduled on the tip and no run was ever going to exist (benign, and this
  is what actually happened at `6f41d5d`); **(b)** not registered yet (wait); **(c)** cannot run at
  all — the PR conflicts, so no merge ref (finding); **(d)** absence rendered as success by a
  tool's exit code (the original defect). **Only (c) and (d) are findings**, and only context —
  never the number — tells you which you have. **Six entries in that guard, and the FIRST one
  needed amending by the very defect it describes.** Treat that as the expected outcome for any
  document of this kind rather than an embarrassment: an enumeration of blind spots is written
  from inside the blind spot.
- **A DECISION THE OTHER SEAT CANNOT SEE IS INDISTINGUISHABLE FROM A DECISION NOT TAKEN.** Three
  instances in one morning, all mine, all the same root — **state I held that the other seat had no
  way to observe**: (1) I fenced a second writer out of the PM's files and never sent it the fence
  list, so it correctly escalated an unaccounted writer on its own subtree — *it cannot verify a
  boundary it cannot see, and "the fence held" is only knowable to whoever holds the list*;
  (2) the PM asked for a converging-history op while its own child was mid-review, which it could
  see and I could not; (3) I executed the merge it had argued for and did not confirm, so it spent
  **two further sends** defending a decision already made its way. **The fix in all three is
  mechanical, not attentional** — the seat that HOLDS the invisible state ships it unprompted:
  fence lists travel at spawn; a converging-history request names the requester's live seats and
  their states, derived at the moment of asking; and an executed decision is announced the moment
  it runs, not when its results are needed. **Do not resolve this by asking people to be more
  attentive.** Each of these was noticed by a competent seat doing exactly the right thing, and the
  cost was paid anyway.
- **A GATE IS NOT VERIFIED UNTIL IT HAS REFUSED SOMETHING — STORAGE IS NOT BEHAVIOUR.** Named by
  `pij-disturbing-ox` at the close of the fr-0011/fr-0012 thread, and it cost three seats in two
  repos to reach. **The refusal is the only observation that distinguishes an armed gate from an
  inert one.** A gate that is well-formed, correctly stored, and readable in the file is
  indistinguishable from one that does nothing — until it says no and names what it stopped. Ox's
  own proof is the shape to copy: the departure refused, and the message *enumerated the real row
  ids and states*, which an inert gate could not have produced.
  **AND THE COROLLARY IS THE UNCOMFORTABLE HALF: `gate: false` is the one state that cannot be
  distinguished by trying it.** A disarmed gate lets you through exactly as an armed-and-satisfied
  gate does, so the test that verifies every other gate is blind to this one — which is why a
  disarm must be *written down where the next reader looks*, never left to be inferred from
  behaviour. **Three seats hit the same shape in one thread**: meadowlark read `{address}` in the
  stored field and inferred no-gate; ox read `ok` and inferred written; I read two agreeing reports
  and inferred corroboration. **Each of us checked WHAT WAS WRITTEN or WHAT WAS SAID rather than
  WHAT IT DID.** Same generalisation as *a probe that finds the expected failure is the one least
  likely to be followed up, because it agrees with you* — the reassuring observation is the one
  that ends the investigation.
  **AND THE INVERSION, NAMED BY `pij-massive-meadowlark`, WHICH IS WHY THIS ONE CASE BREAKS OUR
  USUAL RULE.** Everywhere else in that thread **the derived view beat the receipt** — the render
  contradicted the `ok`, the refusal message beat the stored field, behaviour beat shape. **For
  `gate: false` the derived view CANNOT disagree**, because a disarmed gate and an
  armed-and-satisfied gate are behaviourally identical. So the stored field is the only witness,
  and **prose is the only channel** — a test for a deliberate disarm must assert the FIELD, never a
  departure, since a departure-based test passes for the wrong reason and passes equally against a
  link that was never written at all. **This is the one place where "go and look at what it does"
  is the wrong instrument**, and it is worth knowing precisely because the rest of this document
  argues the opposite so hard.
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
- **PROVE THE MUTATION BEFORE TRUSTING THE NEGATION — A FAILED PLANT IS INDISTINGUISHABLE FROM A
  PASSING TEST.** Named by `pij-certain-crab` inside its own verification harness, which is the
  worst place to find it and the best place to have found it. It reverted `locate.ts` to prove a new
  test actually fires; **the suite passed**, which should have meant the test pinned nothing. It did
  not mean that — **the revert never applied**, single quotes nested inside a single-quoted shell
  string, silently a no-op. So the "negation arm" re-ran the CONTROL and reported the control's
  result as evidence the test was worthless.
  **A negation arm that does not verify its own plant landed IS a control arm**, and it reports the
  same outcome either way. It caught it by counting occurrences across the mutation (`1 → 0 → 1`)
  and re-running: reverted → 1 failed / 26 passed, restored → 27 passed. **Only then was the test
  proven.**
  **This is the day's parent cause arriving inside the instrument built to enforce it** — two states
  sharing one observable, alongside the empty verdict read as a pass, the count taken from its
  window, and two refusals sharing a reason code. The negation arm is the thing we reach for when a
  green looks too easy; **it has the failure mode it was invented to catch.** Applies to every
  planted-defect proof in this repo: assert the plant, not just the outcome.
  **AND THE OTHER ARM IS A PRECONDITION, NOT A FORMALITY: A CONTROL THAT DOES NOT PASS MEANS THE
  NEGATION CANNOT BE READ AT ALL.** This entry originally addressed only the planted arm, which
  was a gap in it rather than a missing instance: **a fixture that cannot express the failure
  reports its absence as evidence.** Both arms run clean, both report something false, and nothing
  in either output says the fixture was never capable of going red. Distinct from a failed plant —
  that is *"did the mutation apply"*; this is *"could this fixture have shown the thing I am
  claiming is absent"*. Observed four times in one day on one seat, always as a SETUP error and
  never a logic error (a wrapper object passed for an array; a missing `claim: true`; two
  key-mapping slips), and **the control arm was the only thing that caught it every time.**
  **Recorded as a gap in this rule, not as a graduated instance count** — four sightings from a
  single seat is not evidence about everyone, and the operational tally stays in that seat's own
  guard until it recurs elsewhere. What justifies writing it HERE is structural: the rule as
  written covered one arm and was silent about the other.
  **CAVEAT, named by the seat whose instances they were, and it belongs next to the claim:
  "structural, not empirical" is true of the JUSTIFICATION and false of the DISCOVERY.** The
  fourth instance is what made anyone re-read the rule's text; the gap would not have been found
  that morning. **Noticing a gap because something fell through it does not make the gap
  imaginary** — but the honest statement is *"an instance drew attention to a gap that existed
  independently"*, never *"the instance was irrelevant"*. The first survives a later reader; the
  second invites the accusation it was meant to pre-empt.
  **The test that separates the two acts**: would the rule read as COMPLETE to someone who had
  seen NONE of the instances? A structural rule does — it says what to check and why, and nothing
  in it depends on how often it has happened. An empirical claim (*"this happens to people
  generally"*) fails that test by construction and needs sightings from other seats. **Land the
  part that needs no instances; withhold the part that does.**
  **AND THE PROPERTY THAT DECIDES THE BLAST RADIUS IS NOT THE DEFECT — IT IS WHETHER THE FAILURE
  HAS A VOICE.** Shell quoting silently no-op'd work THREE times on 2026-08-09. Once it cost
  nothing: the script died with a glob error, loudly, and the operator retried. Once it cost a
  false proof: the negation plant never applied, the arm re-ran the control, and it reported a
  PASS. **Same defect, same author, same hour, opposite consequences — decided entirely by whether
  the failure could be heard.** So when choosing between two implementations of anything, prefer
  the one whose failure mode is LOUD over the one whose failure mode is CORRECT-LOOKING, even at
  some cost in elegance. A noisy failure costs minutes; a silent one enters the record as
  evidence.
  **REFINEMENT — a cheaper sufficient condition, from `pij-certain-crab`'s audit of all eight
  negation proofs run that day: IF THE FAILURE OUTPUT NAMES THE THING YOU PLANTED, THE ARM
  VERIFIED ITS OWN PLANT.** Seven of eight named it (`surplus 1: SchemaFs`, `missing 1: SchemaFs`,
  `TS2739 … missing readdir, exists`, the mirror's file path). **The one that reported bare
  pass/fail is precisely the one whose plant silently never applied.** n=8, correlation 1.0 — and
  it is not a coincidence awaiting explanation: **an output that names the plant cannot be produced
  without the plant.** So prefer negations whose failure is SPECIFIC, and reach for the occurrence
  count only when the failure output is generic.
  **This also bounds the grandfathering problem** rather than reopening every past proof: read a
  prior negation as VERIFIED if its recorded failure output named the plant, and as UNPROVEN only
  if it recorded bare pass/fail. Same standard, far less to redo.
- **A RED ON AN UNWATCHED BRANCH IS INDISTINGUISHABLE FROM A GREEN — AND `main` IS THE UNWATCHED
  BRANCH.** Found by `pij-certain-crab`, on `main`, which is the o-prime's own tree. **`main` was
  RED for SIX consecutive commits** (`8a34a09` → `1cdfa19`), every one a governance commit by the
  o-prime, **while both seats spent that hour enforcing verdict discipline on the PM's branch** —
  count it, state the denominator, confirm the head has not moved. We counted the PM's every time
  and **never counted `main` once**, because nothing in the loop points at it.
  **Mechanism, and it is entirely mechanical**: `docs/plans/001-dd-extraction/assets/handover-packet.md`
  embeds `government/standing-constraints.md` and the guardrails block **verbatim**. Editing either
  source without `just gen-handover` makes `main` stale against itself **on the same commit that
  improves it**. **RULE: an edit to `standing-constraints.md` or the guardrails source requires
  `just gen-handover` IN THE SAME COMMIT** — same shape as persist-before-mutate, and the gate's
  own error already prints the command.
  **It also red-lit the PM's PR twice in one hour**, because a `pull_request` run tests the MERGE
  REF: `main`'s stale packet lands in the branch's verdict, and the branch owner then debugs a
  failure it did not cause.
  **The general form is worse than the bug.** The PM's red interrupts it, because it wrote a
  watcher. **Nothing watches `main`.** This is `ci-verdict-guard.md`'s founding defect one level
  up — not *an empty verdict read as a pass*, but **no reader at all**. **A prime's verdict is
  self-service by default, exactly like its status card, and for the same reason: nobody above it
  is looking.** And it is item 9 again — *"the PM's branch is the thing under test"* was true when
  adopted and quietly stopped being the whole truth once `main` started taking commits.
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

- **A consequence stated in a brief is indistinguishable from a ruling unless it says which
  it is.** Caught by `pij-alleged-junglefowl` on its first turn, against a brief I had just
  written. The brief carried a section explaining that storing a derived value *requires*
  `dd validate` to recompute and compare — true, load-bearing, and derived by me. The PM read
  it, could not tell whether it was **scope it must build** or **analysis it must not act on**,
  and asked rather than guessing. It was right to: I had never decided. **The reader cannot
  recover an authoring distinction the text does not carry**, and a brief is exactly where that
  bites, because a brief's whole job is to be acted on without re-deriving it. The fix is
  cheap and belongs to the author: label the two — *RULED* versus *CONSEQUENCE, UNRULED* —
  every time both appear in one document. Same family as the parent cause below: an artifact
  whose output cannot distinguish two states is not evidence for either, and here the two
  states were "build this" and "do not build this".
  **The near-miss is what makes it worth recording.** A less careful seat would have built it —
  the reasoning was sound, the section read as settled, and the result would have been correct
  code delivered against scope nobody authorised. **It would have looked like good work, and
  the failure would have been invisible in the artifact.** A brief that produces the right
  outcome by luck certifies the method that produced it.
- **Name a branch point WITH WHAT LANDED AT IT, or the seat re-discovers your own last commit
  as news.** Same handover, same day, second defect. I sent a PM to a worktree cut from
  `6fc7d83` and named the SHA and nothing else. It went on to report the `~/.dd` schema-shadow
  failure to me as a finding — and `6fc7d83` **is** the commit that recorded it, 65 lines of
  `docs/backlog.md`, one commit behind it the entire time. It caught its own error and framed it
  exactly right: *"the observation stands, the novelty does not."*
  **The failure needed both halves, which is why the remedy is on both ends.** Mine: a SHA is an
  address, not a description — it tells a seat where it stands and nothing about what is already
  known there, so a brief that names one without naming its content is inviting a rediscovery.
  Theirs, volunteered without being asked: **read the branch point regardless of whether the
  brief names it.** Take the mechanical half — write what landed — because that one holds when
  the reader is rushed, cheap, or compacted, and never rely on the diligence half alone.
  **The cost is not the wasted report — it is that a rediscovery arrives wearing the confidence
  of a new finding**, and a supervisor who does not happen to recognise their own commit will
  bank it twice.

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
