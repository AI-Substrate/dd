# Brief — the canonical dd single-pager

**To**: the doc-writer seat (claude, `claude-fable-5`, effort medium)
**From**: `pij-mental-dajeil` (o-prime, AI-Substrate/dd)
**Named by**: Jordan, 2026-08-09, verbatim below
**Status**: active on delivery. One open scoping question (§ 6) — start on everything it does not gate.

---

## 1. The ask, verbatim

> "ths has much richer doco than us /Users/jordanknight/substrate/harness-engineering/docs/how/dd. also harnes docs list and get is a frature we shold carry. We need a canonical single pager on the dds, how to use them and some useful examples on stuff you can do with them. the concept is new so agents willnot get it properly. We aslo did a presentaiton here which might be useful to /Users/jordanknight/github/present/presentations/harness/dd/runsheet.md. Get another /pij peer up, claude code fable 5 medium and brief it on wring the canonical document. tell it to watch out for agent ticks when writing like "its not x, its y" etc."

> "it can work in teh sam branch as the current PM."

Two corrections to the premise, already measured, so you do not re-derive them:

- **`docs list` / `docs get` is ALREADY CARRIED.** `dd docs list` and `dd docs get <id>` both run here today and serve three baked entries. There is nothing to port. What is missing is a *good front-door page in that corpus*, which is your job.
- **The richness gap is real but partial.** Upstream's advantage is mostly its `README.md` § "Why this is different" and the `exemplar/` corpus. The exemplar is **deliberately not ported** (it carries an unruled `meta.certainty` value — see our `docs/how/dd/README.md` § "What is not here yet"). Do not port it and do not link to it as though it were local.

## 2. What you are writing

**One canonical page that makes a reader who has never seen a dd actually understand it**, then shows them useful things they can do. Jordan's stated reason is the design constraint: *"the concept is new so agents will not get it properly."*

The audience is **agents first, humans second**. An agent meets dd cold, mid-task, with no context, and has to not-misuse it. Write for that reader.

It must earn the word "canonical": someone who reads only this page should be able to work with dds correctly and know where to go for the rest.

## 3. Your sources — read all of these before writing a line

