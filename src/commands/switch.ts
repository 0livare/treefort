import chalk from '../chalk'
import {listWorktrees, type Worktree, worktreeName} from '../git'
import {select} from '../select'

const branchLabel = (w: Worktree) =>
  w.branch ?? `detached @ ${w.head.slice(0, 7)}`

export async function switchWorktree() {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) process.exit(0) // not a git repo; nothing to do

  const currentIndex = worktrees.findIndex((w) => w.isCurrent)
  const width = Math.max(
    ...worktrees.map((w) => worktreeName(w).length),
    'NAME'.length,
  )

  const chosen = await select<Worktree>({
    items: worktrees,
    initialIndex: currentIndex >= 0 ? currentIndex : 0,
    header: [
      chalk.bold('  Switch to worktree'),
      '',
      chalk.dim(`     ${'NAME'.padEnd(width)}   BRANCH`),
    ],
    // Plain, column-aligned text; select() applies the row highlight/dim.
    label: (w) => `${worktreeName(w).padEnd(width)}   ${branchLabel(w)}`,
    emptyMessage: 'No worktrees found',
  })

  if (!chosen) process.exit(0)
  process.stdout.write(`${chosen.path}\n`)
}
