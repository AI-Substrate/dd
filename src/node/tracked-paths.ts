import type { ExecPort } from '../adapters/exec/exec-port.js';
import { posixJoin } from '../shared/posix-path.js';

/**
 * The set of paths git currently tracks, as absolute POSIX-logical paths.
 *
 * ONE `git ls-files` snapshot, taken before a walk rather than per file. Returns
 * null when there is no answer to be had — not a repository, or git failed — and
 * null means "this host has no tracking concept", never "everything happens to be
 * tracked". A caller that reads null as "untracked" silently suppresses the
 * untracked-target WARN, which is the failure this return shape exists to
 * prevent; an empty set, by contrast, is a real repository that tracks nothing.
 */
export async function trackedPaths(
  exec: ExecPort,
  repoRoot: string,
): Promise<ReadonlySet<string> | null> {
  try {
    const result = await exec.run('git', ['ls-files', '-z'], { cwd: repoRoot, timeoutMs: 20_000 });
    if (!result.ok) return null;
    return new Set(
      result.stdout
        .split('\0')
        .filter((entry) => entry.length > 0)
        .map((entry) => posixJoin(repoRoot, entry)),
    );
  } catch {
    return null;
  }
}
