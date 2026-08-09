import { readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * PORTED from harness-engineering `harness/cli/test/architecture/dd-core-isolation.test.ts`
 * (basis d08f4942d28b7e5181d5845a56a63b0cbb1d3402), adapted to this repo's layout.
 *
 * Upstream the SDK sat at `src/services/dd/**`; here it IS `src/{core,docs,links,
 * mutate,plan,render,schema,shared}` and the CLI stub owns `src/{acts,output,
 * adapters}`. The boundary the guard protects is unchanged: dd-core is pure, and
 * nothing in the SDK reaches out to the CLI shell.
 *
 * One upstream assertion is deliberately NOT ported: the dependency-cruiser
 * `reachable: true` check. This repo has no `.dependency-cruiser.cjs` — the
 * transitive walk below is the whole mechanism here rather than a second belt on
 * a dependency-cruiser rule. Its slot is taken by the SDK-tree external-import
 * gate (plan 001, ac-0001), which is the check this repo actually needs: KF-1
 * says dd had exactly ONE external import upstream, so any NEW one is a defect
 * and this is what catches it mechanically.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(REPO_ROOT, 'src');
const CORE = join(SRC, 'core');

/** The dd SDK tree — every directory the port lands in. */
const SDK_DIRS = ['core', 'docs', 'links', 'mutate', 'plan', 'render', 'schema', 'shared'];

/** The subset of package.json this gate resolves internal specifiers against. */
type Manifest = {
  readonly name?: string;
  readonly exports?: Record<string, unknown>;
  readonly imports?: Record<string, unknown>;
};

const MANIFEST = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as Manifest;

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? tsFiles(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}

/**
 * Every module specifier this file IMPORTS — read from the parsed syntax tree,
 * never matched out of the text.
 *
 * This used to be a regex over the raw source, and it counted specifier-shaped
 * TEXT: `src/docs/docs-content.ts` inlines each shipped doc as a string literal,
 * so the SDK how-to's worked example (`import { … } from '@ai-substrate/dd'`)
 * was read as an import and reported as a self-reference. Documentation that
 * cannot show an import is not documentation, so the instrument was wrong, not
 * the doc.
 *
 * The narrower repair — skip string and template literals — was measured and
 * REFUSED: the same regex matches inside comments, where `/** Example: import
 * '../output/envelope.js' *\/` reads as an SDK-tree escape. A JSDoc example in
 * any SDK file would have tripped it. Parsing removes the whole class instead of
 * the instance that happened to bite: the compiler decides what an import is.
 *
 * Measured against the old regex over all of `src/` at the time of the change:
 * identical output on every file except `docs/docs-content.ts`, where the regex
 * additionally claimed `@ai-substrate/dd` and `./model.js` — the second one green
 * only by luck, because `src/docs/model.ts` would have landed inside the SDK tree.
 *
 * `require()` is not collected, as it was not before: this repo is ESM-only and
 * the manifest has no `require` condition.
 */
function importSpecifiers(file: string, source: string): string[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const specifiers: string[] = [];

  const collect = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (moduleSpecifier !== undefined && ts.isStringLiteralLike(moduleSpecifier)) {
        specifiers.push(moduleSpecifier.text);
      }
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, collect);
  };

  collect(tree);
  return specifiers;
}

/** Every string leaf of an exports/imports value, conditions flattened. */
function conditionTargets(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(conditionTargets);
  }
  return [];
}

/**
 * `./dist/core/parse.js` -> `<src>/core/parse.ts`. tsconfig pins rootDir=src and
 * outDir=dist, so this mapping is a bijection rather than a guess; anything the
 * manifest points at OUTSIDE dist/ (`./package.json`) has no source file and is
 * reported as unresolvable rather than invented.
 */
