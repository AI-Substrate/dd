# The mid-suite rebuild race — and the two-fault structure behind PR #1's red

Record for the P0 fix packet. Written because the investigation that produced it
crossed two independent faults, and a note that named only one of them would
leave the other looking like it had been explained.

## 1. The fault this commit fixes

`test/package-manifest.test.ts` ran `npm pack --dry-run --json --ignore-scripts`
with `cwd: repoRoot`, four times per suite run. `package.json` wires
`"prepare": "npm run build"`, and `"build": "tsc -p tsconfig.json"` — which
overwrites `dist/` **in place**, without clearing it first.

**`--ignore-scripts` does not suppress `prepare` on the npm this package's
`engines` floor ships.** Measured directly, with a four-line throwaway package
whose `prepare` writes a marker file:

| npm | `npm pack --dry-run` | `npm pack --dry-run --ignore-scripts` |
| --- | --- | --- |
| 10.9.2 (bundled with node 22) | `prepare` RAN | `prepare` **RAN** |
| 11.x (bundled with node 24) | `prepare` RAN | `prepare` did not run |

And confirmed against the real repo under npm 10.9.2: `dist/index.js` mtime
moved across a single `npm pack --dry-run --json --ignore-scripts` in the repo
root (1786168191 → 1786168674).

So on node 22 — one of the two CI matrix legs — four of this file's rows
rebuilt the live `dist/` mid-suite, while sibling test files were spawning the
shipped bin out of that same directory. `tsc` writing in place means the failure
mode is not a MISSING module but a HALF-WRITTEN one, which is exactly what the
new spawn diagnostics caught on one run:

```
SyntaxError: The requested module '../adapters/process/node-process.js'
does not provide an export named 'NodeProcess'
```

### The fix, and its proof

Pack from a throwaway COPY of the repo, with `prepack`/`prepare` stripped from
the copied manifest. npm's cwd is the copy, so whatever lifecycle scripts npm
decides to run write there; `--ignore-scripts` stays as a second layer rather
than the only one. The result is packed once and shared across the four rows.

Removed by construction rather than by flag — that distinction is the whole
lesson: the previous shape was correct about its INTENT and wrong about the
mechanism it trusted to deliver it, and the file's own comment asserted the
mechanism rather than measuring it (C-6 family, fourth instance this plan). The
comment is corrected in the same commit, citing the measured npm-10 behaviour.

Proof, all under node 22.14.0 / npm 10.9.2 (the affected combination):

- `dist/index.js`, `dist/app.js`, `dist/output/exit.js` mtimes **unchanged**
  across a full `npm test` run (65 files, 767 tests, green).
- 6 further consecutive full-suite runs: all exit 0, mtime never moved.
  Prior measurement on the old shape: 1 red in ~7 runs, two different tests.
- Green under the default toolchain (node 24 / npm 11) as well.

## 2. The two-fault structure, labelled honestly

PR #1 red on node 22 with `dd status` returning 207 bytes of truncated JSON.
Investigating it surfaced **two** faults. They are not the same fault, and the
evidence for each is a different grade.

**Fault A — the piped-envelope truncation (`0133bb8`).** Real, preexisting,
live on `main`. `exitWithEnvelope` called `process.exit` while stdout was a
non-blocking pipe, so anything past the pipe buffer was discarded. Measured with
the defect restored: node 22 delivered 8,192 bytes of a 400 KB envelope, node 24
delivered 65,536. Fixed, and guarded by `test/acts/envelope-flush.test.ts`,
whose rows are negated on both runtimes.

**Fault B — this rebuild race.** Mechanism-consistent with the original red:
node 22 only (npm 10 only); `status` stdout empty while sibling smoke rows
passed (they ran outside the rebuild window); unattributable at the time because
the old test discarded exit code and stderr. **Identity NOT proven** — that
specific CI run was never reproduced, and this note does not claim it was.

Both were real. Neither subsumes the other. Fault A would have shipped a
silently-truncating envelope regardless of whether Fault B existed.

**Withdrawn by measurement:** my earlier suspicion that the residual `dd write`
flake was coverage instrumentation. It was not — the same rebuild race explains
it, along with a 1-in-7 `dd-docs-drift` red (that test `cpSync`s
`src/docs/docs-content.ts`, which `check:dd-docs` writes). The suspicion is
recorded as withdrawn rather than deleted, because a discarded hypothesis is
part of how the real one was reached.

## 3. Pack-gate lane — findings, no edits (report-not-fix)

`scripts/pack-gate.sh:111` runs `npm pack --dry-run --json --ignore-scripts`
inside the throwaway clone, and CI's `package-smoke` job runs on node 22 — so
npm 10.9.2 runs `prepare` there too. **It changes no assertion.** The
dist-ABSENT-then-EXISTS assertions all live in step 3, which completes before
step 4 runs; step 4's spurious rebuild writes the same output into a clone that
is deleted on exit. Cost is a few seconds, not a false green. One attributability
wrinkle worth naming: if that rebuild ever failed, step 4 would die with a build
error rather than a file-list error, i.e. the failure would arrive under the
wrong step's name.

Separately, and independent of npm version: step 3's comment claims `prepack` is
proven INDEPENDENTLY of `prepare` by clearing `dist/` and packing. The probe
above shows `prepare` fires on plain `npm pack` on **both** npm 10 and npm 11,
so that step actually proves "`prepack` or `prepare` built it" — the two hooks
are not separated by it. Both are wired in `package.json` today, so the gate is
green either way and no consumer path is unproven; the claim is simply narrower
than the comment states. Reported, not fixed: `scripts/pack-gate.sh` is outside
this packet's fence.
