set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

# List available recipes.
default:
    @just --list

# Install dependencies from the lockfile.
install:
    npm ci

# Compile TypeScript to dist/ (the bin's runtime).
build:
    npm run build

# Typecheck src + test without emitting.
typecheck:
    npm run typecheck

# Lint + format check with biome (read-only).
lint:
    npx biome check .

# Apply biome's safe fixes and formatting in place.
fix:
    npx biome check --write .

# Run the unit + bin smoke tests with coverage (report-only).
test:
    npx vitest run --coverage

# "Does it run?" — compile, then drive the compiled bin end to end. This is what
# `harness boot` wraps: the fast proof an agent runs BEFORE changing anything, to
# tell "I broke it" apart from "it was already broken".
boot:
    just build
    npx vitest run test/smoke.test.ts

# Regenerate the baked `dd docs` corpus from its manifest + source markdown.
gen-docs:
    npm run gen:dd-docs

# Fail if the baked docs module drifted from its sources (regenerate-and-diff).
check-docs:
    npm run check:dd-docs

# Regenerate the repo-state block in .harness/government/orient-local.md from the shipped bin.
gen-orient:
    node scripts/gen-orient-state.mjs

# Regenerate the VERBATIM guardrail + standing-constraint blocks in the koala
# handover packet from their real sources.
gen-handover:
    node scripts/gen-handover-embeds.mjs

# Fail if the handover packet's embedded guardrails or standing constraints have
# drifted from plan.dd.json / .harness/government/standing-constraints.md. koala intends to
# CITE those blocks, so a stale copy is a wrong contract, not a cosmetic diff --
# the guardrail block went stale inside one review cycle when guardrail 9 was
# amended while the packet sat in review.
check-handover:
    node scripts/gen-handover-embeds.mjs --check

# Prove the exports map is REACHABLE, not merely declared. A map does not fail to
# list a subpath, it FORBIDS it (ERR_PACKAGE_PATH_NOT_EXPORTED), so "the module
# exports it" and "a consumer can import it" are different facts and only the
# second one matters to a consumer. Builds its own scratch project + symlink and
# refuses if dist/ is absent, so it cannot report everything-forbidden from a
# broken setup. Carries positive controls for the same reason.
check-exports:
    node scripts/exports-reachability-probe.mjs

# Dependency advisories, blocking on what someone can ACT on. Production high or
# critical always reds — that is what a user installs. A DEV advisory reds only
# once a fix exists, because a gate that fails for a reason nobody can fix trains
# everyone to skip the line. Crucially the fixable/unfixable split is re-derived
# every run rather than baked as an exemption list: the day vitest ships a patched
# line, this goes red by itself. Replaces `npm audit --audit-level=high || true`,
# which had been printing six high advisories under a green tick.
audit:
    node scripts/audit-gate.mjs

# Fail if orient-local's repo-state block no longer matches `dd --json status`.
# orient-local is the mandatory first read for a new seat; it once carried a
# hand-written "Measured:" line claiming the port had not happened, long after it
# had. A stale orientation file misleads every agent that trusts it, so the claim
# is derived in the operation that writes it and gated here.
check-orient:
    node scripts/gen-orient-state.mjs --check

# Prove dd on its OWN documents: every repo .dd.json must still render byte-for-byte
# to its committed .dd.md, checked with the LOCAL bin. This is the self-hosting
# proof (plan 001 tk-0003) — the plan folder is a real dd corpus, so a renderer
# regression reddens here before it reaches a user. Test fixtures are excluded by
# rule: they carry their own discovery roots and several drift on purpose.
self-host:
    ./scripts/self-host-check.sh

