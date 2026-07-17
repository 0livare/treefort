import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {listWorktrees, WORKTREE_DIR, type Worktree, worktreeName} from './git'

// Per-repo frecency database for ranking worktrees, stored under the worktrees
// dir (so it's gitignored). Keyed by absolute worktree path.
type Entry = {score: number; lastAccess: number}
type Db = Record<string, Entry>

const HOUR = 3_600_000
const DAY = 24 * HOUR
const WEEK = 7 * DAY

const fileFor = (root: string) => join(root, WORKTREE_DIR, '.frecency.json')

async function load(root: string): Promise<Db> {
  const file = Bun.file(fileFor(root))
  if (!(await file.exists())) return {}
  try {
    const data = JSON.parse(await file.text())
    return data && typeof data === 'object' ? (data as Db) : {}
  } catch {
    return {} // tolerate a missing/corrupt file
  }
}

async function save(root: string, db: Db): Promise<void> {
  await mkdir(join(root, WORKTREE_DIR), {recursive: true})
  await Bun.write(fileFor(root), JSON.stringify(db))
}

// zoxide's frecency curve applied to a single entry.
function frecency(entry: Entry, now: number): number {
  const age = now - entry.lastAccess
  if (age < HOUR) return entry.score * 4
  if (age < DAY) return entry.score * 2
  if (age < WEEK) return entry.score / 2
  return entry.score / 4
}

// Record a visit to `path` (+1 score, refresh timestamp) and prune entries for
// worktrees that no longer exist.
export async function recordAccess(root: string, path: string): Promise<void> {
  const db = await load(root)
  const entry = db[path] ?? {score: 0, lastAccess: 0}
  db[path] = {score: entry.score + 1, lastAccess: Date.now()}

  const live = new Set((await listWorktrees()).map((w) => w.path))
  const pruned: Db = {}
  for (const [key, value] of Object.entries(db)) {
    if (live.has(key)) pruned[key] = value
  }
  await save(root, pruned)
}

// Sort worktrees by frecency (desc), then last access (desc), then name
// length (asc), then name (asc). Unvisited worktrees score 0.
export async function rank(
  root: string,
  worktrees: Worktree[],
): Promise<Worktree[]> {
  const db = await load(root)
  const now = Date.now()
  const scoreOf = (w: Worktree) => {
    const e = db[w.path]
    return e ? frecency(e, now) : 0
  }
  const accessOf = (w: Worktree) => db[w.path]?.lastAccess ?? 0

  return [...worktrees].sort((a, b) => {
    const byScore = scoreOf(b) - scoreOf(a)
    if (byScore !== 0) return byScore
    const byAccess = accessOf(b) - accessOf(a)
    if (byAccess !== 0) return byAccess
    const nameA = worktreeName(a)
    const nameB = worktreeName(b)
    return nameA.length - nameB.length || nameA.localeCompare(nameB)
  })
}
