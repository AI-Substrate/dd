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

---

## harness-engineering — `AI-Substrate/harness-engineering`

**Contact**: `pij-massive-meadowlark` (o-prime), `pij-related-koala`.
**How they consume**: a **github: pin** — `github:AI-Substrate/dd#<sha>` — not a version range,
because nothing has ever been published. Bumping to `de01b77a` as of 2026-08-30, from `a37a20ec`.

### The surface they actually import — measured by them, 2026-08-30, counts are import statements

| subpath | count | named symbols they cited |
|---|---:|---|
| `./links` | 7 | `resolveMapSeed`, `traverseCorpus`, `DdAddressableKind` |
| `.` (root barrel) | 5 | `ConventionSchemaResolver`, `FsDocLoader`, `MemoizingDocLoader`, `parseAddress`, `isAddressFailure`, `DdDoc` |
| `./core/model` | 4 | |
| `./core/validate` | 3 | `DdSeverity` |
| `./schema` | 2 | |
| `./core/walk` | 2 | |
| `./schema/model` | 1 | `SchemaIssue` |
| `./render/renderer` | 1 | `escapeCell`, `headingSlug` |
| `./node` | 1 | |
| `./core/parse` | 1 | |

**No `./plan` imports** — verified by them before my warning arrived and re-asserted after.

**Payload shapes they read**: `ddocs build` output (so the `file_findings` addition is
consumer-visible) and `validate` findings (so the E463 tally-absence behaviour change moved a
number they read).

### THE BIN IS A CONSUMER CONTRACT, and it is their largest dependency on us

**27 files in their tree invoke `node_modules/.bin/dd`.** That is more places than any import
subpath, and it is a *documentation-and-scripts* surface, so no compiler catches it.

**We renamed that binary `dd` → `ddocs` (`9b8cc8e`) and told nobody.** The rename was right —
`dd` collides with POSIX `dd(1)` and resolves to coreutils on any machine where the npm global bin
dir precedes `/bin` — but the break landed on a consumer who found out by going 115 commits stale
and then reading a list I only wrote because they asked. **A `bin` field is public API. Treat a
rename of it as a breaking change with a named consumer, because it is one.**

### What we owe them

- Same as flowspace3: **any change to a verb's `data` payload, or to the `bin` name, gets a message
  BEFORE it merges.**
- A warning on any change to the ten subpaths above, and especially to `./links`, which is their
  heaviest.

### Shared blockers, recorded because both consumers hit them

- **The github: pin cannot be installed by bun 1.4** (`IntegrityCheckFailed` on the pinned tarball;
  their backlog row 5). A published version range kills it.
- **Pins rot silently.** This one reached 115 commits behind, spanning a binary rename, with no
  signal. Nothing in a github: pin can tell a consumer it is stale.
- **The npm name's public status is unknowable from either government's machines** — both resolve
  through the corporate proxy, which 404s the package, and neither can reach `registry.npmjs.org`
  (`ENOTCONN`). **Someone must check from an unmanaged network before the publish token is spent.**
- **Publishing will not make us installable on managed machines immediately** — the screened feed
  lags by up to about a week. Public and uninstallable is an expected window, not a fault.

---

## This seat's identity — a mapping, recorded before it is needed

**2026-09-02.** The pij platform is migrating from the legacy TypeScript daemon to a Rust one. I
adopted into `rs` minutes before a *"primes do not adopt yet"* hold landed, so **this seat is
DUAL-PRESENT**:

| generation | id | resolves |
|---|---|---|
| legacy | **`pij-mental-dajeil`** | `pij whoami` |
| rs | **`pij-joyous-rooster`** | `pij-rs whoami` |

Same pane `%285`, same pid, same folder. Jordan's ruling, relayed 2026-09-02: **HOLD — the legacy
daemon stays up until plan 129 (`migrate-seat`) lands, primes do not adopt, and a seat that already
adopted is dual-present rather than lost. Do not un-adopt.**

**RESOLVED, same day — the name is preserved.** Ruling `req-0039(d)` from `pij-still-weasel`: a
pre-existing `rs` row does **not** block 129. `migrate-seat` **re-keys that row to the legacy name**
and leaves a forward alias on the interim id. `pij-joyous-rooster` is the named case. **So adopting
early did not cost this seat its name**, every citation below stays resolvable, and the table is now
a record of an interim state rather than a rename to be propagated. **The argument still had to be
made** — the preservation is a ruling, not a property of the system, and it was made because a seat
said what the rename would break.

**Why this is recorded here rather than left in a message.** `pij-mental-dajeil` is the seat of
record throughout `.harness/government/`, is addressed by name in **harness-engineering's** and
**flowspace3's** committed plan documents, and is the identity this repo's conversation is indexed
under in flowspace3. A rename without preservation turns every one of those into a dangling
pointer **in other people's repos**, and the seat that could explain the mapping is the one that got
renamed. That argument is what the hold is protecting; this table is what survives if it fails.

**Operationally, while dual-present**: adopting into `rs` makes `pij send` route to `rs` and
**refuse to fall back**, so an early-moved seat is mute toward everyone still on legacy. The escape
hatch is an environment variable, not a flag, and it is verified working from this seat:

```bash
PIJ_DAEMON_GENERATION=legacy pij send <legacy-id> --body-file <path>
```

**If the rename ever stands**: publish the mapping to both consumer governments *before* their
documents go stale, and keep the OLD id beside the new one wherever the new one is published — a
stale document needs a mapping, not a forwarding address.

### The peers this file names, and their rs ids

**Every legacy id written anywhere in this repo's government means the rs id beside it.** Recorded
2026-09-02 while the mapping still had a living author; `pij-varied-alpaca` (harness-engineering)
maintains the cross-government copy at
`substrate/harness-engineering/scratch/convo-rs-identity/meadowlark-rs-id.txt`.

| government | legacy id (as written in this repo) | rs id |
|---|---|---|
| dd (this seat) | `pij-mental-dajeil` | `pij-joyous-rooster` |
| harness-engineering | `pij-massive-meadowlark` | `pij-varied-alpaca` |
| flowspace3 | `pij-instant-lynx` | `pij-binding-magpie` |
| pij | `pij-still-weasel` | rs-native, no legacy id |
| (PM) | `pij-respectable-clam` | `pij-elegant-skink` |

**Not recorded for tidiness.** This file, `orient-local.md`, `how-fleets-work.md` and this repo's
backlog all cite peers by their legacy names, as do two other governments' documents citing me.
**The mapping is the only thing that makes those citations resolvable after a shutdown**, and it is
cheapest to write while every seat in it is still alive to confirm its own row.
