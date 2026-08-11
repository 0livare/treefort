import {existsSync} from 'node:fs'
import {mkdir} from 'node:fs/promises'
import {dirname} from 'node:path'
import {renameAccess} from '../frecency'
import {
  branchExists,
  listWorktrees,
  moveWorktree,
  renameBranch,
  unlockWorktree,
  type Worktree,
  worktreeName,
} from '../git'
import {printError, printInfo, printSuccess} from '../helpers'
import {getPrevious, setPrevious} from '../prev'

// Rename an existing worktree: move its directory and — when the branch still
// carries the worktree's name — rename the branch in lockstep, the way `wt add`
// created the pair. Writes the new path to stdout when the renamed worktree is
// the current one, so the shell wrapper cds to follow the move.
export async function rename(
  a: string | undefined,
  b: string | undefined,
): Promise<void> {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    printError('not a git repository')
    process.exit(1)
  }

  // `wt rename <new>` renames the current worktree; `wt rename <old> <new>`
  // names both ends explicitly.
  const [oldName, newName] = b === undefined ? [undefined, a] : [a, b]
  if (!newName) {
    printError('usage: wt rename [old] <new>')
    process.exit(1)
  }

  const root = worktrees[0].path

  let target: Worktree | undefined
  if (oldName) {
    target = worktrees.find(
      (w) => worktreeName(w) === oldName || w.branch === oldName,
    )
    if (!target) {
      printError(`no worktree matching "${oldName}"`)
      process.exit(1)
    }
  } else {
    target = worktrees.find((w) => w.isCurrent)
    if (!target) {
      printError('not inside a worktree — pass one: wt rename <old> <new>')
      process.exit(1)
    }
  }

  if (target.isMain) {
    printError('cannot rename the root worktree')
    process.exit(1)
  }

  // Mirror `wt add`: the trunk branch belongs to the root worktree, never a
  // named one.
  if (newName === 'main' || newName === 'master') {
    printError(`refusing to rename to "${newName}"`)
    process.exit(1)
  }

  const from = worktreeName(target)
  if (newName === from) {
    printError(`worktree is already named "${newName}"`)
    process.exit(1)
  }

  // Keep the worktree in whichever home it already lives in (.worktrees or
  // .claude/worktrees): swap only the trailing name, so a nested name like
  // feat/x moves within the same tree.
  const home = target.path.slice(0, target.path.length - from.length)
  const newPath = home + newName
  if (existsSync(newPath)) {
    printError(`a directory already exists at ${newPath}`)
    process.exit(1)
  }

  // Only rename the branch when it still matches the worktree name — the
  // in-sync case `wt add` sets up. A branch that was renamed independently (or
  // a detached HEAD) is left as-is; we just move the directory.
  const renameBranchToo = target.branch != null && target.branch === from
  if (renameBranchToo && (await branchExists(newName))) {
    printError(`branch "${newName}" already exists`)
    process.exit(1)
  }

  // If we're standing in the worktree being moved, our cwd is about to vanish —
  // run git from the root instead.
  process.chdir(root)

  await mkdir(dirname(newPath), {recursive: true})
  // Claude Code leaves a lock on worktrees it opens, and `git worktree move`
  // refuses a locked worktree; clear it first (a no-op when there's none).
  await unlockWorktree(target.path)

  const moved = await moveWorktree(target.path, newPath)
  if (moved.code !== 0) {
    printError(moved.stderr || 'git worktree move failed')
    process.exit(1)
  }

  if (renameBranchToo && target.branch) {
    const res = await renameBranch(target.branch, newName)
    if (res.code !== 0) {
      printError(res.stderr || `could not rename branch to "${newName}"`)
      process.exit(1)
    }
  }

  // Carry internal state across the move: frecency ranking and the `wt cd -`
  // pointer are keyed by absolute path.
  await renameAccess(root, target.path, newPath)
  if ((await getPrevious(root)) === target.path)
    await setPrevious(root, newPath)

  printSuccess(`renamed ${from} → ${newName}`)
  if (target.branch && !renameBranchToo) {
    printInfo(`branch left as "${target.branch}"`)
  }

  // The one stdout line: follow the move when it's the worktree we're in.
  if (target.isCurrent) process.stdout.write(`${newPath}\n`)
}
