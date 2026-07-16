import {basename} from 'node:path'
import chalk from '../chalk'
import {listWorktrees, type Worktree} from '../git'
import {select} from '../select'

export async function switchWorktree() {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) process.exit(0) // not a git repo; nothing to do

  const currentIndex = worktrees.findIndex((w) => w.isCurrent)

  const chosen = await select<Worktree>({
    items: worktrees,
    initialIndex: currentIndex >= 0 ? currentIndex : 0,
    header: [chalk.bold('  Switch to worktree'), ''],
    label: (w) => {
      const name = w.isMain ? `${basename(w.path)} (main)` : basename(w.path)
      const branch = w.branch ?? `detached @ ${w.head.slice(0, 7)}`
      return `${name}   ${chalk.dim(branch)}`
    },
    emptyMessage: 'No worktrees found',
  })

  if (!chosen) process.exit(0)
  process.stdout.write(`${chosen.path}\n`)
}