function distToSource(target: string): string | null {
  const rel = target.replace(/^\.\//, '');
  if (!rel.startsWith('dist/')) return null;
  const inner = rel
    .slice('dist/'.length)
    .replace(/\.d\.ts$/, '.ts')
    .replace(/\.js$/, '.ts');
  return normalize(join(SRC, inner));
}

/** Resolve one subpath key through an exports/imports map, `*` patterns included. */
function mapSubpath(map: Record<string, unknown>, key: string): string | null {
  for (const target of conditionTargets(map[key])) {
    const source = distToSource(target);
    if (source !== null) return source;
  }
  for (const [pattern, value] of Object.entries(map)) {
    const star = pattern.indexOf('*');
    if (star === -1) continue;
    const head = pattern.slice(0, star);
    const tail = pattern.slice(star + 1);
    if (!key.startsWith(head) || !key.endsWith(tail) || key.length < head.length + tail.length) {
      continue;
    }
    const filled = key.slice(head.length, key.length - tail.length);
    for (const target of conditionTargets(value)) {
      const source = distToSource(target.replaceAll('*', filled));
      if (source !== null) return source;
    }
  }
  return null;
}

/**
 * Bare specifiers that are NOT third-party: the package's own name (a self-
 * reference through `exports`) and a `#alias` (a subpath through `imports`).
 * Both land on a file in this repo, so both cross the very boundaries this gate
 * exists to police — and both used to be invisible to it.
 *
 * External package names (`commander`, `jiti`) are deliberately NOT resolved.
 * This gate polices INTERNAL crossings; a third-party import is judged by
 * `externalImports` on its name alone and never followed into node_modules.
 */
function internalTarget(specifier: string, manifest: Manifest = MANIFEST): string | null {
  if (specifier.startsWith('#')) return mapSubpath(manifest.imports ?? {}, specifier);
  const name = manifest.name;
  if (name === undefined) return null;
  if (specifier === name) return mapSubpath(manifest.exports ?? {}, '.');
  if (specifier.startsWith(`${name}/`)) {
    return mapSubpath(manifest.exports ?? {}, `.${specifier.slice(name.length)}`);
  }
  return null;
}

function importTarget(
  fromFile: string,
  specifier: string,
  manifest: Manifest = MANIFEST,
): string | null {
  if (!specifier.startsWith('.')) return internalTarget(specifier, manifest);
  return normalize(resolve(dirname(fromFile), specifier.replace(/\.js$/, '.ts')));
}

/** Name the specifier that produced a target when the path alone would not show it. */
function edgeLabel(target: string, specifier: string): string {
  const label = relative(SRC, target).replaceAll('\\', '/');
  return specifier.startsWith('.') ? label : `${label} (via ${specifier})`;
}

function classifyTarget(target: string): string | null {
  const relativeTarget = relative(SRC, target).replaceAll('\\', '/');
  if (relativeTarget.startsWith('output/')) return 'output';
  if (relativeTarget.startsWith('acts/')) return 'acts';
  if (relativeTarget.startsWith('adapters/')) return 'adapters';
  return null;
}

function isolationViolations(
  entryFiles: readonly string[],
  sources: ReadonlyMap<string, string>,
  manifest: Manifest = MANIFEST,
): string[] {
  const violations: string[] = [];
  const visited = new Set<string>();

  const visit = (file: string, trace: readonly string[]): void => {
    if (visited.has(file)) return;
    visited.add(file);
    const source = sources.get(file);
    if (source === undefined) return;

    for (const specifier of importSpecifiers(file, source)) {
      if (specifier.startsWith('node:')) {
        violations.push(`node builtin: ${[...trace, specifier].join(' -> ')}`);
        continue;
      }
      const target = importTarget(file, specifier, manifest);
      if (target === null) continue;
      const kind = classifyTarget(target);
      const targetLabel = edgeLabel(target, specifier);
      if (kind) {
        violations.push(`${kind}: ${[...trace, targetLabel].join(' -> ')}`);
        continue;
      }
      visit(target, [...trace, targetLabel]);
    }
  };

  for (const entry of entryFiles) {
    visit(entry, [relative(SRC, entry).replaceAll('\\', '/')]);
  }
  return violations;
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * ac-0001 — the SDK tree imports node: builtins or its own relative files, and
 * nothing else. Three kinds of escape are reported, each with the file that
 * introduced it:
 *
 * - `escapes SDK tree:` a relative specifier landing outside the SDK dirs
 *   (in acts/, output/, adapters/, or out of src/ entirely);
 * - `self-reference:` a bare specifier that resolves BACK INTO this repo through
 *   the package's own `exports` or an `#alias` in `imports` — it lands on a real
 *   source file, and is reported even when that file is inside the SDK tree,
 *   because routing through dist/ is exactly the boundary crossing this gate
 *   exists to see;
 * - `bare:` any other non-`node:` specifier, judged on its NAME alone.
 *
 * External package names (`commander`, `jiti`) are deliberately never resolved
 * or followed into node_modules: this gate polices INTERNAL crossings, and a
 * third-party import is already a defect by its name.
 */
function externalImports(
  files: readonly string[],
  read: (file: string) => string = (file) => readFileSync(file, 'utf8'),
  manifest: Manifest = MANIFEST,
): string[] {
  const sdkRoots = SDK_DIRS.map((dir) => join(SRC, dir));
  const escapes: string[] = [];

  for (const file of files) {
    const label = relative(SRC, file).replaceAll('\\', '/');
    for (const specifier of importSpecifiers(file, read(file))) {
      if (specifier.startsWith('node:')) continue;
      const target = importTarget(file, specifier, manifest);
      if (!specifier.startsWith('.')) {
        escapes.push(
          target === null
            ? `bare: ${label} -> ${specifier}`
            : `self-reference: ${label} -> ${edgeLabel(target, specifier)}`,
        );
        continue;
      }
      if (target === null) continue;
      if (!sdkRoots.some((root) => isInside(root, target))) {
        escapes.push(
          `escapes SDK tree: ${label} -> ${relative(SRC, target).replaceAll('\\', '/')}`,
        );
      }
    }
  }
  return escapes;
}

function sdkFiles(): string[] {
  return SDK_DIRS.flatMap((dir) => tsFiles(join(SRC, dir)));
}

describe('architecture — dd-core isolation', () => {
  it('detects deliberate direct and transitive boundary violations', () => {
    const direct = join(CORE, 'direct-violation.ts');
    const transitive = join(CORE, 'transitive-violation.ts');
    const intermediary = join(SRC, 'links', 'synthetic-intermediary.ts');
    const sources = new Map([
      [
        direct,
        `
      import '../output/envelope.js';
      import '../acts/status.js';
      import '../adapters/fs/node-fs.js';
        `,
      ],
      [transitive, `import '../links/synthetic-intermediary.js';`],
      [intermediary, `import '../output/envelope.js';`],
    ]);
    expect(isolationViolations([direct, transitive], sources)).toEqual([
      'output: core/direct-violation.ts -> output/envelope.ts',
      'acts: core/direct-violation.ts -> acts/status.ts',
      'adapters: core/direct-violation.ts -> adapters/fs/node-fs.ts',
      'output: core/transitive-violation.ts -> links/synthetic-intermediary.ts -> output/envelope.ts',
    ]);
  });

  it('detects a deliberate external import in the SDK tree (ac-0001 red case)', () => {
    const offender = join(SRC, 'links', 'synthetic-external.ts');
    const sources = new Map([
      [
        offender,
        `
      import { posixJoin } from '../shared/posix-path.js';
      import { readFileSync } from 'node:fs';
      import { Command } from 'commander';
      import { envelope } from '../output/envelope.js';
        `,
      ],
    ]);
    expect(externalImports([offender], (file) => sources.get(file) ?? '')).toEqual([
      'bare: links/synthetic-external.ts -> commander',
      'escapes SDK tree: links/synthetic-external.ts -> output/envelope.ts',
    ]);
  });

  it('detects a bare self-reference that a name-only judgement would call third-party', () => {
    const offender = join(SRC, 'links', 'synthetic-self-reference.ts');
    const sources = new Map([
      [
        offender,
        `
      import { parse } from '@ai-substrate/dd/core/parse';
      import { load } from '#internal/loader.js';
      import { Command } from 'commander';
      import manifest from '@ai-substrate/dd/package.json';
        `,
      ],
    ]);
    expect(
      externalImports([offender], (file) => sources.get(file) ?? '', {
        ...MANIFEST,
        imports: { '#internal/*.js': './dist/links/*.js' },
      }),
    ).toEqual([
      'self-reference: links/synthetic-self-reference.ts -> core/parse.ts (via @ai-substrate/dd/core/parse)',
      'self-reference: links/synthetic-self-reference.ts -> links/loader.ts (via #internal/loader.js)',
      'bare: links/synthetic-self-reference.ts -> commander',
      'bare: links/synthetic-self-reference.ts -> @ai-substrate/dd/package.json',
    ]);
  });

  it('follows a bare self-reference transitively, as it follows a relative one', () => {
    const direct = join(CORE, 'bare-violation.ts');
    const aliased = join(CORE, 'alias-violation.ts');
    const nodeTier = join(SRC, 'node', 'index.ts');
    const intermediary = join(SRC, 'links', 'synthetic-intermediary.ts');
    const sources = new Map([
      [direct, `import '@ai-substrate/dd/node';`],
      [aliased, `import '#internal/synthetic-intermediary.js';`],
      [nodeTier, `import '../adapters/fs/node-fs.js';`],
      [intermediary, `import '../output/envelope.js';`],
    ]);
    expect(
      isolationViolations([direct, aliased], sources, {
        ...MANIFEST,
        imports: { '#internal/*.js': './dist/links/*.js' },
      }),
    ).toEqual([
      'adapters: core/bare-violation.ts -> node/index.ts (via @ai-substrate/dd/node) -> adapters/fs/node-fs.ts',
      'output: core/alias-violation.ts -> links/synthetic-intermediary.ts (via #internal/synthetic-intermediary.js) -> output/envelope.ts',
    ]);
  });

  it('reads imports from syntax, not from specifier-shaped text in strings or comments', () => {
    const offender = join(SRC, 'links', 'synthetic-doc-example.ts');
    const source = [
      `// A doc example in a line comment: import { Command } from 'commander';`,
      '/**',
      ' * And one in a block comment:',
      ` *   import { envelope } from '../output/envelope.js';`,
      ' */',
      "const inTemplate = `import { validateWalk } from '@ai-substrate/dd';`;",
      `const inBakedDoc = "import { parse } from '@ai-substrate/dd/core/parse';";`,
      `const dynamic = "await import('../acts/status.js')";`,
      `import { posixJoin } from '../shared/posix-path.js';`,
      `import { load } from '#internal/loader.js';`,
      `import { Command } from 'commander';`,
    ].join('\n');

    // Only the three real statements are imports. The five specifier-shaped
    // strings above them are the shapes that actually occur: `docs-content.ts`
    // bakes every shipped doc as a double-quoted literal, and any SDK file may
    // carry a usage example in a comment. Both arms are asserted here on ONE
    // file, so the fix cannot become a way to hide a real import inside a
    // template literal — the two live imports below still red by name.
    expect(
      externalImports([offender], () => source, {
        ...MANIFEST,
        imports: { '#internal/*.js': './dist/links/*.js' },
      }),
    ).toEqual([
      'self-reference: links/synthetic-doc-example.ts -> links/loader.ts (via #internal/loader.js)',
      'bare: links/synthetic-doc-example.ts -> commander',
    ]);
  });

  it('keeps production dd-core transitively free of output, acts, adapters, and node builtins', () => {
    const files = tsFiles(SRC);
    const sources = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));
    expect(isolationViolations(tsFiles(CORE), sources)).toEqual([]);
  });

  it('keeps the whole SDK tree free of external imports (ac-0001)', () => {
    expect(externalImports(sdkFiles())).toEqual([]);
  });
});
