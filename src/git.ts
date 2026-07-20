import {mkdir, rename} from 'node:fs/promises'
import {basename, join} from 'node:path'

// Directory (under the repo root) where wt creates worktrees and keeps its
// per-repo state (.trash, .frecency.json, .previous).
export const WORKTREE_DIR = '.worktrees'

export type Worktree = {
  path: string
  branch: string | null // short name, or null when detached
  head: string // commit hash
  isMain: boolean
  isBare: boolean // bare-clone layout: the main entry is the bare repo itself
  isCurrent: boolean
}

type RunResult = {code: number; stdout: string; stderr: string}

async function run(cmd: string[], cwd?: string): Promise<RunResult> {
  const proc = Bun.spawn(cmd, {cwd, stdout: 'pipe', stderr: 'pipe'})
  // Read the pipes before awaiting exit so a full buffer can't deadlock the child.
  const stdoutP = new Response(proc.stdout).text()
  const stderrP = new Response(proc.stderr).text()
  const code = await proc.exited
  const [stdout, stderr] = await Promise.all([stdoutP, stderrP])
  // Trailing-only trim on stdout: `git status --short` uses a significant
  // leading column (e.g. ` M file` for an unstaged change), and a blanket
  // .trim() would strip the first line's leading space and misreport it.
  return {code, stdout: stdout.replace(/\s+$/, ''), stderr: stderr.trim()}
}

export async function listWorktrees(): Promise<Worktree[]> {
  const {code, stdout} = await run(['git', 'worktree', 'list', '--porcelain'])
  if (code !== 0) return []

  const current = await currentWorktree()
  const worktrees: Worktree[] = []
  let cur: {
    path?: string
    head?: string
    branch?: string | null
    bare?: boolean
  } = {}

  const flush = () => {
    if (!cur.path) return
    worktrees.push({
      path: cur.path,
      branch: cur.branch ?? null,
      head: cur.head ?? '',
      isMain: worktrees.length === 0,
      isBare: cur.bare ?? false,
      isCurrent: cur.path === current,
    })
    cur = {}
  }

  for (const line of stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      flush()
      cur.path = line.slice('worktree '.length)
    } else if (line.startsWith('HEAD ')) {
      cur.head = line.slice('HEAD '.length)
    } else if (line.startsWith('branch ')) {
      cur.branch = line.slice('branch refs/heads/'.length)
    } else if (line === 'detached') {
      cur.branch = null
    } else if (line === 'bare') {
      cur.bare = true
    }
  }
  flush()
  return worktrees
}

// The main worktree is always the first entry of `git worktree list`.
export async function mainWorktree(): Promise<Worktree | null> {
  const worktrees = await listWorktrees()
  return worktrees[0] ?? null
}

export async function mainRoot(): Promise<string | null> {
  return (await mainWorktree())?.path ?? null
}

// Display / lookup name: the main worktree is "root"; others use their path
// relative to the worktrees dir (so `feat/x` and `fix/x` stay distinct), or
// their dir name when they live outside it.
export function worktreeName(w: Worktree): string {
  if (w.isMain) return 'root'
  const marker = `/${WORKTREE_DIR}/`
  const at = w.path.lastIndexOf(marker)
  return at === -1 ? basename(w.path) : w.path.slice(at + marker.length)
}

// Absolute path of the worktree the cwd is in (its top level), or null.
export async function currentWorktree(): Promise<string | null> {
  const {code, stdout} = await run(['git', 'rev-parse', '--show-toplevel'])
  return code === 0 ? stdout : null
}

// Short branch name of the current worktree, or null when HEAD is detached.
export async function currentBranch(): Promise<string | null> {
  const {code, stdout} = await run([
    'git',
    'symbolic-ref',
    '--quiet',
    '--short',
    'HEAD',
  ])
  return code === 0 && stdout ? stdout : null
}

