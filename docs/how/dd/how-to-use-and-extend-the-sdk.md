# How to use dd as a library (and extend its surface)

dd ships two things from one package: the `dd` **binary**, and a **library surface** you import.
This page is the second one — how to consume it, and what to do when you add a feature and want
it public.

Two rules underneath everything here:

- **The `exports` map is a commitment, not a listing.** A path that resolves is a promise you
  can build against. Adding to it is a decision; removing from it is a breaking change.
- **Importing the package runs nothing.** The root is a pure barrel. If `import '@ai-substrate/dd'`
  ever prints, executes, or exits, that is a defect — there is a gate for it.

## Consuming it

```bash
npm install @ai-substrate/dd
```

Requires Node **>= 22**. ESM only (`type: module`) — there is no `require` condition, deliberately.

The surface is deliberately small and comes in three tiers:

| Import | What lives there |
|---|---|
| `@ai-substrate/dd` | The curated barrel: parse, validate, address, the loader pair, the seam types. Start here. |
| `@ai-substrate/dd/core/*`, `/links`, `/schema/*`, `/render/renderer` | The capability modules, when you want one thing without the barrel. |
| `@ai-substrate/dd/node` | The **Node-bound** tier: fs adapter, git tracked-set, the CLI issue-code vocabulary, document rendering. Anything that needs a host lives here, never in the core tree. |

Not exported, and not by accident: `./acts/*` (the CLI's own half) and `./plan` (plan semantics
are the consumer's to express on primitives — see the plan-002 record for why).

### You bring the ports — that is the design

dd never constructs its own filesystem, hash, or clock. You pass them in, and they are
**structural interfaces**, so anything shaped right satisfies them — including a port your app
already has. That is the whole reason dd is consumable as a library rather than something you
shell out to.

The two shapes you will most often implement:

```ts
// what a schema resolver and the document loader read with
interface FsLike  { readText(path: string): string | null }   // null = not found, never throw
interface HashLike { sha256Hex(input: string): string }        // NOTE the name — see below
```

A worked wiring, and the exact shape a real consumer uses:

```ts
import {
  ConventionSchemaResolver,
  FsDocLoader,
  MemoizingDocLoader,
  validateWalk,
} from '@ai-substrate/dd';

const schemaResolver = new ConventionSchemaResolver({
  fs: myFsPort,          // your port, not one of ours
  repoRoot,
  ...(home !== undefined && { home }),   // omit rather than pass undefined
});

const docLoader = new MemoizingDocLoader(
  new FsDocLoader(myFsPort, myHashPort, /* tracked */ null),
);

const result = validateWalk(doc, { schemaResolver, docLoader }, options);
```

Three things that are easy to get wrong, all of them measured rather than guessed:

- **`sha256Hex`, not `sha256`.** The method name is part of the contract, and a JS consumer
  discovers that by crashing. Named here so you do not have to.
- **The loader pair is one expression.** `MemoizingDocLoader` decorates `FsDocLoader`; the
  memoizer alone is not a loader. (This was a real defect — the wrapper was exported and the
  wrapped was not, so the pattern could not be built at all.)
- **`tracked` is `boolean | null`, and `null` is not `false`.** `null` means *this host has no
  tracking concept* — not "nothing is tracked". Branch with `=== false`, never `!tracked`, or
  you will fire untracked-target findings on every host that does not use git.

### Proving your integration

The repo ships a fixture that does exactly this against a **packed tarball** — not the source
tree — because "exported" and "actually in the published package" are two different claims:

```bash
just check-trial     # installs the tarball into a scratch project and runs a real consumer
```

If you are integrating dd elsewhere, that fixture is the reference implementation. Copy its
shape rather than the source's.

## Extending the surface

Adding a feature to dd does **not** automatically mean adding to the SDK. Most changes need
nothing here. Work out which case you are in first:

| You are… | SDK work |
|---|---|
| Changing internals of an existing module | **None.** Nothing you need to do. |
| Adding a symbol you want consumers to use | Three steps, below. |
| Adding a whole new capability area | Three steps + a new subpath in `exports`. |
| Adding something Node-bound (fs, git, process, rendering) | Same, but it lands in `./node` — **never** in the core tree. |

### The three steps

1. **Export it from its module** — ordinary `export`.
2. **Add it to the barrel** it belongs to: `src/lib.ts` (root) or `src/node/index.ts`. The
   root barrel is an allowlist, and *every addition is an API review* — that is not ceremony,
   it is the point.
3. **Add it to the ratified list** in `scripts/exports-reachability-probe.mjs`. The gate holds
   an exact set per surface and fails **both** directions: a symbol you export without listing
   is a surplus (red), a symbol you list without exporting is missing (red).

Then:

```bash
just checks         # includes the reachability + membership gate
just check-trial    # proves it survives packing and installing
```

**Why step 3 is not busywork.** The lists are hand-maintained literals, deliberately. A gate
that derived them from the code would agree with whatever the code did and catch nothing — it
would pass on the exact mistake it exists to prevent. Editing a literal is what puts a new
public symbol in a diff where a reviewer sees it.

### The purity boundary

The SDK tree (`core`, `links`, `schema`, `render`, `shared`, `docs`, `mutate`, `plan`) must not
import `adapters/` or `output/`. An architecture test enforces it — including through bare
self-referential specifiers, so you cannot route around it by importing the package by name.

If your new code needs a Node adapter or the CLI's error vocabulary, that is not a signal to
weaken the gate; it is the gate telling you the code belongs in `src/node/` or `src/acts/`. A
symbol that needs a host belongs in the tier named for having one.

### What not to do

- **Do not add `./acts/*` or `./plan` to the exports map.** They are excluded by ruling, not by
  oversight.
- **Do not remove or rename a public symbol** without treating it as a breaking change — it is
  one, including for types.
- **Do not "fix" a red gate by editing the gate.** If the membership gate reds, either you meant
  to publish something (list it) or you did not (unexport it). Widening the list to make a red
  go away publishes API by accident, which is precisely what it is watching for.
