import {mkdir} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {copyEnvFiles} from '../env-files'
import {recordAccess} from '../frecency'
import {
  addWorktree,
  branchExists,
  checkout,
  currentBranch,
  currentWorktree,
  detach,
  isDirty,
  mainWorktree,
  remotesWithBranch,
  trunkBranch,
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
  const rootWorktree = await mainWorktree()
  if (!rootWorktree) {
    printError('not a git repository')
    process.exit(1)
  }
  const root = rootWorktree.path

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
    // An existing branch is checked out as-is; a start-point can't be honored.
    if (!create && startPoint) {
      printError(
        `branch "${branch}" already exists — a start-point only applies when creating a new branch`,
      )
      process.exit(1)
    }
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

  // Base for a new branch: '.' opts in to the current worktree's HEAD (git has
  // no native syntax for this); with no start-point, always fork off wherever
  // the root worktree is — never whichever worktree the shell happens to be in.
  // A bare root has no checkout to fork from, so use the trunk branch.
  let base = startPoint
  let track = false
  if (base === '.') base = 'HEAD'
  else if (!base && create) {
    // A branch that lives only on a remote should be picked up from there —
    // not shadowed by a fresh same-named branch forked off the root.
    const remotes = await remotesWithBranch(branch)
    if (remotes.length > 1) {
      printError(
        `branch "${branch}" exists on multiple remotes (${remotes.join(', ')}) — pick one: wt add ${branch} ${remotes[0]}/${branch}`,
      )
      process.exit(1)
    }
    if (remotes.length === 1) {
      base = `${remotes[0]}/${branch}`
      track = true
    } else {
      base = rootWorktree.isBare
        ? ((await trunkBranch()) ?? '')
        : (rootWorktree.branch ?? rootWorktree.head)
    }
    if (!base) {
      printError(
        'could not determine a start-point — pass one: wt add <name> <start-point>',
      )
      process.exit(1)
    }
  }

  const path = join(root, WORKTREE_DIR, branch)

  // If the branch is already checked out in the MAIN worktree, free it there
  // first so this worktree can take it. A branch held by some OTHER worktree is
  // left alone — git will refuse and we surface that error.
  if (!create) {
    const holder = await worktreeForBranch(branch)
    if (holder?.isMain) {
      // Freeing means switching the root's branch — don't drag uncommitted
      // changes along without an explicit opt-in.
      if (!opts.force && (await isDirty(holder.path))) {
        printError(
          `the root worktree has uncommitted changes on ${branch} — commit or stash them, or use --force`,
        )
        process.exit(1)
      }
      if (!(await freeRootWorktree(holder.path))) {
        printError(`could not free ${branch} from ${holder.path}`)
        process.exit(1)
      }
    }
  }

  await mkdir(dirname(path), {recursive: true})

  const res = await addWorktree({
    path,
    branch,
    create,
    startPoint: base,
    track,
    force: opts.force,
  })
  if (res.code !== 0) {
    printError(res.stderr || 'git worktree add failed')
    process.exit(1)
  }

  printSuccess(`created ${WORKTREE_DIR}/${branch}`)
  if (create && track) printSuccess(`  tracking ${base}`)

  // Bring over env files git won't (gitignored .env*), from the main worktree.
  // A bare root has no working files to copy.
  if (!rootWorktree.isBare) await copyEnvFiles(root, path)

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
