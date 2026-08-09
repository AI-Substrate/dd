#!/usr/bin/env bash
#
# pack-gate — prove the PUBLISHED ARTIFACT works, from a clean clone outward.
#
# Everything else in this repo tests `src/`. That is structurally blind to the
# three ways a package breaks between "the code is right" and "a consumer can
# use it": the `files` allowlist ships the wrong set, `prepack` fails to build so
# the tarball has no `dist/`, or a runtime dependency is missing so the installed
# bin dies on first use. None of those can redden a unit test.
#
# So this gate never touches the working tree. It clones HEAD into a temp dir —
# no node_modules, no dist, exactly what a fresh `git clone` gives you — packs
# from there, installs the tarball into a throwaway project, and drives the
# INSTALLED bin against a fixture corpus it builds from scratch.
#
# The network: installing the tarball resolves `commander` and `jiti` from the
# registry, which is allowed and expected. The proof this gate makes is
# REPO-ABSENCE (nothing of this checkout is reachable from the consumer), not
# network-absence.
#
# Usage:
#   scripts/pack-gate.sh            # run the gate, clean up after itself
#   scripts/pack-gate.sh --keep     # leave the temp dirs behind for inspection
#
# Exit 0 = the artifact is consumable. Any other exit = it is not; the failing
# step names itself.

set -euo pipefail

KEEP=0
[ "${1:-}" = "--keep" ] && KEEP=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/dd-pack-gate.XXXXXX")"
CLONE="$WORK/clone"
CONSUMER="$WORK/consumer"

cleanup() {
  if [ "$KEEP" = "1" ]; then
    echo "--- kept: $WORK"
  else
    rm -rf "$WORK"
  fi
}
trap cleanup EXIT

step() { printf '\n=== %s\n' "$1"; }
fail() { printf '\npack-gate FAILED: %s\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------------------
step "1/8  clone HEAD into a clean tree (no node_modules, no dist)"
# ---------------------------------------------------------------------------
HEAD_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
# `--local` is the fast path (hardlink-free copy of the object store), but git
# refuses it on a shallow repository — which is exactly what `actions/checkout`
# produces by default. Ask first rather than clone through a warning.
CLONE_ARGS=(--quiet)
if [ "$(git -C "$REPO_ROOT" rev-parse --is-shallow-repository)" = "false" ]; then
  CLONE_ARGS+=(--local --no-hardlinks)
fi
git clone "${CLONE_ARGS[@]}" "$REPO_ROOT" "$CLONE"
git -C "$CLONE" -c advice.detachedHead=false checkout --quiet "$HEAD_SHA"
echo "    HEAD $HEAD_SHA"

[ -d "$CLONE/dist" ] && fail "the clone already has dist/ — it is not clean, so the lifecycle-hook proof means nothing"
[ -d "$CLONE/node_modules" ] && fail "the clone already has node_modules/ — it is not clean"
echo "    clean: no dist/, no node_modules/"

# ---------------------------------------------------------------------------
step "2/8  install build dependencies in the clone"
# ---------------------------------------------------------------------------
( cd "$CLONE" && npm ci --silent --no-audit --no-fund ) || fail "npm ci failed in the clean clone"

# ---------------------------------------------------------------------------
step "3/8  prepare built dist/ on install; a lifecycle hook must rebuild it after we clear it"
# ---------------------------------------------------------------------------
# Both lifecycle hooks are proven here, in order, because Jordan's distribution
# ruling made BOTH paths load-bearing: `prepare` serves the git-URL install and
# `prepack` serves `npm pack`/publish. npm runs `prepare` on install, so the
# `npm ci` above must ALREADY have produced dist/ — that is the git-URL path
# working, and its absence is the failure a git consumer would hit as a bin that
# throws ERR_MODULE_NOT_FOUND.
[ -d "$CLONE/dist" ] || fail "npm ci did not build dist/ — prepare is not wired, so a git-URL install ships a broken package"
echo "    prepare: npm ci built dist/ (the git-URL path)"

# Now remove it and pack, so the tarball's runtime is asserted rather than assumed:
# if NEITHER hook is wired, the pack below succeeds and produces a tarball with no
# runtime — the failure this gate has always existed to catch.
#
# MEASURED, and narrower than this comment used to claim. It said `prepack` was
# proven INDEPENDENTLY of `prepare` here. It is not: a four-line probe package
# whose `prepare` writes a marker file shows `prepare` FIRES on a plain `npm pack`
# under both npm 10.9.2 (node 22, our engines floor and a CI leg) and npm 11
# (node 24) — and the pack below passes no --ignore-scripts. So clearing dist/
# proves "prepack OR prepare rebuilt it", not prepack alone. Nothing is left
# unproven for a consumer, because both hooks are wired today and either one
# rebuilding dist/ is the outcome both install paths need; the claim is simply
# smaller than the sentence that stood here. Isolating prepack would mean packing
# with `prepare` stripped from the manifest, which is a change to what this step
# tests, not a comment fix.
rm -rf "$CLONE/dist"
[ -d "$CLONE/dist" ] && fail "could not clear dist/ before the pack step"

TARBALL_NAME="$( cd "$CLONE" && npm pack --json --silent 2>/dev/null | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const packed = JSON.parse(s)[0];
    if (!packed || !packed.filename) { console.error("could not read npm pack --json"); process.exit(1); }
    console.log(packed.filename);
  });' )"
