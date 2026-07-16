import {existsSync} from 'node:fs'
import {listWorktrees, worktreeName} from '../git'
import {printError} from '../helpers'

// Print the path to cd into (the shell wrapper does the actual cd).
// `-` = previous location; `root`/`@` = main worktree; else match name/branch.
// (The no-argument case is handled by the dispatcher as the interactive picker.)
export async function cd(target: string) {
  // `-`: jump to the previous location, toggling like `cd -`. The shell wrapper
  // records it in WT_PREV_WORKTREE before each cd, so this is per-shell state.
  if (target === '-') {
    const prev = process.env.WT_PREV_WORKTREE
    if (!prev || !existsSync(prev)) {
      printError('no previous worktree')
      process.exit(1)
    }
    process.stdout.write(`${prev}\n`)
    return
  }

  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    printError('not a git repository')
    process.exit(1)
  }

  if (target === 'root' || target === '@') {
    process.stdout.write(`${worktrees[0].path}\n`)
    return
  }

  const match = worktrees.find(
    (w) => worktreeName(w) === target || w.branch === target,
  )
  if (!match) {
    printError(`no worktree named "${target}"`)
    process.exit(1)
  }
  process.stdout.write(`${match.path}\n`)
}
