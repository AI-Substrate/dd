import type { Clock } from '../adapters/clock/clock-port.js';
import { SystemClock } from '../adapters/clock/system-clock.js';
import { NodeEnv } from '../adapters/env/node-env.js';
import { NodeExec } from '../adapters/exec/node-exec.js';
import { NodeHash } from '../adapters/hash/node-hash.js';
import { NodeProcess } from '../adapters/process/node-process.js';
import type { DocLoader } from '../core/walk.js';
import { FsDocLoader, MemoizingDocLoader } from '../links/index.js';
import type { DdLinkIssue } from '../links/model.js';
import type { ActDeps } from '../node/deps.js';
import { DD_ISSUE_CODES, type DdActDeps, NodeSchemaFs, trackedPaths } from '../node/index.js';
import { ErrorCodes } from '../output/error-codes.js';
import { type CliIo, createOutputPort, type OutputPort } from '../output/output-port.js';
import { ConventionSchemaResolver } from '../schema/resolve.js';
import { toPosix } from '../shared/posix-path.js';

export { FsDocLoader } from '../links/index.js';
/**
 * The act-facing deps container, and the fs/git symbols that go with it, now live
 * in `src/node/` — the Node-bound tier a consumer can actually import
 * (`@ai-substrate/dd/node`). They are re-exported here so every act keeps its
 * existing import unchanged, and so the dependency direction stays one-way:
 * acts read from the library, never the reverse.
 */
export type { ActDeps } from '../node/deps.js';
export type { DdActDeps } from '../node/index.js';
export { DD_ISSUE_CODES, NodeSchemaFs, trackedPaths } from '../node/index.js';

export function codedLinkIssues(issues: readonly DdLinkIssue[]) {
  return issues.map((issue) => ({ ...issue, code: DD_ISSUE_CODES[issue.class] }));
}

export function nextActionFor(issues: readonly DdLinkIssue[], address: string): string {
  const reason = issues[0]?.reason;
  if (reason === 'no-base-document') {
    return 'Address the file explicitly — `<path>#<interior>`. A bare-"#" address only means something inside its own document.';
  }
  if (reason === 'malformed') {
    return 'Generate the address instead of writing it: `dd address generate "<interior>" --path <file>`.';
  }
  return `Check the target with \`dd links <target>\`, then fix ${address}.`;
}

export interface DdLinkContext {
  clock: Clock;
  port: OutputPort;
  repoRoot: string;
  fs: NodeSchemaFs;
  resolver: ConventionSchemaResolver;
  loader: DocLoader;
}

/**
 * Compose the adapters every link-consuming dd verb needs, once.
 *
 * `dd address`, `dd link`, `dd links`, `dd graph` and `dd doctor` all resolve
 * schemas the same way and load documents the same way, and a second copy of that
 * wiring is a second place for the two to drift apart.
 *
 * It lives HERE, and the placement is load-bearing rather than tidy. Phase 4 put
 * it in `acts/dd/link.ts` for one stated reason — "that file belongs to Phase 1
 * and the parallel phases must not touch each other's files" — and the fan-in
 * retired that constraint. Keeping it there would now cost a real boundary:
 * `dd link verify-basis --update` regenerates a sibling, so `link.ts` reaches the
 * render layer, and `graph.ts`/`links.ts` take their context from it — which would
 * drag both across the `dd-graph-never-imports-render` line that Phases 3 and 4
 * were deliberately split along. One module move keeps that boundary honest.
 *
 * `tracked` comes from one `git ls-files` snapshot, so an untracked target is
 * reported honestly instead of every readable file being called tracked.
 */
export async function createLinkContext(
  io: CliIo,
  deps: DdActDeps,
  options: { tracked?: boolean } = {},
): Promise<DdLinkContext> {
  const clock = deps.clock ?? new SystemClock();
  const port = createOutputPort(io.mode, io.writers);
  const fs = new NodeSchemaFs();
  const repoRoot = toPosix(new NodeProcess().cwd());
  const home = new NodeEnv().home();
  const resolver = new ConventionSchemaResolver({
    fs,
    repoRoot,
    ...(home !== undefined && { home: toPosix(home) }),
  });
  const tracked = options.tracked === false ? null : await trackedPaths(new NodeExec(), repoRoot);
  const loader = new MemoizingDocLoader(new FsDocLoader(fs, new NodeHash(), tracked));
  return { clock, port, repoRoot, fs, resolver, loader };
}