case "$TARBALL_NAME" in
  *.tgz) ;;
  *) fail "npm pack output looks corrupt: '$TARBALL_NAME'" ;;
esac
TARBALL="$CLONE/$TARBALL_NAME"
[ -f "$TARBALL" ] || fail "packed tarball not found at $TARBALL"
[ -f "$CLONE/dist/index.js" ] || fail "neither prepack nor prepare rebuilt dist/ during pack — a clean clone does NOT self-build"
echo "    packed $TARBALL_NAME (a lifecycle hook built dist/)"

# ---------------------------------------------------------------------------
step "4/8  file-list assertion — what is in the tarball, and what must not be"
# ---------------------------------------------------------------------------
( cd "$CLONE" && npm pack --dry-run --json --ignore-scripts 2>/dev/null ) | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const packed = JSON.parse(s)[0];
    const paths = packed.files.map((f) => f.path);
    const problems = [];

    // Required: the bin a consumer runs, and the entry point they import.
    for (const required of ["bin/dd.js", "dist/index.js", "dist/index.d.ts", "LICENSE", "package.json"]) {
      if (!paths.includes(required)) problems.push(`MISSING ${required}`);
    }

    // Forbidden: anything that is repository furniture rather than product.
    const leaked = paths.filter((p) =>
      /^(src|test|scripts|docs|node_modules|coverage|\.dd|\.github|\.harness|\.agents|\.flow-pair)\//.test(p),
    );
    for (const path of leaked) problems.push(`LEAKED ${path}`);

    // The top level is a closed set: additions are a decision, not an accident.
    const allowed = new Set(["LICENSE", "README.md", "bin", "dist", "package.json"]);
    for (const root of new Set(paths.map((p) => p.split("/")[0]))) {
      if (!allowed.has(root)) problems.push(`UNEXPECTED top-level entry: ${root}`);
    }

    if (problems.length) {
      console.error("file-list assertion failed:");
      for (const problem of problems) console.error("  " + problem);
      process.exit(1);
    }
    console.log(`    ${paths.length} files, top level: ${[...new Set(paths.map((p) => p.split("/")[0]))].sort().join(", ")}`);
  });' || fail "the packed file list is wrong"

# ---------------------------------------------------------------------------
step "5/8  install the tarball into a throwaway consumer project"
# ---------------------------------------------------------------------------
mkdir -p "$CONSUMER"
( cd "$CONSUMER" && npm init -y >/dev/null 2>&1 )
# --omit=dev is the consumer's install: every dependency the bin needs at
# RUNTIME has to resolve without this repo's devDependencies existing anywhere.
( cd "$CONSUMER" && npm install --silent --no-audit --no-fund --omit=dev "$TARBALL" ) \
  || fail "installing the tarball failed"

DD="$CONSUMER/node_modules/.bin/dd"
[ -x "$DD" ] || fail "installed bin is missing or not executable: $DD"
echo "    installed; bin resolves to $(readlink "$DD" 2>/dev/null || echo "$DD")"

# The consumer must not be able to reach this checkout. If it could, every proof
# below would be about our source tree rather than about the tarball.
INSTALLED_PKG="$CONSUMER/node_modules/@ai-substrate/dd"
[ -d "$INSTALLED_PKG/src" ] && fail "the installed package contains src/ — repo leakage"
[ -d "$INSTALLED_PKG/test" ] && fail "the installed package contains test/ — repo leakage"
echo "    repo-absence: no src/, no test/ inside the installed package"

