import {deleteBranchAndReport, promptBranchDelete} from '../branch-delete'
import chalk from '../chalk'
import {rank} from '../frecency'
import {
  branchExists,
  isDirty,
  listWorktrees,
  trashWorktree,
  type Worktree,
  worktreeName,
  worktreeStatus,
} from '../git'
import {
  printError,
  printInfo,
  printSuccess,
  printWarning,
  say,
} from '../helpers'
import {matchesQuery} from '../match'
import {confirm, isInteractive} from '../select'
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
  const matchingWorktree =
    name != null &&
    worktrees.some((w) => worktreeName(w) === name || w.branch === name)

  if (name && !matchingWorktree && (await branchExists(name))) {
    printWarning(`no worktree matching "${name}"`)

    if (opts.keepBranch) {
      printInfo(`kept branch ${name}`)
      return
    }
    if (opts.forceBranch) {
      await deleteBranchAndReport(name)
      return
    }
    if (!isInteractive()) {
      printError(
        `deleting branch ${name} requires a terminal — use --force-branch to delete without prompting`,
      )
      process.exit(1)
    }

    await promptBranchDelete(name, {defaultYes: true})
    return
  }

  if (removable.length === 0) {
    printWarning('no worktrees to remove')
    process.exit(0)
  }

  let target: Worktree
  if (name) {
    target = await resolveRemovable(name, removable, root)
  } else {
    // Flag worktrees with uncommitted changes so the picker can mark them.
    const dirty = new Set<string>()
    await Promise.all(
      removable.map(async (w) => {
        if (await isDirty(w.path)) dirty.add(w.path)
      }),
    )
    // Default the cursor to the worktree you're in, so Enter removes it.
    const currentIndex = removable.findIndex((w) => w.isCurrent)
    const chosen = await pickWorktree(removable, {
      title: 'Remove worktree',
      initialIndex: currentIndex >= 0 ? currentIndex : undefined,
      emptyMessage: 'no worktrees to remove',
      dirty,
    })
    if (!chosen) process.exit(0)
    target = chosen
  }

  // Dirty guard (checked against the worktree's own path, still present here).
  // On a terminal we show the changes and ask to remove anyway, rather than
  // making the user re-run with --force. Without one (scripts, or the wrapper
  // capturing stdout) there's nobody to ask, so we error and point at --force.
  if (!opts.force) {
    const status = await worktreeStatus(target.path)
    if (status) {
      if (!isInteractive()) {
        printError(
          `${worktreeName(target)} has uncommitted changes — use --force to remove anyway`,
        )
        showChanges(status)
        process.exit(1)
      }

      say(
        chalk.redBright.bold(
          `  ${worktreeName(target)} has uncommitted changes that will be permanently lost:`,
        ),
      )
      showChanges(status, 4)
      const question = chalk.red(`permanently remove ${worktreeName(target)}?`)
      if (!(await confirm(question))) process.exit(0)
    }
  }

  const isCurrent = target.isCurrent
  const branch = target.branch

  // Branch deletion. By default we ask, with the safety check — do the
  // branch's commits live on in another branch (local or remote)? — reported
  // and picking the prompt's default. --keep-branch never deletes;
  // --force-branch deletes unconditionally, no questions asked.
  const branchDeleteMode: 'none' | 'prompt' | 'force' = opts.keepBranch
    ? 'none'
    : opts.forceBranch
      ? 'force'
      : 'prompt'

  // Run remaining git commands from the main root: if we're removing the
  // worktree we're standing in, our cwd is about to disappear.
  process.chdir(root)

  if (!(await trashWorktree(root, target.path))) {
    printError(`could not remove ${worktreeName(target)}`)
    process.exit(1)
  }

  printSuccess(`removed ${worktreeName(target)} (deleting in background)`)

  // Delete the branch unless asked to keep it. --force-branch deletes without
  // asking; otherwise prompt, defaulting to yes only when deletion is safe.
  if (branchDeleteMode !== 'none') {
    if (!branch) {
      // Only worth mentioning when deletion was asked for explicitly.
      if (opts.forceBranch)
        printWarning('worktree was detached — no branch to delete')
    } else if (branchDeleteMode === 'force') {
      await deleteBranchAndReport(branch)
    } else {
      await promptBranchDelete(branch)
    }
  }

  // If we removed the worktree we were in, cd the wrapper back to the root.
  if (isCurrent) process.stdout.write(`${root}\n`)
}

// Print `git status --short` output, one blue line per pending change.
function showChanges(status: string, padding = 2) {
  for (const line of status.split('\n'))
    say(chalk.cyan(`${' '.repeat(padding)}${line}`))
  say()
}

// Resolve a target the same way cd does — exact name/branch first, then fuzzy
// ranked by frecency — but because rm is destructive, a fuzzy hit needs a y/N
// confirmation (and without a terminal, an exact name is required).
async function resolveRemovable(
  name: string,
  removable: Worktree[],
  root: string,
): Promise<Worktree> {
  const exact = removable.find(
    (w) => worktreeName(w) === name || w.branch === name,
  )
  if (exact) return exact

  const matches = removable.filter(
    (w) =>
      matchesQuery(name, worktreeName(w)) ||
      (w.branch != null && matchesQuery(name, w.branch)),
  )
  if (matches.length === 0) {
    printError(`no worktree matching "${name}"`)
    process.exit(1)
  }
  const best =
    matches.length === 1 ? matches[0] : (await rank(root, matches))[0]

  if (!isInteractive()) {
    printError(
      `no worktree named "${name}" — closest match is ${worktreeName(best)}; pass the exact name`,
    )
    process.exit(1)
  }
  if (!(await confirm(`remove ${worktreeName(best)}?`))) process.exit(0)
  return best
}
