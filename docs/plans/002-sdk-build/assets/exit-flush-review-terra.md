FIX_REQUIRED

Scope: e7c558f, 0133bb8, 1f2667f only. Review was performed in isolated
temporary checkouts; the active s002 worktree was not modified.

## Finding 1: the required two-row negation proof is false on Node v24.7.0

I removed `makeOutputBlocking()` from `exitWithEnvelope`, rebuilt, then ran:

```sh
npm test -- test/acts/envelope-flush.test.ts
```

The 400 KB direct driver correctly failed:

```text
AssertionError: exit=0 signal=none stdoutBytes=65536 stderr="":
expected 65536 to be greater than 400000
```

But the real-bin row passed:

```text
x delivers a payload larger than any pipe buffer, whole
✓ keeps the shipped bin honest on the same seam
```

This is expected from its actual 34 KB `dd --json graph` payload against the
64 KB pipe observed on Node 24. Its `> 8,229` assertion verifies only that the
current corpus clears a small-buffer floor; it cannot catch removal of blocking
on this runtime. Thus the stated “both regression rows red” result is not
reproducible.

The first red also does not carry the helper's literal `TRUNCATION signature`
line: it fails its `stdoutBytes` assertion before directly calling `JSON.parse`.
The only source occurrence of that signature is
`test/support/run-cli.ts:90`.

Repair the real-bin test so its own payload deterministically exceeds the
runtime pipe capacity (or otherwise exercises the shipped bin with the 400 KB
shape), and route its parse failure through `parseEnvelope(CliRun)` so the
attributed truncation signature appears in the first red.

## Finding 2: the stated 43/59 never-dependency count is not independently reproducible

An AST census at `1f2667f` finds 59 `exitWithEnvelope` call sites, but:

| Classification | Count |
| --- | ---: |
| Bare expression statements | 54 |
| Bare calls with a reachable continuation (block/if/case-aware) | 37 |
| Bare calls that naturally return after their terminal branch | 17 |
| Returned/wrapped calls | 5 |

So 59 total is correct, and the returning mutation does demonstrate the
architectural problem: after changing `exitWithEnvelope` to set
`process.exitCode` and return, `node bin/dd.js address validate
'#tasks/tk-9999'` emitted an `ok` envelope followed by an `E430` envelope
and `dd: unexpected error` on stderr. However, the exact "43 depend on
never" number needs either a documented looser definition or correction; it
does not describe actual control-flow dependence.

## Accepted tradeoff

`_handle.setBlocking` is internal and optional-chained, but keeping it is
acceptable as a targeted bridge rather than expanding this repair into a
59-site return/drain refactor. The direct 400 KB driver did red immediately
when the guard was removed (at 65,536 bytes), so it is a real watchman for
silent API loss. The requested revision is to make the separate real-bin row
an equally valid watchman on Node 24, not to require the larger refactor now.

## Confirmed

- Restoring the guard rebuilt cleanly; the flush and smoke rows passed.
- A real human-mode helper run, `runDd(['--no-json', 'status'])`, produced:
  `stdout is not JSON at all — was this run in human mode...`, not truncation.
- `process.exit(` occurs exactly once under `src/`: `src/output/exit.ts:60`.
- `package.json#exports` is byte/semantic identical across the three commits:
  14 public export-map entries.
- The final smoke suite imports the shared helper; it has no local `runDd` or
  `parseEnvelope`.
- Final AST census finds zero remaining `parseEnvelope(...stdout)` callers.
- All seven changed test files pass after a serial build: 132 tests.
- Commit fences are as stated: e7 smoke only; 0133 `src/output/exit.ts` plus
  the regression test; 1f test-support/test callers only.