# ---------------------------------------------------------------------------
step "6/8  drive the installed bin: envelope contract + the fixture corpus"
# ---------------------------------------------------------------------------
CORPUS="$CONSUMER/corpus"
# Resolution is `<root>/schemas/<pkg>/<schema>/schema.json`; the `schemas/` level
# is required and the last two segments ARE the qualified name.
SCHEMA_DIR="$CORPUS/.dd/schemas/demo/timing"
mkdir -p "$SCHEMA_DIR/adapters"

cat > "$SCHEMA_DIR/schema.json" <<'JSON'
{
  "dd_schema": 1,
  "description": "Pack-gate fixture: one custom render type, loaded from TypeScript by jiti.",
  "sections": {
    "meta": {
      "required": true,
      "shape": {
        "type": "object",
        "required": ["title"],
        "fields": { "title": { "type": "string" }, "window": { "type": "duration" } }
      }
    }
  }
}
JSON

# Untranspiled TypeScript, on purpose: the annotations and the `interface` below
# are not executable by Node. They survive only because the SHIPPED package
# carries jiti as a runtime dependency and transpiles this on load. Registration
# is PRESENCE — this path IS the registration, there is no manifest.
cat > "$SCHEMA_DIR/adapters/duration.ts" <<'TS'
interface AdapterContext {
  field: string;
}

export default function duration(value: unknown, ctx: AdapterContext): string {
  const minutes: number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) return `⟨${ctx.field}: not a duration⟩`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (rest > 0 || parts.length === 0) parts.push(`${rest}m`);
  return `**${parts.join(' ')}**`;
}
TS

cat > "$CORPUS/timing.dd.json" <<'JSON'
{
  "dd": { "schema": "demo/timing" },
  "sections": [{ "name": "meta", "value": { "title": "Pack gate", "window": 2610 } }],
  "references": []
}
JSON

# Documents are addressed RELATIVE to cwd throughout: on macOS `mktemp -d` hands
# back a /var/... path while the process resolves /private/..., so an ABSOLUTE
# temp path is judged outside the repository root and the build refuses (E429).
run_dd() { ( cd "$CORPUS" && "$DD" "$@" ); }

echo "--- dd --version"
run_dd --version >/dev/null || fail "dd --version failed"

echo "--- dd validate (must be ok, exit 0)"
set +e
run_dd --json validate timing.dd.json > "$WORK/validate.json"; VALIDATE_CODE=$?
set -e
[ "$VALIDATE_CODE" -eq 0 ] || { cat "$WORK/validate.json"; fail "dd validate exited $VALIDATE_CODE, expected 0"; }
node -e '
  const envelope = require(process.argv[1]);
  if (envelope.status !== "ok") { console.error(JSON.stringify(envelope, null, 2)); process.exit(1); }
  for (const key of ["command", "status", "data", "timestamp"]) {
    if (!(key in envelope)) { console.error(`envelope missing ${key}`); process.exit(1); }
  }
' "$WORK/validate.json" || fail "dd validate did not answer a clean envelope"
echo "    ok"

echo "--- dd build (the jiti custom type must reach the rendered markdown)"
set +e
run_dd --json build timing.dd.json > "$WORK/build.json"; BUILD_CODE=$?
set -e
[ "$BUILD_CODE" -eq 0 ] || { cat "$WORK/build.json"; fail "dd build exited $BUILD_CODE, expected 0"; }
grep -q '\*\*43h 30m\*\*' "$CORPUS/timing.dd.md" \
  || { echo "--- rendered:"; cat "$CORPUS/timing.dd.md"; fail "the jiti-loaded adapter did NOT run through the installed tarball"; }
grep -q '2610' "$CORPUS/timing.dd.md" \
  && fail "the raw value survived — the adapter did not replace it"
echo "    ok — 2610 minutes rendered as **43h 30m** by TypeScript the tarball transpiled at runtime"

