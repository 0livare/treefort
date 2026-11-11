import {promptBranchDelete} from '../branch-delete'
import {
  type LikelyMerge,
  likelyMergedCommit,
  listWorktrees,
  mergedInto,
  trashWorktree,
  trunkBranch,
  type Worktree,
  worktreeName,
  worktreeStatus,
} from '../git'
import {printError, printInfo, printSuccess, printWarning} from '../helpers'
import {confirm, isInteractive} from '../select'

// Remove every linked worktree whose branch is already merged into the trunk
// (main/master, local or remote-tracking) — true merges, squash merges, and
// merges that would change nothing — asking before deleting each merged
// branch (auto-deleted when there's no terminal to ask). Branches that only
// *look* merged (a trunk commit with a ≥ 90% similar diff, or one naming the
// branch's ticket) are offered one by one, and never removed without a
// terminal. Dirty worktrees are skipped unless --force.
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

  const merged: {w: Worktree; into: string}[] = []
  const likely: {w: Worktree; match: LikelyMerge}[] = []
  for (const w of worktrees) {
    if (w.isMain || w.branch == null || w.branch === trunk) continue
    const into = await mergedInto(w.branch, trunk)
    if (into) {
      merged.push({w, into})
      continue
    }
    const match = await likelyMergedCommit(w.branch, trunk)
    if (match) likely.push({w, match})
  }
  if (merged.length === 0 && likely.length === 0) {
    printInfo(`no worktrees with branches merged into ${trunk}`)
    return
  }

  // Step out of any worktree we're about to delete before touching it.
  process.chdir(root)

  let removed = 0
  let currentRemoved = false

  // Dirty guard is checked before trashing, while the dir still exists.
  const isBlocked = async (w: Worktree) => {
    if (opts.force || !(await worktreeStatus(w.path))) return false
    printWarning(
      `skipped ${worktreeName(w)} — uncommitted changes (use --force)`,
    )
    return true
  }

  const remove = async (w: Worktree) => {
    if (!(await trashWorktree(root, w.path))) {
      printError(`could not remove ${worktreeName(w)}`)
      return false
    }
    printSuccess(`removed ${worktreeName(w)} (deleting in background)`)
    removed++
    if (w.isCurrent) currentRemoved = true
    return true
  }

  for (const {w, into} of merged) {
    if (await isBlocked(w)) continue
    if (!(await remove(w))) continue
    // Merged into trunk ⇒ deleting the branch loses nothing; the prompt's
    // default reflects that.
    if (w.branch) {
      await promptBranchDelete(w.branch, {
        safe: true,
        safeReason: `merged into ${into}`,
      })
    }
  }

  for (const {w, match} of likely) {
    const name = worktreeName(w)
    const why = `${name} looks merged: ${describeMatch(match)}`
    if (!isInteractive()) {
      printInfo(`kept ${why} — run in a terminal to confirm removal`)
      continue
    }
    if (await isBlocked(w)) continue
    printInfo(why)
    if (!(await confirm(`remove ${name}?`))) {
      printInfo(`kept ${name}`)
      continue
    }
    // Not proven merged, so let the branch prompt run its own safety check.
    if ((await remove(w)) && w.branch) await promptBranchDelete(w.branch)
  }

  printInfo(`pruned ${removed} worktree${removed === 1 ? '' : 's'}`)

  // If we deleted the worktree we were standing in, cd the wrapper back to root.
  if (currentRemoved) process.stdout.write(`${root}\n`)
}

// e.g. `a1b2c3d "ABC-123: add thing (#45)" on main (94% same diff, mentions
// ABC-123)`.
function describeMatch(m: LikelyMerge): string {
  const evidence: string[] = []
  if (m.similar) evidence.push(`${Math.floor(m.similarity * 100)}% same diff`)
  if (m.ticket) evidence.push(`mentions ${m.ticket}`)
  return `${m.hash.slice(0, 7)} "${m.subject}" on ${m.ref} (${evidence.join(', ')})`
}
