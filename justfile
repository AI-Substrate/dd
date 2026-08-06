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

# The canonical proof lane: what CI runs and what `harness checks` wraps. Build
# before test — the smoke test spawns the compiled bin.
checks:
    just lint
    just build
    just typecheck
    just test

# Remove build output.
clean:
    rm -rf dist coverage
