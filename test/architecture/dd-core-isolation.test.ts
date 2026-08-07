import { readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? tsFiles(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].flatMap(
    (match) => (typeof match[1] === 'string' ? [match[1]] : []),
  );
}

function importTarget(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  return normalize(resolve(dirname(fromFile), specifier.replace(/\.js$/, '.ts')));
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
): string[] {
  const violations: string[] = [];
  const visited = new Set<string>();

  const visit = (file: string, trace: readonly string[]): void => {
    if (visited.has(file)) return;
    visited.add(file);
    const source = sources.get(file);
    if (source === undefined) return;

    for (const specifier of importSpecifiers(source)) {
      if (specifier.startsWith('node:')) {
        violations.push(`node builtin: ${[...trace, specifier].join(' -> ')}`);
        continue;
      }
      const target = importTarget(file, specifier);
      if (target === null) continue;
      const kind = classifyTarget(target);
      const targetLabel = relative(SRC, target).replaceAll('\\', '/');
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
 * nothing else. A relative specifier that escapes the SDK tree (into acts/,
 * output/, adapters/, or out of src/ entirely) and any bare specifier that is not
 * `node:` are both reported, with the file that introduced them.
 */
function externalImports(
  files: readonly string[],
  read: (file: string) => string = (file) => readFileSync(file, 'utf8'),
): string[] {
  const sdkRoots = SDK_DIRS.map((dir) => join(SRC, dir));
  const escapes: string[] = [];

  for (const file of files) {
    const label = relative(SRC, file).replaceAll('\\', '/');
    for (const specifier of importSpecifiers(read(file))) {
      if (!specifier.startsWith('.')) {
        if (!specifier.startsWith('node:')) escapes.push(`bare: ${label} -> ${specifier}`);
        continue;
      }
      const target = importTarget(file, specifier);
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

  it('keeps production dd-core transitively free of output, acts, adapters, and node builtins', () => {
    const files = tsFiles(SRC);
    const sources = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));
    expect(isolationViolations(tsFiles(CORE), sources)).toEqual([]);
  });

  it('keeps the whole SDK tree free of external imports (ac-0001)', () => {
    expect(externalImports(sdkFiles())).toEqual([]);
  });
});