echo "--- non-vacuity: remove the adapter, the SAME assertion must fail"
# Without this control the check above could pass for the wrong reason (e.g. if
# the string were coming from anywhere else). dw-0005 asks for exactly this:
# the proof must be one that fails when the fixture is absent.
BARE="$CONSUMER/bare"
mkdir -p "$BARE/.dd/schemas/demo/timing"
cp "$SCHEMA_DIR/schema.json" "$BARE/.dd/schemas/demo/timing/schema.json"
cp "$CORPUS/timing.dd.json" "$BARE/timing.dd.json"
( cd "$BARE" && "$DD" --json build timing.dd.json >/dev/null 2>&1 ) || true
if grep -q '\*\*43h 30m\*\*' "$BARE/timing.dd.md" 2>/dev/null; then
  fail "adapter output appeared with NO adapter present — the jiti assertion is vacuous"
fi
grep -q '2610' "$BARE/timing.dd.md" \
  || { echo "--- rendered:"; cat "$BARE/timing.dd.md" 2>/dev/null; fail "expected the raw value to survive without an adapter"; }
echo "    ok — without the .ts file the same document renders 2610, so the proof is real"

echo "--- exit-code contract on the installed bin"
set +e
run_dd --json no-such-verb > "$WORK/err.json" 2>/dev/null; ERR_CODE=$?
set -e
[ "$ERR_CODE" -eq 1 ] || fail "an unknown verb must exit 1, got $ERR_CODE"
node -e '
  const envelope = require(process.argv[1]);
  if (envelope.status !== "error") { console.error("expected an error envelope"); process.exit(1); }
  if (!envelope.next_action) { console.error("a non-ok status REQUIRES next_action"); process.exit(1); }
' "$WORK/err.json" || fail "the error envelope is not contract-shaped"
echo "    ok — error envelope, exit 1, next_action present"

echo "--- port ledger on the installed bin"
set +e
run_dd --json status > "$WORK/status.json"; STATUS_CODE=$?
set -e
node -e '
  const envelope = require(process.argv[1]);
  const expected = envelope.status === "ok" ? 0 : envelope.status === "unconfigured" ? 2 : 1;
  if (Number(process.argv[2]) !== expected) {
    console.error(`status ${envelope.status} must exit ${expected}, got ${process.argv[2]}`);
    process.exit(1);
  }
  if (envelope.status !== "ok" || envelope.data.remaining.length !== 0) {
    console.error("the SHIPPED cli must carry a complete port ledger:");
    console.error(JSON.stringify(envelope.data, null, 2));
    process.exit(1);
  }
  console.log(`    ok — ${envelope.data.ported.length} verbs ported, 0 remaining`);
' "$WORK/status.json" "$STATUS_CODE" || fail "the installed bin does not report a complete, honest ledger"

# ---------------------------------------------------------------------------
step "7/8  every ported verb answers on the installed bin"
# ---------------------------------------------------------------------------
node -e '
  const envelope = require(process.argv[1]);
  console.log(envelope.data.ported.join("\n"));
' "$WORK/status.json" | while read -r verb; do
  [ -z "$verb" ] && continue
  ( cd "$CORPUS" && "$DD" "$verb" --help >/dev/null 2>&1 ) \
    || fail "verb '$verb' is claimed ported but does not answer --help on the installed bin"
done
echo "    ok — every claimed verb answers --help"

# ---------------------------------------------------------------------------
step "8/8  the SDK trial fixture — the published surface as a consumer sees it"
# ---------------------------------------------------------------------------
# Everything above drives the installed BIN. dd ships a second product through the
# same tarball — the typed SDK — and a CLI smoke test is structurally blind to it:
# the `exports` map, the subpath type declarations and the library's own behaviour
# are invisible to a process that only ever spawns `dd`. Plan 002 §5.1 is the bar
# for that half, and this is where it is met.
#
# It runs from the CLONE, not from the working tree. That costs nothing and buys a
# real assertion: the fixture and its corpus must be COMMITTED. An uncommitted
# corpus file would pass every local run and fail here, which is the same class of
# defect the clean clone exists to catch for `dist/`.
#
# The tarball and the consumer are the ones this gate already built, so the
# expensive half — pack plus install — happens exactly once.
( cd "$CLONE" && node scripts/trial-fixture-run.mjs --tarball "$TARBALL" --consumer "$CONSUMER" ) \
  || fail "the §5.1 trial fixture refused — the failing clause is named above"

printf '\npack-gate PASSED — the tarball at %s is consumable.\n' "$TARBALL_NAME"
