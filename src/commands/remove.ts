import {basename, join} from 'path'
import {rename, mkdir} from 'node:fs/promises'
import chalk from '../chalk'
import {printError, printSuccess, printWarning} from '../helpers'
import {
  listWorktrees,
  isDirty,
  pruneWorktrees,
  branchIsPushed,
  deleteBranch,
  spawnDetachedRm,
  type Worktree,
} from '../git'
import {select} from '../select'

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
  } catch (e: any) {
    printError(`could not remove worktree: ${e.message}`)
    process.exit(1)
  }
  await pruneWorktrees()
  spawnDetachedRm(trashed)

  printSuccess(`removed ${basename(target.path)} (deleting in background)`)

  // Optionally delete the branch, but only when it's safely pushed.
  if (opts.deleteBranch && branch) {
    if (await branchIsPushed(branch)) {
      const res = await deleteBranch(branch)
      if (res.code === 0) printSuccess(`deleted branch ${branch}`)
      else printError(res.stderr || `could not delete branch ${branch}`)
    } else {
      printWarning(
        `kept branch ${branch} — no remote ref points at its latest commit`,
      )
    }
  } else if (opts.deleteBranch && !branch) {
    printWarning('worktree was detached — no branch to delete')
  }

  // If we removed the worktree we were in, cd the wrapper back to the root.
  if (isCurrent) process.stdout.write(root + '\n')
}
