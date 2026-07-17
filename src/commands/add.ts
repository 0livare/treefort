import {mkdir} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {recordAccess} from '../frecency'
import {
  addWorktree,
  branchExists,
  checkout,
  currentBranch,
  currentWorktree,
  detach,
  mainRoot,
  WORKTREE_DIR,
  worktreeForBranch,
} from '../git'
import {printError, printInfo, printSuccess} from '../helpers'
import {setPrevious} from '../prev'

export async function add(
  name: string | undefined,
  startPoint: string | undefined,
  opts: {force?: boolean},
) {
  const root = await mainRoot()
  if (!root) {
    printError('not a git repository')
    process.exit(1)
  }

  let branch = name
  let create: boolean

  if (!branch) {
    // No name: "graduate" the current branch into its own worktree.
    if (startPoint) {
      printError(
        'start-point is only valid with a name: wt add <name> <start-point>',
      )
      process.exit(1)
    }
    const cur = await currentBranch()
    if (!cur) {
      printError('no current branch — pass a name: wt add <name>')
      process.exit(1)
    }
    branch = cur
    create = false
  } else {
    create = !(await branchExists(branch))
  }

  // Never carve off a worktree for the trunk branch — that's the main worktree's job.
  if (branch === 'main' || branch === 'master') {
    printError(
      name
        ? `refusing to create a worktree named "${branch}"`
        : `current branch is "${branch}" — pass a name: wt add <name>`,
    )
    process.exit(1)
  }

  const path = join(root, WORKTREE_DIR, branch)

  // If the branch is already checked out in the MAIN worktree, free it there
  // first so this worktree can take it. A branch held by some OTHER worktree is
  // left alone — git will refuse and we surface that error.
  if (!create) {
    const holder = await worktreeForBranch(branch)
    if (holder?.isMain && !(await freeRootWorktree(holder.path))) {
      printError(`could not free ${branch} from ${holder.path}`)
      process.exit(1)
    }
  }

  await mkdir(dirname(path), {recursive: true})

  const res = await addWorktree({
    path,
    branch,
    create,
    startPoint,
    force: opts.force,
  })
  if (res.code !== 0) {
    printError(res.stderr || 'git worktree add failed')
    process.exit(1)
  }

  printSuccess(
    create
      ? `created ${branch} at ${WORKTREE_DIR}/${branch}`
      : `added worktree for ${branch} at ${WORKTREE_DIR}/${branch}`,
  )
  // Remember where we were so `wt cd -` can bring us back.
  const from = await currentWorktree()
  if (from && from !== path) await setPrevious(root, from)
  // Bump frecency for the worktree we're entering.
  await recordAccess(root, path)

  // The single stdout line: where the shell wrapper should cd.
  process.stdout.write(`${path}\n`)
}

// Free the root worktree from its current branch so another worktree can take
// it: prefer checking out the trunk branch (main, then master); fall back to a
// detached HEAD only if that fails (e.g. the trunk is checked out elsewhere).
async function freeRootWorktree(rootPath: string): Promise<boolean> {
  for (const trunk of ['main', 'master']) {
    if (await branchExists(trunk)) {
      const res = await checkout(rootPath, trunk)
      if (res.code === 0) {
        printInfo(`checked out ${trunk} in the root worktree`)
        return true
      }
    }
  }
  if ((await detach(rootPath)).code === 0) {
    printInfo('detached the root worktree')
    return true
  }
  return false
}
