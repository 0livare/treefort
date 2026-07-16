import {rank, recordAccess} from '../frecency'
import {listWorktrees} from '../git'
import {setPrevious} from '../prev'
import {pickWorktree} from '../worktree-picker'

export async function switchWorktree() {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) process.exit(0) // not a git repo; nothing to do

  const root = worktrees[0].path
  const current = worktrees.find((w) => w.isCurrent)?.path

  // Order by frecency (most-used first) and start the cursor on the top entry
  // that isn't the one we're already in.
  const ordered = await rank(root, worktrees)
  const firstOther = ordered.findIndex((w) => !w.isCurrent)

  const chosen = await pickWorktree(ordered, {
    title: 'Switch to worktree',
    initialIndex: firstOther >= 0 ? firstOther : 0,
  })

  if (!chosen) process.exit(0)

  if (current && current !== chosen.path) await setPrevious(root, current)
  await recordAccess(root, chosen.path)
  process.stdout.write(`${chosen.path}\n`)
}
