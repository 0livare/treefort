import chalk from './chalk'
import {type Worktree, worktreeName} from './git'
import {select} from './select'

const branchLabel = (w: Worktree) =>
  w.branch ?? (w.isBare ? '(bare)' : `detached @ ${w.head.slice(0, 7)}`)

// Shared interactive worktree picker: NAME/BRANCH column headers, aligned
// columns, "root" for the main worktree. Used by every worktree prompt so they
// all look the same. Returns the chosen worktree, or null on cancel/empty.
export function pickWorktree(
  worktrees: Worktree[],
  opts: {title: string; initialIndex?: number; emptyMessage?: string},
): Promise<Worktree | null> {
  const width = Math.max(
    ...worktrees.map((w) => worktreeName(w).length),
    'NAME'.length,
  )

  return select<Worktree>({
    items: worktrees,
    initialIndex: opts.initialIndex,
    header: [
      chalk.bold(`  ${opts.title}`),
      '',
      chalk.dim(`     ${'NAME'.padEnd(width)}   BRANCH`),
    ],
    // Plain, column-aligned text; select() applies the row highlight/dim.
    label: (w) => `${worktreeName(w).padEnd(width)}   ${branchLabel(w)}`,
    emptyMessage: opts.emptyMessage ?? 'No worktrees found',
  })
}
