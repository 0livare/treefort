import {existsSync} from 'node:fs'
import {rank, recordAccess} from '../frecency'
import {listWorktrees, type Worktree, worktreeName} from '../git'
import {printError} from '../helpers'
import {matchesQuery} from '../match'
import {getPrevious, setPrevious} from '../prev'
import {pickWorktree} from '../worktree-picker'

// The one worktree-navigation path. With a target, resolve it (`-` = previous,
// `root`/`@` = main, else exact-then-fuzzy name/branch match); with no target,
// open the interactive picker. Bare `wt` and `wt <name>` both funnel through
// here — cd is wt's default command. Prints the chosen path to stdout for the
// shell wrapper to cd into.
export async function cd(target?: string) {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    if (target === undefined) process.exit(0) // not a git repo; nothing to pick
    printError('not a git repository')
    process.exit(1)
  }

  const root = worktrees[0].path
  const current = worktrees.find((w) => w.isCurrent)?.path

  const dest =
    target === undefined
      ? await pick(worktrees, root)
      : await resolveWorktree(target, worktrees, root)
  if (dest === null) return // picker cancelled — stay put

  // Remember where we were so `wt cd -` can toggle back, and bump frecency.
  if (current && current !== dest) await setPrevious(root, current)
  await recordAccess(root, dest)
  process.stdout.write(`${dest}\n`)
}

// Interactive picker, ordered by frecency with the cursor on the top entry that
// isn't the current worktree. Returns the chosen path, or null if cancelled.
async function pick(
  worktrees: Worktree[],
  root: string,
): Promise<string | null> {
  const ordered = await rank(root, worktrees)
  const firstOther = ordered.findIndex((w) => !w.isCurrent)
  const chosen = await pickWorktree(ordered, {
    title: 'Switch to worktree',
    initialIndex: firstOther >= 0 ? firstOther : 0,
  })
  return chosen?.path ?? null
}

// Resolve a target string to a worktree path, exiting with an error if none
// match. Shared with `wt exec` so both resolve targets identically.
export async function resolveWorktree(
  target: string,
  worktrees: Worktree[],
  root: string,
): Promise<string> {
  if (target === '-') {
    const prev = await getPrevious(root)
    if (!prev || !existsSync(prev)) {
      printError('no previous worktree')
      process.exit(1)
    }
    return prev
  }
  if (target === 'root' || target === '@') return root

  // Exact name/branch match wins; otherwise fall back to fuzzy matching and,
  // when several match, pick the highest-frecency one.
  const exact = worktrees.find(
    (w) => worktreeName(w) === target || w.branch === target,
  )
  if (exact) return exact.path

  const matches = worktrees.filter(
    (w) =>
      matchesQuery(target, worktreeName(w)) ||
      (w.branch != null && matchesQuery(target, w.branch)),
  )
  if (matches.length === 0) {
    printError(`no worktree named "${target}"`)
    process.exit(1)
  }
  return matches.length === 1
    ? matches[0].path
    : (await rank(root, matches))[0].path
}
