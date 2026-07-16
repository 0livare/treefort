import {mkdir, rename} from 'node:fs/promises'
import {basename, join} from 'node:path'
import chalk from '../chalk'
import {
  branchIsPushed,
  deleteBranch,
  isDirty,
  listWorktrees,
  pruneWorktrees,
  spawnDetachedRm,
  type Worktree,
} from '../git'
import {printError, printSuccess, printWarning} from '../helpers'
import {confirm, select} from '../select'

export async function remove(
  name: string | undefined,
  opts: {force?: boolean; deleteBranch?: boolean},
) {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    printError('not a git repository')
    process.exit(1)
  }

  const root = worktrees[0].path
  const removable = worktrees.filter((w) => !w.isMain)
  if (removable.length === 0) {
    printWarning('no worktrees to remove')
    process.exit(0)
  }

  let target: Worktree
  let interactive = false
  if (name) {
    const found = removable.find(
      (w) => basename(w.path) === name || w.branch === name,
    )
    if (!found) {
      printError(`no worktree named "${name}"`)
      process.exit(1)
    }
    target = found
  } else {
    interactive = true
    const chosen = await select<Worktree>({
      items: removable,
      header: [chalk.bold('  Remove worktree'), ''],
      label: (w) =>
        `${basename(w.path)}   ${chalk.dim(w.branch ?? 'detached')}`,
      emptyMessage: 'no worktrees to remove',
    })
    if (!chosen) process.exit(0)
    target = chosen
  }

  // Dirty guard (checked against the worktree's own path, still present here).
  if (!opts.force && (await isDirty(target.path))) {
    printError(
      `${basename(target.path)} has uncommitted changes — use --force to remove anyway`,
    )
    process.exit(1)
  }

  const isCurrent = target.isCurrent
  const branch = target.branch

  // Decide branch deletion. The -d flag is "guarded" — only delete if the work
  // is safely pushed. An explicit interactive "yes" is a deliberate choice, so
  // it force-deletes regardless of remote state.
  let branchDeleteMode: 'none' | 'guarded' | 'force' = opts.deleteBranch
    ? 'guarded'
    : 'none'
  if (interactive && branch && branchDeleteMode === 'none') {
    if (await confirm(`Delete branch ${branch} too?`))
      branchDeleteMode = 'force'
  }

  // Run remaining git commands from the main root: if we're removing the
  // worktree we're standing in, our cwd is about to disappear.
  process.chdir(root)

  // Instantly move the dir into trash (same-fs rename), deregister it, then let
  // a detached rm -rf finish the slow filesystem delete after we exit.
  const trashDir = join(root, '.wkt', '.trash')
  await mkdir(trashDir, {recursive: true})
  const trashed = join(trashDir, `${basename(target.path)}-${Date.now()}`)
  try {
    await rename(target.path, trashed)
  } catch (e) {
    printError(
      `could not remove worktree: ${e instanceof Error ? e.message : String(e)}`,
    )
    process.exit(1)
  }
  await pruneWorktrees()
  spawnDetachedRm(trashed)

  printSuccess(`removed ${basename(target.path)} (deleting in background)`)

  // Delete the branch when requested. Guarded (-d) deletes only if pushed;
  // an explicit interactive "yes" (force) deletes unconditionally.
  if (branchDeleteMode !== 'none' && branch) {
    if (branchDeleteMode === 'force' || (await branchIsPushed(branch))) {
      const res = await deleteBranch(branch)
      if (res.code === 0) printSuccess(`deleted branch ${branch}`)
      else printError(res.stderr || `could not delete branch ${branch}`)
    } else {
      printWarning(
        `kept branch ${branch} — no remote ref points at its latest commit`,
      )
    }
  } else if (branchDeleteMode !== 'none' && !branch) {
    printWarning('worktree was detached — no branch to delete')
  }

  // If we removed the worktree we were in, cd the wrapper back to the root.
  if (isCurrent) process.stdout.write(`${root}\n`)
}
