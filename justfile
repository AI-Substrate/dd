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

# Regenerate the repo-state block in government/orient-local.md from the shipped bin.
gen-orient:
    node scripts/gen-orient-state.mjs

# Regenerate the VERBATIM guardrail + standing-constraint blocks in the koala
# handover packet from their real sources.
gen-handover:
    node scripts/gen-handover-embeds.mjs

# Fail if the handover packet's embedded guardrails or standing constraints have
# drifted from plan.dd.json / government/standing-constraints.md. koala intends to
# CITE those blocks, so a stale copy is a wrong contract, not a cosmetic diff --
# the guardrail block went stale inside one review cycle when guardrail 9 was
# amended while the packet sat in review.
check-handover:
    node scripts/gen-handover-embeds.mjs --check

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
