import {basename} from 'node:path'

export type Worktree = {
  path: string
  branch: string | null // short name, or null when detached
  head: string // commit hash
  isMain: boolean
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
  return {code, stdout: stdout.trim(), stderr: stderr.trim()}
}

export async function listWorktrees(): Promise<Worktree[]> {
  const {code, stdout} = await run(['git', 'worktree', 'list', '--porcelain'])
  if (code !== 0) return []

  const current = await currentWorktree()
  const worktrees: Worktree[] = []
  let cur: {path?: string; head?: string; branch?: string | null} = {}

  const flush = () => {
    if (!cur.path) return
    worktrees.push({
      path: cur.path,
      branch: cur.branch ?? null,
      head: cur.head ?? '',
      isMain: worktrees.length === 0,
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
    }
  }
  flush()
  return worktrees
}

// The main worktree is always the first entry of `git worktree list`.
export async function mainRoot(): Promise<string | null> {
  const worktrees = await listWorktrees()
  return worktrees[0]?.path ?? null
}

// Display / lookup name: the main worktree is "root", others use their dir name.
export function worktreeName(w: Worktree): string {
  return w.isMain ? 'root' : basename(w.path)
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

export type AddOptions = {
  path: string
  branch: string
  create: boolean // -b a new branch vs check out an existing one
  startPoint?: string
  force?: boolean
}

export function addWorktree(opts: AddOptions): Promise<RunResult> {
  const args = ['git', 'worktree', 'add']
  if (opts.force) args.push('--force')
  if (opts.create) {
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

// True if deleting `branch` would lose no commits: its tip commit is contained
// in the history of some *other* ref — another local branch or any
// remote-tracking ref. (Covers both "merged into main" and "pushed".)
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
  return stdout
    .split('\n')
    .filter(Boolean)
    .some((ref) => ref !== `refs/heads/${branch}`)
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
  return worktrees.filter((w) => !w.isMain).map((w) => basename(w.path))
}

// Everything `wt cd` accepts: worktree names (incl. "root") + their branches.
export async function cdTargets(): Promise<string[]> {
  const worktrees = await listWorktrees()
  const targets = new Set<string>()
  for (const w of worktrees) {
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
