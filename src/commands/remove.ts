import {basename} from 'node:path'
import {
  branchIsSafeToDelete,
  deleteBranch,
  listWorktrees,
  trashWorktree,
  type Worktree,
  worktreeStatus,
} from '../git'
import {printError, printInfo, printSuccess, printWarning} from '../helpers'
import {pickWorktree} from '../worktree-picker'

export async function remove(
  name: string | undefined,
  opts: {force?: boolean; keepBranch?: boolean; forceBranch?: boolean},
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
    // Default the cursor to the worktree you're in, so Enter removes it.
    const currentIndex = removable.findIndex((w) => w.isCurrent)
    const chosen = await pickWorktree(removable, {
      title: 'Remove worktree',
      initialIndex: currentIndex >= 0 ? currentIndex : undefined,
      emptyMessage: 'no worktrees to remove',
    })
    if (!chosen) process.exit(0)
    target = chosen
  }

  // Dirty guard (checked against the worktree's own path, still present here).
  if (!opts.force) {
    const status = await worktreeStatus(target.path)
    if (status) {
      printError(
        `${basename(target.path)} has uncommitted changes — use --force to remove anyway`,
      )
      for (const line of status.split('\n')) printInfo(line)
      process.exit(1)
    }
  }

  const isCurrent = target.isCurrent
  const branch = target.branch

  // Branch deletion. By default we delete it, but only when that's safe — i.e.
  // its commits live on in another branch (local or remote), so nothing is
  // lost. --keep-branch never deletes; --force-branch deletes unconditionally.
  const branchDeleteMode: 'none' | 'safe' | 'force' = opts.keepBranch
    ? 'none'
    : opts.forceBranch
      ? 'force'
      : 'safe'

  // Run remaining git commands from the main root: if we're removing the
  // worktree we're standing in, our cwd is about to disappear.
  process.chdir(root)

  if (!(await trashWorktree(root, target.path))) {
    printError(`could not remove ${basename(target.path)}`)
    process.exit(1)
  }

  printSuccess(`removed ${basename(target.path)} (deleting in background)`)

  // Delete the branch unless asked to keep it. In 'safe' mode we only delete
  // when the commits survive elsewhere; --force-branch deletes regardless.
  if (branchDeleteMode !== 'none') {
    if (!branch) {
      // Only worth mentioning when deletion was asked for explicitly.
      if (opts.forceBranch)
        printWarning('worktree was detached — no branch to delete')
    } else if (
      branchDeleteMode === 'force' ||
      (await branchIsSafeToDelete(branch))
    ) {
      const res = await deleteBranch(branch)
      if (res.code === 0) printSuccess(`deleted branch ${branch}`)
      else printError(res.stderr || `could not delete branch ${branch}`)
    } else {
      printWarning(
        `kept branch ${branch} — its commits aren't in any other branch (use --force-branch to delete anyway)`,
      )
    }
  }

  // If we removed the worktree we were in, cd the wrapper back to the root.
  if (isCurrent) process.stdout.write(`${root}\n`)
}
