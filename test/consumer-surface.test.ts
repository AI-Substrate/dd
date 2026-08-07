import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Type-level half of the proof: these resolve through the package's OWN exports map
// (Node self-reference), so `npm run typecheck` fails if a subpath stops carrying its
// declarations — a runtime import alone would not notice.
import type { DdDoc } from '@ai-substrate/dd/core/model';
import type { DdIssue } from '@ai-substrate/dd/core/validate';
import type { SchemaIssue } from '@ai-substrate/dd/schema/model';
import { describe, expect, it } from 'vitest';

/**
 * ac-0002 / dw-0005 — the consumer surface, proven one subpath at a time.
 *
 * Every specifier below was OBSERVED in a harness consumer (research dossier F-04).
 * The test imports by the package's own name, so resolution goes through the real
 * `exports` map in package.json rather than a relative path that would pass whether
 * or not the map exists. That is the whole point: koala must be able to write these
 * exact specifiers, and a relative-path test would prove nothing about that.
 *
 * SKELETON, not a freeze. The freeze is phase 3, after OQ-1/OQ-2 are ruled.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
  exports: Record<string, unknown>;
};

/** subpath → one named symbol a consumer imports from it (F-04). */
const SURFACE = [
  { subpath: '@ai-substrate/dd/core/address', symbols: ['parseAddress', 'isAddressFailure'] },
  { subpath: '@ai-substrate/dd/core/parse', symbols: ['parse'] },
  { subpath: '@ai-substrate/dd/core/validate', symbols: ['collectLinkCells'] },
  { subpath: '@ai-substrate/dd/core/walk', symbols: ['validateWalk'] },
  {
    subpath: '@ai-substrate/dd/links',
    symbols: ['MemoizingDocLoader', 'resolveMapSeed', 'traverseCorpus'],
  },
  { subpath: '@ai-substrate/dd/schema/resolve', symbols: ['ConventionSchemaResolver'] },
  { subpath: '@ai-substrate/dd/schema/index', symbols: ['ConventionSchemaResolver'] },
  { subpath: '@ai-substrate/dd/schema/model', symbols: ['SUPPORTED_SCHEMA_VERSION'] },
  { subpath: '@ai-substrate/dd/render/renderer', symbols: ['escapeCell', 'headingSlug'] },
] as const;

describe('consumer surface — every observed F-04 subpath imports', () => {
  it.each(SURFACE)('$subpath exposes $symbols', async ({ subpath, symbols }) => {
    const module = (await import(subpath)) as Record<string, unknown>;
    for (const symbol of symbols) {
      expect(module[symbol], `${subpath} must export ${symbol}`).toBeDefined();
    }
  });

  it('resolves the type-only subpath core/model at runtime too', async () => {
    // `core/model` carries no runtime export, so the symbol check above cannot cover it.
    // Resolution is still the claim: the map must carry the path, not just the types.
    // The `DdDoc` / `DdIssue` / `SchemaIssue` imports at the top of this file are the
    // matching type-level assertion, enforced by `npm run typecheck`.
    await expect(import('@ai-substrate/dd/core/model')).resolves.toBeDefined();

    const doc: DdDoc | undefined = undefined;
    const issue: DdIssue | undefined = undefined;
    const schemaIssue: SchemaIssue | undefined = undefined;
    expect([doc, issue, schemaIssue]).toEqual([undefined, undefined, undefined]);
  });

  it('carries each exact observed specifier as a key in the exports map', () => {
    const expected = [
      './core/address',
      './core/model',
      './core/parse',
      './core/validate',
      './core/walk',
      './links',
      './render/renderer',
      './schema/index',
      './schema/model',
      './schema/resolve',
    ];
    expect(Object.keys(pkg.exports)).toEqual(expect.arrayContaining(expected));
  });

  it('points every mapped subpath at a file the tarball actually ships', () => {
    // `files` is [bin, dist, LICENSE], so a target under dist/ that exists here is a
    // target the tarball carries. This is the fast, every-save sibling of the phase-3
    // pack gate: a map entry pointing at a file tsc never emitted is a broken import
    // for the consumer and a green suite for us.
    const targets = Object.entries(pkg.exports)
      .filter(([subpath]) => subpath !== './package.json')
      .flatMap(([, target]) => Object.values(target as Record<string, string>));

    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(target.startsWith('./dist/'), `${target} must live under dist/`).toBe(true);
      expect(existsSync(join(REPO_ROOT, target)), `${target} must exist`).toBe(true);
    }
  });
});

describe('consumer surface — ./plan is withheld pending OQ-2', () => {
  it('is absent from the public exports map', () => {
    // OQ-2 (plan 001): does src/plan ship publicly, stay internal, or return
    // harness-side? Unruled. Absent is the honest state — an accidental wildcard
    // would have answered a question nobody has answered, and phase 3 freezes
    // whatever Jordan decides. Deleting this test to "add ./plan" is the tell.
    const keys = Object.keys(pkg.exports);
    expect(keys).not.toContain('./plan');
    expect(keys.filter((key) => key.startsWith('./plan'))).toEqual([]);
    expect(keys, 'a wildcard would export ./plan by accident').not.toContain('./*');
  });

  it('is still importable INTERNALLY, so withholding it costs nothing', async () => {
    const barrel = await import('../src/plan/index.js');
    for (const symbol of ['buildPlanIndex', 'itemKey', 'readPlanSemantics']) {
      expect(
        barrel[symbol as keyof typeof barrel],
        `plan barrel must export ${symbol}`,
      ).toBeDefined();
    }
  });
});
