import {listWorktrees, pull} from '../git'
import {printError, printInfo, printSuccess} from '../helpers'
import {resolveWorktree} from './cd'

// Fast-forward a worktree's branch from its upstream (git pull --ff-only). With
// no target the root worktree is used; otherwise the target is resolved the same
// way `wt cd`/`wt exec` resolve it. Pure action: output goes to stderr and
// nothing is written to stdout, so the shell wrapper stays put.
export async function ff(target?: string) {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    printError('not a git repository')
    process.exit(1)
  }

  const root = worktrees[0].path
  const dest = target ? await resolveWorktree({target, worktrees, root}) : root
  const wt = worktrees.find((w) => w.path === dest)

  // Detached HEAD has no branch to fast-forward — bail with a clean message
  // rather than letting git emit its lower-level error.
  if (wt && wt.branch === null) {
    printError('cannot fast-forward a detached HEAD')
    process.exit(1)
  }

  const res = await pull(dest)
  if (res.code !== 0) {
    printError(res.stderr || 'git pull --ff-only failed')
    process.exit(res.code || 1)
  }

  printSuccess(`fast-forwarded ${wt?.branch ?? dest}`)
  if (res.stdout) printInfo(res.stdout) // e.g. "Already up to date." / summary
}
