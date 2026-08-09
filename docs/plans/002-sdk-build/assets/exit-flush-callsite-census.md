# Exit-flush proof repair — the corrected call-site census

Reviewer finding 3, `test/acts/envelope-flush.test.ts` repair packet.

## What was wrong

`src/output/exit.ts` justified refusing the prescribed fix shape (set
`process.exitCode` and return, the treatment `emitRawAndExit` already gets) with
this claim:

> `exitWithEnvelope` is declared `never` and **43 of its 59 call sites** rely on
> that.

Terra's independent AST semantic pass found **37 of 59**. Two derivations, two
numbers, one of them load-bearing for a shipped design decision.

## The re-derivation

Run over every `src/**/*.ts` except `src/output/exit.ts` itself, classifying each
`exitWithEnvelope` call by asking one question: **if this call returned instead of
exiting, would control resume and execute more of this command's work?**

| class | count | meaning |
| --- | --- | --- |
| live-continuation | **38** | at least one further statement runs — the site depends on `never` |
| bare-return | 1 | the next statement is a bare `return;` — resuming is harmless |
| helper-body | 2 | the call IS the body of a `never`-declared local `fail` arrow |
| end-of-function | 18 | nothing follows anywhere up to the function boundary |
| **total** | **59** | |

`59` is the population and it is stable across every method tried.

## The two numbers reconcile exactly

The 38 live-continuation sites split by directory:

- **37** in `src/acts/**`
- **1** elsewhere: `src/app.ts:162`, whose next statement is `throw err`

So **terra's 37 is this same census scoped to `src/acts/`**. It is not a
contradiction and neither figure is wrong — the populations differed. Matching
the scope makes the two derivations agree to the site.

`src/app.ts:162` is worth naming rather than rounding away, because it is the
single strongest piece of evidence for the refusal: on the returning build it
produced the unhandled `dd: unexpected error:` line observed after an already
emitted envelope.

**43 does not reproduce under any method defensible here, and is withdrawn.**
It came from a hand-walked pass that was not preserved as a re-runnable artifact,
which is the whole reason it could be wrong without anyone noticing. The
classifier below is recorded verbatim so the number can be re-derived, disagreed
with, or re-scoped by anyone.

## Why the classification is not obvious

Two traps, both of which changed the number when fixed:

1. **Arrow-body sites.** `src/acts/write.ts:85` and `src/acts/link.ts:149` are
   `const fail = (…): never => exitWithEnvelope(…)`. A walk that climbs to the
   nearest enclosing *statement* sails past the arrow and lands on the next
   statement of the surrounding function — which is not where control would
   resume. It resumes in `fail`'s **callers** (6 in `write.ts`, 2 in `link.ts`),
   each of which then continues. Counted separately rather than folded in either
   direction, since the dependency is real but indirect.
2. **Fall-through out of nested blocks.** 56 of the 59 sites sit inside an `if`.
   Checking only the immediately enclosing block reports "nothing follows" for a
   site whose function continues right after the `if` closes. The walk has to
   climb every enclosing block up to the function boundary, and stop there.

The conclusion the figure supports is unchanged at 43, 38 or 37: the returning
shape emits two envelopes from `dd address validate` and throws unhandled from
`dd <unknown-verb>`, `tsc` catches only 34 sites, and the remainder fail
silently. The refusal stands; the number now matches what is in the tree.

## The classifier

```js
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync("grep -rl 'exitWithEnvelope(' src --include=*.ts", { encoding: 'utf8' })
  .trim().split('\n').filter((f) => f !== 'src/output/exit.ts');

const rows = [];
for (const file of files) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true);
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'exitWithEnvelope')
      rows.push({ file, line: src.getLineAndCharacterOfPosition(n.getStart()).line + 1, ...classify(n, src) });
    ts.forEachChild(n, visit);
  };
  visit(src);
}

function classify(call, src) {
  // Nearest enclosing STATEMENT, never crossing a function boundary: a call that
  // is an arrow's expression body resumes in the arrow's CALLERS, not here.
  let node = call;
  while (node.parent && !ts.isStatement(node)) {
    if (ts.isFunctionLike(node.parent) && node.parent.body === node) return { kind: 'helper-body' };
    node = node.parent;
  }
  let cur = node;
  while (cur?.parent) {
    const p = cur.parent;
    if (ts.isBlock(p) || ts.isSourceFile(p) || ts.isCaseClause(p) || ts.isDefaultClause(p)) {
      const list = p.statements;
      const i = list.indexOf(cur);
      if (i >= 0 && i + 1 < list.length) {
        const f = list[i + 1];
        return { kind: ts.isReturnStatement(f) && !f.expression ? 'bare-return' : 'live-continuation' };
      }
    }
    if (ts.isFunctionLike(p)) return { kind: 'end-of-function' }; // climbed out of the act
    cur = p;
  }
  return { kind: 'end-of-function' };
}
```

Cross-checked against an independent textual pass (everything between the call's
statement and the end of its enclosing function, stripped of punctuation, must be
empty for `end-of-function`). The two agreed on 18 once the arrow-body trap was
fixed in both; the four sites where they first disagreed were exactly the traps
above, which is how the traps were found.

## Where the corrected figure now lives

- `src/output/exit.ts` — the design comment, corrected to 38 **with its scope
  stated inline**, since an unscoped count is how 43 survived.
- This note — the derivation, the classifier, and the reconciliation.
