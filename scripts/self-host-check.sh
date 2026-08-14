#!/usr/bin/env bash
#
# self-host-check — dd proves itself on its own documents (plan 001 tk-0003).
#
# This repo's plan, execution log and task lists are dd documents. That makes
# them the most honest test the tool has: if `ddocs build` cannot keep its own
# planning corpus byte-identical, the port did not work, however green the unit
# tests are. Proof by consumption — we are the first consumer.
#
# It runs the LOCAL bin on purpose. The plan's RENDERER AUTHORITY SPLIT gives
# this repo's documents to the local `dd` for writes and drift, and leaves
# semantics to `harness plan validate`. Checking with the upstream `harness dd`
# would reintroduce exactly the renderer skew the split exists to prevent.
#
# SCOPE — repo documents, NOT the test corpus. `test/**` fixtures are inputs to
# tests that hand them their own discovery roots; from the repo root their
# schemas do not resolve at all (E401), and several drift on purpose because a
# test asserts the drift. They are not documents this repo maintains, so they
# are excluded by rule rather than by accident, and the rule is asserted below.
#
# Usage:
#   scripts/self-host-check.sh          # check every repo document for drift
#
# Exit 0 = every document matches its committed markdown. Any other exit = at
# least one drifted, and the failing document names itself.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DD_BIN="$REPO_ROOT/bin/ddocs.js"
[ -f "$DD_BIN" ] || { echo "self-host-check FAILED: no bin at $DD_BIN"; exit 1; }
[ -d "$REPO_ROOT/dist" ] || {
  echo "self-host-check FAILED: dist/ is missing — run \`npm run build\` first"
  exit 1
}

# Tracked documents only: an untracked scratch file is not part of the repo's
# corpus, and picking it up would make this gate depend on the working tree.
#
# Read into an array the portable way. `mapfile`/`readarray` is bash 4+, and
# macOS ships bash 3.2 — CI (ubuntu, bash 5) would have stayed green while every
# developer on a Mac got `mapfile: command not found`. `scripts/pack-gate.sh`
# already avoids it; this follows that convention rather than re-finding it.
DOCUMENTS=()
while IFS= read -r document; do
  [ -n "$document" ] && DOCUMENTS+=("$document")
done < <(git ls-files '*.dd.json' | grep -v '^test/' || true)

# Non-vacuity. A gate that checks nothing passes everything, so an empty list is
# a failure rather than a quiet success — if the corpus moves out of this glob,
# this must go red and be re-pointed, not silently stop proving anything.
if [ "${#DOCUMENTS[@]}" -eq 0 ]; then
  echo "self-host-check FAILED: found NO repo documents to check."
  echo "  The glob \`git ls-files '*.dd.json' | grep -v '^test/'\` matched nothing."
  echo "  That is a broken gate, not a clean repo."
  exit 1
fi

echo "self-host: checking ${#DOCUMENTS[@]} repo documents with the LOCAL bin"

DRIFTED=()
FAILED=()

for document in "${DOCUMENTS[@]}"; do
  set +e
  OUTPUT="$(node "$DD_BIN" --json build "$document" --check 2>&1)"
  CODE=$?
  set -e

  if [ "$CODE" -ne 0 ]; then
    FAILED+=("$document (exit $CODE)")
    printf '  ✗ %s — ddocs build --check exited %s\n' "$document" "$CODE"
    printf '    %s\n' "$OUTPUT"
    continue
  fi

  # `drift` is read explicitly rather than inferred from the exit code: --check
  # is a REPORT, and a reporting command that answers "drift: true" while
  # exiting 0 is a contract we must not silently depend on either way.
  VERDICT="$(printf '%s' "$OUTPUT" | node -e '
    let raw = "";
    process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
      let envelope;
      try {
        envelope = JSON.parse(raw);
      } catch {
        console.log("unparseable");
        return;
      }
      if (envelope.status !== "ok") {
        console.log(`status:${envelope.status}`);
        return;
      }
      console.log(envelope.data.drift === true ? "drift" : "clean");
    });
  ')"

  case "$VERDICT" in
    clean) printf '  ✓ %s\n' "$document" ;;
    drift)
      DRIFTED+=("$document")
      printf '  ✗ %s — DRIFTED: the committed .dd.md does not match the document\n' "$document"
      ;;
    *)
      FAILED+=("$document ($VERDICT)")
      printf '  ✗ %s — %s\n' "$document" "$VERDICT"
      ;;
  esac
done

if [ "${#DRIFTED[@]}" -ne 0 ] || [ "${#FAILED[@]}" -ne 0 ]; then
  echo
  echo "self-host-check FAILED"
  # `${arr[@]+"${arr[@]}"}` — expanding an EMPTY array under `set -u` is an
  # unbound-variable error on bash 3.2, and exactly one of these two is normally
  # empty, so the guard is load-bearing rather than defensive noise.
  for document in ${DRIFTED[@]+"${DRIFTED[@]}"}; do
    echo "  drifted: $document  →  fix with: node bin/ddocs.js build $document"
  done
  for document in ${FAILED[@]+"${FAILED[@]}"}; do
    echo "  errored: $document"
  done
  echo
  echo "This repo renders its own documents with its own bin. A drift here means"
  echo "either the renderer changed or a .dd.json was edited without rebuilding."
  exit 1
fi

echo "self-host-check PASSED — ${#DOCUMENTS[@]} documents, zero drift, rendered by the bin this repo ships."
