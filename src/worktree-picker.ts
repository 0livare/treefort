import chalk from './chalk'
import {type Worktree, worktreeName} from './git'
import {select} from './select'

const branchLabel = (w: Worktree) =>
  w.branch ?? (w.isBare ? '(bare)' : `detached @ ${w.head.slice(0, 7)}`)

// Shared interactive worktree picker: NAME/BRANCH column headers, aligned
// columns, "root" for the main worktree. Used by every worktree prompt so they
// all look the same. Pass `dirty` (a set of worktree paths) to flag worktrees
// with uncommitted changes, or `managed` to flag the ones Claude Code can open.
// Returns the chosen worktree, or null on cancel/empty.
export function pickWorktree(
  worktrees: Worktree[],
  opts: {
    title: string
    initialIndex?: number
    emptyMessage?: string
    dirty?: Set<string>
    managed?: Set<string>
  },
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
    // Plain, column-aligned text; select() applies the row highlight/dim. The
    // dirty marker is safe to color since it's the last thing on the line.
    label: (w) => {
      let row = `${worktreeName(w).padEnd(width)}   ${branchLabel(w)}`
      if (opts.managed?.has(w.path)) row += ` ${chalk.blue('◆ claude')}`
      if (opts.dirty?.has(w.path)) row += ` ${chalk.red('✗')}`
      return row
    },
    emptyMessage: opts.emptyMessage ?? 'No worktrees found',
  })
}
