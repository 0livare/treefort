import {listWorktrees} from '../git'
import {printError} from '../helpers'
import {resolveWorktree} from './cd'

// Run a command inside a worktree without switching to it. With no target the
// command runs in the main (root) worktree; otherwise the target is resolved
// the same way `wt cd` resolves it (`@`/`root` = main, `-` = previous, else
// exact-then-fuzzy name/branch match).
export async function exec(target: string | undefined, command: string[]) {
  if (command.length === 0) {
    printError('provide a command: wt exec [target --] <command>')
    process.exit(1)
  }

  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    printError('not a git repository')
    process.exit(1)
  }

  const root = worktrees[0].path
  const cwd = target ? await resolveWorktree({target, worktrees, root}) : root

  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn(command, {
      cwd,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    })
  } catch {
    printError(`command not found: ${command[0]}`)
    process.exit(127)
  }
  process.exit(await proc.exited)
}