| Source | Why it matters |
|---|---|
| `/Users/jordanknight/substrate/harness-engineering/docs/how/dd/README.md` | **The richest framing that exists.** § "Why this is different" (lists are data · everything has an address · links are typed edges · gates you can't sweet-talk · validation pushes back · the rendered view can't drift · citations know when they're stale · the CLI does the writing) is the spine of the explanation. **READ-ONLY REPO — never write there, never run anything there.** |
| `/Users/jordanknight/substrate/harness-engineering/docs/how/dd/01..11-*.md` | The deep reference set. Mine for accuracy and examples; do not try to compress all of it onto one page. |
| `/Users/jordanknight/github/present/presentations/harness/dd/runsheet.md` | **The best "why" narrative anywhere.** Jordan's own notes near the top, and § "The arc in one paragraph", explain the problem dd solves: soft graphs drawn "in string and good intentions", handed to an agent with a PLEA. That framing is what makes the concept land. Steal the *thinking*, not the 1950s-newsreel voice — that is a deck's costume, not our docs' register. |
| `docs/how/dd/dd-overview.md` (this repo) | The current front door. Everything true in it must survive into your page or be deliberately dropped. |
| `docs/how/dd/how-to-add-a-schema.md`, `how-to-use-and-extend-the-sdk.md` | Your page **routes to** these; it must not duplicate them. |
| `README.md` at the repository root | The quick start, and it is **executed as a test** (`test/docs-surface.test.ts`). |

## 4. Every example must run

This is the hard rule and it is not negotiable. **Run every command you put on the page, in this worktree, and paste real output.** Not remembered output, not plausible output, not adapted-from-upstream output — upstream is a different codebase and its examples may not hold here.

Where an example cannot be made runnable, say so in the text rather than shipping it as though it works. A pointer that does not resolve is worse than an honest note about where the thing actually is — that is already this repo's stated position and you should hold it.

Good candidates for the "useful examples" section, chosen because they show the *shape* of the idea:
- addressing down to a list item, and why stable ids survive reordering;
- reading a value out with `dd get` and again with `jq`, showing they agree;
- a typed link and the error you get when the type is wrong (`E406`);
- a gate refusing a departure, with the real refusal text;
- the generated `.dd.md` sibling and the drift error when it goes stale (`E422`);
- `dd doctor` over a corpus.

## 5. Register — and the tics to avoid

Jordan, verbatim: *"tell it to watch out for agent ticks when writing like 'its not x, its y' etc."*

Bin these:

- **"It's not X, it's Y"** and every variant ("Not merely X — Y", "X isn't the point; Y is"). Say the thing directly.
- **Triads for rhythm** — three parallel clauses where two would do, or where the third is padding.
- **"Let's dive in", "Think of it like…", "At its core", "The beauty of this is", "This is where it gets interesting"**, and other tour-guide filler.
- **Bold scattered for emphasis** rather than to mark a term a reader will search for.
- **A closing paragraph that summarises what was just said.** End on the last useful sentence.
- **Manufactured drama** — dd is genuinely interesting; it does not need selling.

Write plainly, in short declarative sentences. Assume the reader is competent and busy. The upstream README's voice is a good calibration target: confident, concrete, unadorned.

## 6. OPEN QUESTION — do not let it block you

`dd-overview.md` currently holds the front-door role your page is meant to hold. Whether your page **replaces** it (absorbing what is still true) or **sits above** it as a start-here with `dd-overview` demoted to reference is with Jordan now; I will relay the ruling.

**Meanwhile**: read both, draft the canonical page in full, and keep a short list of anything in `dd-overview.md` you could not absorb. That work is identical under either answer.

## 7. Where you work, and the fences

You are in the worktree **`/Users/jordanknight/substrate/dd-worktrees/s002-sdk-build`**, branch **`s002/sdk-build`**. Jordan ruled you share this branch with the current PM (`pij-certain-crab`), which is a live shared tree, so these are hard:

1. **`git add` takes explicit file paths. NEVER `git add -A`, `git add .`, or `git add <directory>`.** The PM has uncommitted work in this tree right now. This exact mistake swept 185 lines of a live writer's file into someone else's commit in this repo two days ago; the fence exists because of it, not in anticipation of it.
2. **Before any commit, run `git status --short` and confirm every staged path is yours.** If you see a path you did not write, stop and tell me.
3. **Your file is yours alone.** Author your new page under `docs/how/dd/`. Do not edit `docs/how/dd/README.md`, `dd-overview.md`, or the other pages without clearing it with me first — the PM is touching some of them.
4. **DO NOT TOUCH `src/docs/dd-docs-manifest.json` OR `src/docs/docs-content.ts`.** Those are the baked-docs generator inputs and the PM's coder has **uncommitted changes to both right now**. Baking your page into `dd docs` is a real requirement, but it is serialized through me and happens after the PM's changes land. Write the page; I will schedule the bake.
5. **Never read or write** `.the-flow-state.json`, `the-flow.json`, `the-flow.md` in either repo.
6. **`harness-engineering` is READ-ONLY reference.** Read its docs freely. Never write, never `npm install`, never run a build there.
7. **No push, no PR, no tag, no release.** Commit to the branch; landing is decided above you.

## 8. Reporting

- `pij report now "<what you just did>" "<what is next>"` at the start of a work unit and again at the end. A stale card reads as current to everyone.
- Ask **me** (`pij-mental-dajeil`) anything about scope, the fences, or a conflict with the PM. Ask Jordan directly only if it is a question about the writing itself that only he can answer — and if you do, one sentence of context and one sentence of ask, which is his stated preference.
- Wire discipline: line 1 of any message is the recipient's action, or `NO ACTION`.

## 9. Done looks like

A single page, in `docs/how/dd/`, that:

- explains what a dd is and why it exists, to a reader with zero context;
- has examples you personally ran in this worktree, with their real output;
- routes to the schema page, the SDK page, and the root quick start rather than restating them;
- is honest about what lives upstream and is not here;
- reads like a person wrote it.
