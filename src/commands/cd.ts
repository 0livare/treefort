import {existsSync} from 'node:fs'
import {rank, recordAccess} from '../frecency'
import {
  listWorktrees,
  pathInWorktree,
  type Worktree,
  worktreeName,
} from '../git'
import {printError, printInfo} from '../helpers'
import {matchesQuery} from '../match'
import {getPrevious, setPrevious} from '../prev'
import {confirm, isInteractive} from '../select'
import {
  currentWorktreeFirst,
  pickerState,
  pickWorktree,
  restorePickerState,
  type WorktreePickerState,
} from '../worktree-picker'
import {add} from './add'
import {remove} from './remove'

// The one worktree-navigation path. With a target, resolve it (`-` = previous,
// `root`/`@` = main, else exact-then-fuzzy name/branch match); with no target,
// open the interactive picker. Bare `wt` and `wt <name>` both funnel through
// here — cd is wt's default command. Prints the chosen path to stdout for the
// shell wrapper to cd into.
export async function cd(target?: string, picker?: WorktreePickerState) {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    if (target === undefined) process.exit(0) // not a git repo; nothing to pick
    printError('not a git repository')
    process.exit(1)
  }

  const root = worktrees[0].path
  const current = worktrees.find((w) => w.isCurrent)?.path

  let created = false
  const dest =
    target === undefined
      ? await pick(worktrees, root, picker)
      : await resolveWorktree({
          target,
          worktrees,
          root,
          // No match: offer to create a worktree with that name.
          onNoMatch: async () => {
            const path = await offerToCreate(target)
            created = path !== null
            return path
          },
        })
  if (dest === null) return // picker cancelled, or create declined

  // Remember where we were so `wt cd -` can toggle back, and bump frecency —
  // unless add() just did both while creating the worktree.
  if (!created) {
    if (current && current !== dest) await setPrevious(root, current)
    await recordAccess(root, dest)
  }
  process.stdout.write(`${pathInWorktree(dest, current ?? null)}\n`)
}

// Interactive picker, with the current worktree first and the rest ordered by
// frecency. A bare root isn't offered (nothing to work in there). Returns the
// chosen path, or null if cancelled.
async function pick(
  worktrees: Worktree[],
  root: string,
  state?: WorktreePickerState,
): Promise<string | null> {
  const pickable = worktrees.filter((w) => !w.isBare)
  // Only the root worktree exists — there's nothing else to switch to, so skip
  // the one-entry picker and tell the user how to make more.
  if (pickable.every((w) => w.path === root)) {
    printInfo('no other worktrees — run `wt add <name>` to create one')
    return null
  }
  const ranked = state
    ? restorePickerState(pickable, state)
    : {
        worktrees: currentWorktreeFirst(await rank(root, pickable)),
        initialIndex: 0,
      }
  const chosen = await pickWorktree(ranked.worktrees, {
    title: 'Switch to worktree',
    initialIndex: ranked.initialIndex,
    shortcuts: [
      {
        keys: ['d', '\x1b[C'],
        hint: 'd/→',
        label: 'remove',
        run: (selectedIndex) =>
          remove(undefined, {
            picker: pickerState(ranked.worktrees, selectedIndex),
            back: (nextState) => cd(undefined, nextState),
          }),
      },
    ],
  })
  return chosen?.path ?? null
}

type ResolveOpts = {
  target: string
  worktrees: Worktree[]
  root: string
  // Called when nothing matches; its result becomes the resolved path. cd uses
  // it to offer creating one. Omit it to error and exit instead (what exec wants).
  onNoMatch?: () => Promise<string | null>
}

// Resolve a target string to a worktree path. Shared with `wt exec` so both
// resolve targets identically.
export function resolveWorktree(
  opts: Omit<ResolveOpts, 'onNoMatch'>,
): Promise<string>
export function resolveWorktree(
  opts: ResolveOpts & {onNoMatch: () => Promise<string | null>},
): Promise<string | null>
export async function resolveWorktree({
  target,
  worktrees,
  root,
  onNoMatch,
}: ResolveOpts): Promise<string | null> {
  if (target === '-') {
    const prev = await getPrevious(root)
    if (!prev || !existsSync(prev)) {
      printError('no previous worktree')
      process.exit(1)
    }
    return prev
  }
  if (target === 'root' || target === '@') return root

  // Exact name/branch match wins; otherwise fall back to fuzzy matching and,
  // when several match, pick the highest-frecency one.
  const exact = worktrees.find(
    (w) => worktreeName(w) === target || w.branch === target,
  )
  if (exact) return exact.path

  const matches = worktrees.filter(
    (w) =>
      !w.isBare &&
      (matchesQuery(target, worktreeName(w)) ||
        (w.branch != null && matchesQuery(target, w.branch))),
  )
  if (matches.length === 0) {
    if (onNoMatch) return onNoMatch()
    printError(`no worktree matching "${target}"`)
    process.exit(1)
  }
  return matches.length === 1
    ? matches[0].path
    : (await rank(root, matches))[0].path
}

// No worktree matched the target: ask whether to create one for it. On yes,
// hand off to add() and return the new worktree's path; on no, return null so
// the caller stays put. Shared with `wt claude`.
export async function offerToCreate(target: string): Promise<string | null> {
  // Without a terminal there's nobody to ask — fail like a plain no-match.
  if (!isInteractive()) {
    printError(`no worktree matching "${target}"`)
    process.exit(1)
  }
  if (await confirm(`no worktree matching "${target}" — create it?`)) {
    return add(target, undefined, {})
  }
  return null
}