# Prove the PUBLISHED SURFACE is consumable: pack a tarball, install it into a
# throwaway project with a real `npm install <tgz>`, and compile + run the §5.1
# trial fixture against it in Node's own NodeNext resolution.
#
# This is plan 002's acceptance gate. `just typecheck` already compiles the same
# fixture in-repo, but under `Bundler` resolution against local `dist/` reached by
# self-name — which is structurally blind to the `files` allowlist, the prepack
# build, the runtime dependencies, and whether the library actually behaves. The
# two are not redundant; they fail for different reasons.
#
# Measured at ~6s, which is why it is cheap enough for the inner loop while
# `just pack-gate` (a clean clone plus `npm ci`) is not. It does resolve
# `commander` and `jiti` from the registry on a cold npm cache.
#
# NOT in `just checks` — and that is a fence outcome, not a judgement that it
# does not belong there. `test/ci-parity.test.ts` binds every gate inside
# `checks` to a matching step in `.github/workflows/ci.yml`, and ci.yml is
# outside the P5 packet's allowed paths, so adding the line here without the
# matching CI step would redden the parity guard by design. It rides
# `just pack-gate` instead (§5.1 T4's sanctioned alternative), where CI already
# runs it on every PR through the package-smoke job — against a tarball built
# from a CLEAN CLONE, which is the stronger artifact of the two.
check-trial:
    node scripts/trial-fixture-run.mjs

# The canonical proof lane: what CI runs and what `harness checks` wraps. Build
# before test — the smoke test spawns the compiled bin. The docs drift gate runs
# here because `src/docs/content/*.md` is only reachable by the CLI once it has
# been baked into `docs-content.ts`; without it, editing a chapter drifts silently.
#
# CI runs these same gates in this same order, and that is asserted rather than
# promised: `test/ci-parity.test.ts` reads this recipe and the workflow and reds
# if they diverge. Adding a gate here without adding it to ci.yml is a red test.
checks:
    just lint
    just build
    just typecheck
    just check-docs
    just check-orient
    just check-handover
    just check-exports
    just audit
    just self-host
    just test

# Prove the PUBLISHED ARTIFACT works: clone HEAD clean, pack (prepack builds
# dist), install the tarball into a throwaway project, and drive the INSTALLED
# bin against a fixture corpus — including a custom render type written in
# untranspiled TypeScript, which only runs if the shipped jiti dependency does.
# Deliberately NOT in `just checks`: it clones, installs from the registry and
# takes ~a minute, which is the wrong shape for the inner loop. CI runs it.
pack-gate:
    ./scripts/pack-gate.sh

# Remove build output.
clean:
    rm -rf dist coverage

# Create an isolated worktree for a writer — the mechanism behind the
# worktree-per-writer rule (.harness/government/orient-local.md, plan 001 P-2).
#
# Phase 4 produced three incidents from one shared index, two of which landed:
# a delegate worktree staged as a gitlink, 185 lines of a live coder's file
# swept into a governance commit, and an index.lock collision that only missed
# because the lock fired before the commit did. All three were between the two
# most careful agents on the fleet, which is the argument — a shared index is a
# structural hazard, not a carelessness problem.
#
# What this buys and what it does not: a separate worktree has its OWN INDEX, so
# concurrent writers cannot stage or sweep each other's files. That part is
# structural. The residual dependency is one-time and at ALLOCATION — somebody
# has to run this instead of just editing the main tree. This recipe exists to
# make the right thing the cheap thing; it does not enforce anything, and this
# comment says so rather than implying a gate that is not here.
#
#   just worktree s005-my-stream
worktree slug:
    #!/usr/bin/env bash
    set -euo pipefail
    root="$(git rev-parse --show-toplevel)"
    dest="$(dirname "$root")/dd-worktrees/{{slug}}"
    branch="$(echo "{{slug}}" | sed 's|^\([a-z0-9]*\)-|\1/|')"
    if [ -e "$dest" ]; then echo "ERROR: $dest already exists" >&2; exit 1; fi
    git worktree add -b "$branch" "$dest" main
    echo
    echo "Worktree:  $dest"
    echo "Branch:    $branch  (from main)"
    echo "Its index is separate from this one — that is the whole point."
    echo "When finished:  git worktree remove $dest"

# List worktrees with their state, and name the ones that look abandoned.
# A stale worktree is not harmful, but it hides real ones in the listing and
# `git worktree list` alone does not say which are finished.
worktrees:
    #!/usr/bin/env bash
    set -euo pipefail
    git worktree list
    echo
    echo "Detached-HEAD trees are usually finished delegate/review runs."
    echo "Remove only trees YOU created:  git worktree remove <path>"
    echo "Then reclaim the metadata:      git worktree prune"
