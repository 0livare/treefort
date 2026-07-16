import {listWorktrees} from '../git'
import {setPrevious} from '../prev'
import {pickWorktree} from '../worktree-picker'

export async function switchWorktree() {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) process.exit(0) // not a git repo; nothing to do

  const currentIndex = worktrees.findIndex((w) => w.isCurrent)

  const chosen = await pickWorktree(worktrees, {
    title: 'Switch to worktree',
    initialIndex: currentIndex >= 0 ? currentIndex : 0,
  })

  if (!chosen) process.exit(0)

  const current = worktrees[currentIndex]?.path
  if (current && current !== chosen.path) {
    await setPrevious(worktrees[0].path, current)
  }
  process.stdout.write(`${chosen.path}\n`)
}
