import {mkdir} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {
  addWorktree,
  branchExists,
  currentBranch,
  detach,
  mainRoot,
  worktreeForBranch,
} from '../git'
import {printError, printInfo, printSuccess} from '../helpers'

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

  const path = join(root, '.wkt', branch)

  // If the branch is already checked out in the MAIN worktree, detach it there
  // first so this worktree can take it. A branch held by some OTHER worktree is
  // left alone — git will refuse and we surface that error.
  if (!create) {
    const holder = await worktreeForBranch(branch)
    if (holder?.isMain) {
      printInfo(`detaching ${holder.path} to free ${branch}`)
      const res = await detach(holder.path)
      if (res.code !== 0) {
        printError(res.stderr || `could not detach ${holder.path}`)
        process.exit(1)
      }
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
      ? `created ${branch} at .wkt/${branch}`
      : `added worktree for ${branch} at .wkt/${branch}`,
  )
  // The single stdout line: where the shell wrapper should cd.
  process.stdout.write(`${path}\n`)
}
