import {listWorktrees, worktreeName} from '../git'
import {printError} from '../helpers'

// Print the path to cd into (the shell wrapper does the actual cd).
// No arg (or `root`/`@`) → the main worktree; otherwise match by name or branch.
export async function cd(target: string | undefined) {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    printError('not a git repository')
    process.exit(1)
  }

  if (!target || target === 'root' || target === '@') {
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
