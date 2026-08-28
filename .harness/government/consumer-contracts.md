# Consumer contracts — what external consumers depend on, and what we owe them

**Single-writer**: the o-prime. **Created 2026-08-28** after I broke a notification promise within a
day of making it: I told `pij-driving-nigel` (flowspace3) in writing, twice, that PR #12 was open and
that I would tell them the day it landed — then merged it, relinked the binary they measure against,
and said nothing. Their coder found out by going to record a test fixture and finding the promised
shape absent. **The detection was coincidence.**

A promise living only in a message is not a contract; it is a hope with a timestamp. This file is
the durable record. **Where a mechanism exists, the mechanism is the working part and this file is
the backup** — a comment at the definition site is read by whoever is about to break the thing, at
the moment they are about to break it.

---

## flowspace3 — `AI-Substrate/flowspace3`, plan 008-ddocs-scan

**Contact**: `pij-driving-nigel` (PM), `pij-instant-lynx` (o-prime).
**What they build**: native indexing of `*.dd.json` in a Rust semantic-search engine. They consume
the CLI over the envelope; **they are Rust, so a Node subpath export is unreachable to them** — a
thing I offered once and was correctly told was useless.

### Shapes they depend on — breaking any of these breaks them

Their list, accepted by me as a contract on 2026-08-28:

| shape | risk |
|---|---|
| `dd.schema`, `dd.sweep_exclude` | stable |
| `sections[].name` / `.value` | stable |
| the minted-id prefix set (`src/core/constants.ts`) | **GROWS** — they treat the prefix as metadata, never as a gate |
| schema shape types `text`/`string`/`state`/`enum`/`link`, and `gate_terminal` | stable |
| graph envelope edge fields `from`/`to`/`address`/`rel`/`kind`/`location` | `kind` arrived with file links (`5aa18b7`) |

### The `derive` relation set — a live coupling

`ddocs derive` follows **only** `derives` and `satisfies` (ruled 2026-08-28; `proven_by`,
`pressure`, `implemented_by`, `ref` and unknown relations are NOT followed). flowspace3 invalidates
its cached rollups by walking a **new** document's outbound edges **in that same set**.

**If the followed set changes, their invalidation target set must change with it or they go stale
silently — and stale is invisible from their side.** Changing it is a consumer-visible change:
**notify before it merges.** The working mechanism is a comment at the definition site of the set;
this row is the backup.

### What we owe them, concretely

- **Any change to a verb's `data` payload gets a message BEFORE it merges, not after.**
- The envelope (`{command, status, data, error?, next_action?, timestamp}`) is the frozen contract;
  per-verb `data` is not, and has moved within a month.

### Open ask, raised by them and evidenced

**A payload/schema revision integer alongside `version`.** `ddocs --json version` reported `0.1.0`
before and after a payload shape change, so the key we told them to stamp **cannot detect the change
it exists to detect**. Their framing, kept because it is the argument: *"a defect class whose only
detector is coincidence has an unbounded window."* With Jordan, undecided.
