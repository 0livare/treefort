import {existsSync} from 'node:fs'
import {rank, recordAccess} from '../frecency'
import {listWorktrees, type Worktree, worktreeName} from '../git'
import {printError} from '../helpers'
import {matchesQuery} from '../match'
import {getPrevious, setPrevious} from '../prev'
import {confirm, isInteractive} from '../select'
import {pickWorktree} from '../worktree-picker'
import {add} from './add'

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
      : await resolveWorktree({
          target,
          worktrees,
          root,
          // No match: offer to create a worktree with that name. add() handles
          // its own stdout/bookkeeping, so return null to bow out here.
          onNoMatch: () => offerToCreate(target),
        })
  if (dest === null) return // picker cancelled, or create handled/declined

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

type ResolveOpts = {
  target: string
  worktrees: Worktree[]
  root: string
  // Called when nothing matches; its result becomes the resolved path. cd uses
  // it to offer creating one. Omit it to error and exit instead (what exec wants).
  onNoMatch?: () => Promise<string | null>
}

// Resolve a target string to a worktree path. Shared with `wt exec` so both
// resolve targets identically.
export function resolveWorktree(
  opts: Omit<ResolveOpts, 'onNoMatch'>,
): Promise<string>
export function resolveWorktree(
  opts: ResolveOpts & {onNoMatch: () => Promise<string | null>},
): Promise<string | null>
export async function resolveWorktree({
  target,
  worktrees,
  root,
  onNoMatch,
}: ResolveOpts): Promise<string | null> {
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
    if (onNoMatch) return onNoMatch()
    printError(`no worktree matching "${target}"`)
    process.exit(1)
  }
  return matches.length === 1
    ? matches[0].path
    : (await rank(root, matches))[0].path
}

// No worktree matched the target: ask whether to create one for it. On yes,
// hand off to add() (which creates the branch/worktree and prints the cd path);
// on no, we return null so cd stays put. Either way cd has nothing left to do.
async function offerToCreate(target: string): Promise<null> {
  // Without a terminal there's nobody to ask — fail like a plain no-match.
  if (!isInteractive()) {
    printError(`no worktree matching "${target}"`)
    process.exit(1)
  }
  if (await confirm(`no worktree matching "${target}" — create it?`, true)) {
    await add(target, undefined, {})
  }
  return null
}
