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
import {
  currentWorktreeFirst,
  pickerState,
  pickWorktree,
  restorePickerState,
  type WorktreePickerSnapshot,
  type WorktreePickerState,
} from '../worktree-picker'

type PreparedRemovePicker = {
  worktrees: Worktree[]
  dirty: Set<string>
}

export type RemovePickerPreparation = Promise<
  {value: PreparedRemovePicker} | {error: unknown}
>

async function collectDirtyWorktrees(
  worktrees: Worktree[],
  checkDirty: (path: string) => Promise<boolean> = isDirty,
): Promise<Set<string>> {
  const results = await Promise.all(
    worktrees.map(async (worktree) => ({
      path: worktree.path,
      dirty: await checkDirty(worktree.path),
    })),
  )
  return new Set(
    results.filter((result) => result.dirty).map((result) => result.path),
  )
}

export function prepareRemovePicker(
  worktrees: Worktree[],
  checkDirty: (path: string) => Promise<boolean> = isDirty,
): RemovePickerPreparation {
  const removable = worktrees.filter((worktree) => !worktree.isMain)
  return collectDirtyWorktrees(removable, checkDirty).then(
    (dirty) => ({
      value: {
        worktrees,
        dirty,
      },
    }),
    (error: unknown) => ({error}),
  )
}

export async function remove(
  name: string | undefined,
  opts: {
    force?: boolean
    keepBranch?: boolean
    forceBranch?: boolean
    picker?: WorktreePickerState
    preparation?: RemovePickerPreparation
    back?: (
      picker: WorktreePickerSnapshot,
      preparation?: RemovePickerPreparation,
    ) => void | Promise<void>
  },
) {
  const preparedResult = opts.preparation ? await opts.preparation : undefined
  if (preparedResult && 'error' in preparedResult) throw preparedResult.error
  const prepared = preparedResult?.value
  const worktrees = prepared?.worktrees ?? (await listWorktrees())
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

    await promptBranchDelete(name)
    return
  }

  if (removable.length === 0) {
    printWarning('no worktrees to remove')
    process.exit(0)
  }

  let targets: Worktree[]
  if (name) {
    targets = [await resolveRemovable(name, removable, root)]
  } else {
    // Flag worktrees with uncommitted changes so the picker can mark them.
    const dirty = prepared?.dirty ?? (await collectDirtyWorktrees(removable))
    // Preserve the other picker's order and selection when switching modes.
    const ordered = opts.picker
      ? restorePickerState(removable, opts.picker)
      : {worktrees: currentWorktreeFirst(removable), initialIndex: 0}
    const chosen = await pickWorktree(ordered.worktrees, {
      title: 'Remove worktrees',
      initialIndex: ordered.initialIndex,
      emptyMessage: 'no worktrees to remove',
      dirty,
      multiple: true,
      shortcuts: opts.back
        ? [
            {
              keys: ['\x1b[D'],
              hint: '←',
              label: 'back',
              run: (selectedIndex) =>
                opts.back?.(
                  {
                    worktrees,
                    state: pickerState(ordered.worktrees, selectedIndex),
                  },
                  opts.preparation,
                ),
            },
          ]
        : undefined,
    })
    if (!chosen) process.exit(0)
    targets = chosen
  }

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

  let removedCurrent = false
  for (const target of targets) {
    if (!opts.force && !(await confirmDirtyRemoval(target))) continue

    if (!(await trashWorktree(root, target.path))) {
      printError(`could not remove ${worktreeName(target)}`)
      process.exit(1)
    }

    printSuccess(`removed ${worktreeName(target)} (deleting in background)`)
    removedCurrent ||= target.isCurrent

    // Delete the branch unless asked to keep it. --force-branch deletes without
    // asking; otherwise prompt, defaulting to yes only when deletion is safe.
    if (branchDeleteMode !== 'none') {
      if (!target.branch) {
        // Only worth mentioning when deletion was asked for explicitly.
        if (opts.forceBranch)
          printWarning('worktree was detached — no branch to delete')
      } else if (branchDeleteMode === 'force') {
        await deleteBranchAndReport(target.branch)
      } else {
        await promptBranchDelete(target.branch)
      }
    }
  }

  // At most one stdout path, even when a batch includes the current worktree.
  if (removedCurrent) process.stdout.write(`${root}\n`)
}

// Dirty guard (checked against the worktree's own path, still present here).
// On a terminal we show the changes and ask to remove anyway. Declining skips
// that worktree so the rest of a multi-selection can still be processed.
async function confirmDirtyRemoval(target: Worktree): Promise<boolean> {
  const status = await worktreeStatus(target.path)
  if (!status) return true

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
  return confirm(question)
}

// Print `git status --short` output, one blue line per pending change.
function showChanges(status: string, padding = 2) {
  for (const line of status.split('\n'))
    say(chalk.cyan(`${' '.repeat(padding)}${line}`))
  say()
}

// Resolve a target the same way cd does — exact name/branch first, then fuzzy
// ranked by frecency — but because rm is destructive, a fuzzy hit needs a Y/n
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