export async function branchExists(branch: string): Promise<boolean> {
  const {code} = await run([
    'git',
    'show-ref',
    '--verify',
    '--quiet',
    `refs/heads/${branch}`,
  ])
  return code === 0
}

// Remotes that have a branch named `branch` (e.g. ['origin', 'upstream']).
export async function remotesWithBranch(branch: string): Promise<string[]> {
  const {code, stdout} = await run(['git', 'remote'])
  if (code !== 0 || !stdout) return []
  const found: string[] = []
  for (const remote of stdout.split('\n').filter(Boolean)) {
    const ref = await run([
      'git',
      'show-ref',
      '--verify',
      '--quiet',
      `refs/remotes/${remote}/${branch}`,
    ])
    if (ref.code === 0) found.push(remote)
  }
  return found
}

// The repo's trunk branch: 'main' if it exists, else 'master', else null.
export async function trunkBranch(): Promise<string | null> {
  for (const name of ['main', 'master']) {
    if (await branchExists(name)) return name
  }
  return null
}

// Local branch names whose tip is reachable from `ref` — i.e. already merged
// into it. Includes `ref`'s own branch, so callers should filter it out.
export async function branchesMergedInto(ref: string): Promise<string[]> {
  const {code, stdout} = await run([
    'git',
    'branch',
    '--merged',
    ref,
    '--format=%(refname:short)',
  ])
  if (code !== 0) return []
  return stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

// The worktree currently checking out `branch`, if any.
export async function worktreeForBranch(
  branch: string,
): Promise<Worktree | null> {
  const worktrees = await listWorktrees()
  return worktrees.find((w) => w.branch === branch) ?? null
}

// Uncommitted changes in a worktree as `git status --short` lines (empty = clean).
export async function worktreeStatus(worktreePath: string): Promise<string> {
  const {stdout} = await run(['git', 'status', '--short'], worktreePath)
  return stdout
}

export async function isDirty(worktreePath: string): Promise<boolean> {
  return (await worktreeStatus(worktreePath)).length > 0
}

// Detach a worktree's HEAD at its current commit, freeing its branch.
export function detach(worktreePath: string): Promise<RunResult> {
  return run(['git', 'checkout', '--detach'], worktreePath)
}

// Check out a branch in a worktree.
export function checkout(
  worktreePath: string,
  ref: string,
): Promise<RunResult> {
  return run(['git', 'checkout', ref], worktreePath)
}

// Fast-forward a worktree from its branch's configured upstream.
export function pull(worktreePath: string): Promise<RunResult> {
  return run(['git', 'pull', '--ff-only'], worktreePath)
}

export type AddOptions = {
  path: string
  branch: string
  create: boolean // -b a new branch vs check out an existing one
  startPoint?: string
  track?: boolean // set the new branch's upstream to startPoint
  force?: boolean
}

export function addWorktree(opts: AddOptions): Promise<RunResult> {
  const args = ['git', 'worktree', 'add']
  if (opts.force) args.push('--force')
  if (opts.create) {
    if (opts.track) args.push('--track')
    args.push('-b', opts.branch, opts.path)
    if (opts.startPoint) args.push(opts.startPoint)
  } else {
    args.push(opts.path, opts.branch)
  }
  return run(args)
}

export async function pruneWorktrees(): Promise<void> {
  await run(['git', 'worktree', 'prune'])
}

// Instantly retire a worktree: move it into <WORKTREE_DIR>/.trash via a same-fs
// rename (so the caller returns without waiting on the delete), deregister it,
// then let a detached rm -rf finish the slow filesystem delete. False = rename
// failed.
export async function trashWorktree(
  root: string,
  worktreePath: string,
): Promise<boolean> {
  const trashDir = join(root, WORKTREE_DIR, '.trash')
  await mkdir(trashDir, {recursive: true})
  const trashed = join(trashDir, `${basename(worktreePath)}-${Date.now()}`)
  try {
    await rename(worktreePath, trashed)
  } catch {
    return false
  }
  await pruneWorktrees()
  spawnDetachedRm(trashed)
  return true
}

// True if `branch`'s cumulative changes already exist on `ref` — i.e. the
// branch was squash-merged. Squash merges leave no reachable tip, so ancestry
// checks miss them; instead, synthesize a single commit holding the branch's
// whole diff since the merge-base (the commit-tree trick) and ask `git cherry`
// whether a patch-equivalent commit is already upstream.
export async function isSquashMergedInto(
  branch: string,
  ref: string,
): Promise<boolean> {
  const base = await run(['git', 'merge-base', ref, branch])
  if (base.code !== 0) return false
  const tree = await run(['git', 'rev-parse', `${branch}^{tree}`])
  if (tree.code !== 0) return false
  const squashed = await run([
    'git',
    'commit-tree',
    tree.stdout,
    '-p',
    base.stdout,
    '-m',
    'wt squash-merge check',
  ])
  if (squashed.code !== 0) return false
  const cherry = await run(['git', 'cherry', ref, squashed.stdout])
  return cherry.code === 0 && cherry.stdout.startsWith('-')
}

// True if deleting `branch` would lose no work: its tip commit is contained in
// the history of some *other* ref — another local branch or any
// remote-tracking ref (covers both "merged into main" and "pushed") — or its
// changes were squash-merged into the trunk.
export async function branchIsSafeToDelete(branch: string): Promise<boolean> {
  const {code, stdout} = await run([
    'git',
    'for-each-ref',
    '--format=%(refname)',
    '--contains',
    branch,
    'refs/heads',
    'refs/remotes',
  ])
  if (code !== 0) return false
  const contained = stdout
    .split('\n')
    .filter(Boolean)
    .some((ref) => ref !== `refs/heads/${branch}`)
  if (contained) return true

  const trunk = await trunkBranch()
  if (!trunk || trunk === branch) return false
  return isSquashMergedInto(branch, trunk)
}

export function deleteBranch(branch: string): Promise<RunResult> {
  return run(['git', 'branch', '-D', branch])
}

// Fire-and-forget `rm -rf` that outlives this process, so removal returns
// immediately instead of blocking on the filesystem delete.
export function spawnDetachedRm(path: string): void {
  const proc = Bun.spawn(['rm', '-rf', path], {
    stdout: 'ignore',
    stderr: 'ignore',
    stdin: 'ignore',
  })
  proc.unref()
}

// Names of the linked (non-main) worktrees, for shell completion.
export async function worktreeNames(): Promise<string[]> {
  const worktrees = await listWorktrees()
  return worktrees.filter((w) => !w.isMain).map(worktreeName)
}

// Everything `wt cd` accepts: worktree names (incl. "root") + their branches.
// A bare root is omitted — `wt root` still works, but it isn't suggested.
export async function cdTargets(): Promise<string[]> {
  const worktrees = await listWorktrees()
  const targets = new Set<string>()
  for (const w of worktrees) {
    if (w.isBare) continue
    targets.add(worktreeName(w))
    if (w.branch) targets.add(w.branch)
  }
  return [...targets]
}

// Local + remote branch names, for `wt add` completion.
export async function branchNames(): Promise<string[]> {
  const {code, stdout} = await run([
    'git',
    'for-each-ref',
    '--format=%(refname:short)',
    'refs/heads',
    'refs/remotes',
  ])
  if (code !== 0) return []
  return stdout.split('\n').filter((n) => n && !n.endsWith('/HEAD'))
}

export async function globalExcludesFile(): Promise<string | null> {
  const {code, stdout} = await run([
    'git',
    'config',
    '--global',
    'core.excludesfile',
  ])
  return code === 0 && stdout ? stdout : null
}

export async function setGlobalExcludesFile(path: string): Promise<void> {
  await run(['git', 'config', '--global', 'core.excludesfile', path])
}
