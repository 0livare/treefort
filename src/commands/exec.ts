import {basename} from 'node:path'
import {listWorktrees} from '../git'
import {printError} from '../helpers'

// Run a command inside another worktree without switching to it.
// `@` targets the main worktree; otherwise match by worktree name or branch.
export async function exec(target: string | undefined, command: string[]) {
  if (!target) {
    printError('usage: wt exec <name> -- <command>')
    process.exit(1)
  }
  if (command.length === 0) {
    printError('provide a command: wt exec <name> -- <command>')
    process.exit(1)
  }

  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    printError('not a git repository')
    process.exit(1)
  }

  const wt =
    target === '@'
      ? worktrees[0]
      : worktrees.find(
          (w) => basename(w.path) === target || w.branch === target,
        )
  if (!wt) {
    printError(`no worktree named "${target}"`)
    process.exit(1)
  }

  const proc = Bun.spawn(command, {
    cwd: wt.path,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
  process.exit(await proc.exited)
}
