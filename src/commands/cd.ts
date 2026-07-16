import {existsSync} from 'node:fs'
import {listWorktrees, worktreeName} from '../git'
import {printError} from '../helpers'
import {getPrevious, setPrevious} from '../prev'

// Print the path to cd into (the shell wrapper does the actual cd).
// `-` = previous worktree (toggles); `root`/`@` = main worktree; else match
// name/branch. (No argument is routed to the interactive picker upstream.)
export async function cd(target: string) {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    printError('not a git repository')
    process.exit(1)
  }

  const root = worktrees[0].path
  const current = worktrees.find((w) => w.isCurrent)?.path

  let dest: string
  if (target === '-') {
    const prev = await getPrevious(root)
    if (!prev || !existsSync(prev)) {
      printError('no previous worktree')
      process.exit(1)
    }
    dest = prev
  } else if (target === 'root' || target === '@') {
    dest = root
  } else {
    const match = worktrees.find(
      (w) => worktreeName(w) === target || w.branch === target,
    )
    if (!match) {
      printError(`no worktree named "${target}"`)
      process.exit(1)
    }
    dest = match.path
  }

  // Remember where we were so `wt cd -` can bring us back (and toggle).
  if (current && current !== dest) await setPrevious(root, current)
  process.stdout.write(`${dest}\n`)
}
