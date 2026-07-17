import {
  branchesMergedInto,
  deleteBranch,
  isSquashMergedInto,
  listWorktrees,
  trashWorktree,
  trunkBranch,
  type Worktree,
  worktreeName,
  worktreeStatus,
} from '../git'
import {printError, printInfo, printSuccess, printWarning} from '../helpers'

// Remove every linked worktree whose branch is already merged into the trunk
// (main/master) — including squash merges — deleting the merged branch too.
// Dirty worktrees are skipped unless --force.
export async function prune(opts: {force?: boolean}) {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    printError('not a git repository')
    process.exit(1)
  }
  const root = worktrees[0].path

  const trunk = await trunkBranch()
  if (!trunk) {
    printError('no main or master branch to check merges against')
    process.exit(1)
  }

  const merged = new Set(await branchesMergedInto(trunk))
  merged.delete(trunk)

  const candidates: Worktree[] = []
  for (const w of worktrees) {
    if (w.isMain || w.branch == null || w.branch === trunk) continue
    if (merged.has(w.branch) || (await isSquashMergedInto(w.branch, trunk))) {
      candidates.push(w)
    }
  }
  if (candidates.length === 0) {
    printInfo(`no worktrees with branches merged into ${trunk}`)
    return
  }

  // Step out of any worktree we're about to delete before touching it.
  process.chdir(root)

  let removed = 0
  let currentRemoved = false
  for (const w of candidates) {
    // Dirty guard is checked before trashing, while the dir still exists.
    if (!opts.force && (await worktreeStatus(w.path))) {
      printWarning(
        `skipped ${worktreeName(w)} — uncommitted changes (use --force)`,
      )
      continue
    }
    if (!(await trashWorktree(root, w.path))) {
      printError(`could not remove ${worktreeName(w)}`)
      continue
    }
    printSuccess(`removed ${worktreeName(w)} (deleting in background)`)
    // Merged into trunk ⇒ deleting the branch loses nothing.
    if (w.branch) {
      const res = await deleteBranch(w.branch)
      if (res.code === 0) printSuccess(`deleted branch ${w.branch}`)
      else printError(res.stderr || `could not delete branch ${w.branch}`)
    }
    removed++
    if (w.isCurrent) currentRemoved = true
  }

  printInfo(`pruned ${removed} worktree${removed === 1 ? '' : 's'}`)

  // If we deleted the worktree we were standing in, cd the wrapper back to root.
  if (currentRemoved) process.stdout.write(`${root}\n`)
}
