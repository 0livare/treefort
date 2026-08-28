import {detach, listWorktrees, worktreeName} from '../git'
import {printError, printSuccess} from '../helpers'
import {resolveWorktree} from './cd'

// Detach a named worktree at the commit it currently has checked out, freeing
// its branch without moving the worktree or changing its files.
export async function detatch(target?: string) {
  if (!target) {
    printError('usage: wt detatch <name>')
    process.exit(1)
  }

  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    printError('not a git repository')
    process.exit(1)
  }

  const root = worktrees[0].path
  const dest = await resolveWorktree({target, worktrees, root})
  const worktree = worktrees.find((candidate) => candidate.path === dest)

  if (!worktree || worktree.isBare) {
    printError('cannot detach a bare worktree')
    process.exit(1)
  }

  if (worktree.branch === null) {
    printError(`${worktreeName(worktree)} is already detached`)
    process.exit(1)
  }

  const result = await detach(dest)
  if (result.code !== 0) {
    printError(result.stderr || 'git checkout --detach failed')
    process.exit(result.code || 1)
  }

  printSuccess(
    `detached ${worktreeName(worktree)} at ${worktree.head.slice(0, 7)}`,
  )
}
