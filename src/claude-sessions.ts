import {existsSync} from 'node:fs'
import {readdir, stat} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join, sep} from 'node:path'
import {
  CLAUDE_WORKTREE_DIR,
  WORKTREE_DIR,
  type Worktree,
  worktreeName,
} from './git'

// Claude Code stores each session as a jsonl transcript under
// $CLAUDE_CONFIG_DIR/projects/<encoded-cwd>/<session-id>.jsonl, keyed strictly
// by the directory the session ran in — a worktree's sessions live in the
// worktree's own project dir, never the repo root's. This module aggregates a
// repo's sessions by computing the project dir for the root and every
// worktree, plus any project dir left behind by a directory under the root
// that no longer exists (e.g. a removed worktree).

export type ClaudeSession = {
  id: string
  cwd: string // the directory the session ran in
  name: string // display name: 'root', the worktree name, or a relative path
  exists: boolean // cwd is still on disk — resume from there vs the root
  title: string
  mtimeMs: number
}

export function claudeProjectsDir(): string {
  const config = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')
  return join(config, 'projects')
}

// Claude Code's project-dir encoding: every character of the session cwd that
// isn't alphanumeric becomes '-'.
export function encodeProjectPath(path: string): string {
  return path.replace(/[^a-zA-Z0-9]/g, '-')
}

// One transcript line, loosely typed — only the fields the extractors look at.
type Line = {
  type?: unknown
  summary?: unknown
  isMeta?: unknown
  cwd?: unknown
  message?: unknown
}

function parseLines(jsonl: string): Line[] {
  const lines: Line[] = []
  for (const line of jsonl.split('\n')) {
    if (!line) continue
    try {
      lines.push(JSON.parse(line) as Line)
    } catch {
      // A truncated read cuts the last line mid-object; skip anything torn.
    }
  }
  return lines
}

// First text of a user message: plain string content, or the first text block.
function userText(entry: Line): string | null {
  if (entry.type !== 'user' || entry.isMeta === true) return null
  const message = entry.message
  if (typeof message !== 'object' || message === null) return null
  const content = (message as {content?: unknown}).content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return null
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue
    const {type, text} = block as {type?: unknown; text?: unknown}
    if (type === 'text' && typeof text === 'string') return text
  }
  return null
}

const TITLE_WIDTH = 60

function tidy(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > TITLE_WIDTH ? `${flat.slice(0, TITLE_WIDTH - 1)}…` : flat
}

// A session's display title: its summary line when Claude has written one,
// else the first real user prompt. Command/system wrappers (<command-name>,
// <system-reminder>, …) aren't prompts, so anything tag-shaped is skipped.
export function extractTitle(jsonl: string): string | null {
  let prompt: string | null = null
  for (const entry of parseLines(jsonl)) {
    if (entry.type === 'summary' && typeof entry.summary === 'string') {
      return tidy(entry.summary)
    }
    if (prompt !== null) continue
    const text = userText(entry)
    if (text && !text.startsWith('<')) prompt = tidy(text)
  }
  return prompt
}

// The cwd a transcript records — how a leftover project dir is mapped back to
// the directory its sessions ran in (the dir-name encoding is lossy).
export function extractCwd(jsonl: string): string | null {
  for (const entry of parseLines(jsonl)) {
    if (typeof entry.cwd === 'string') return entry.cwd
  }
  return null
}

// Coarse relative age for the picker: now / …m / …h / …d / …w.
export function timeAgo(mtimeMs: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - mtimeMs) / 1000))
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return `${Math.floor(d / 7)}w`
}

// Reading a bounded prefix keeps discovery cheap on long transcripts; both the
// summary line and the first prompt sit at the top of the file.
const HEAD_BYTES = 64 * 1024

function readHead(path: string): Promise<string> {
  return Bun.file(path)
    .slice(0, HEAD_BYTES)
    .text()
    .catch(() => '')
}

// Display name for a session dir that isn't a live worktree: its path relative
// to the root, with a known worktrees dir stripped (so a removed worktree
// reads by its old name).
function relativeName(root: string, cwd: string): string {
  const rel = cwd.slice(root.length + sep.length)
  for (const dir of [CLAUDE_WORKTREE_DIR, WORKTREE_DIR]) {
    if (rel.startsWith(dir + sep)) return rel.slice(dir.length + sep.length)
  }
  return rel
}

// Every Claude session belonging to the repo, newest first: the root's, each
// worktree's, and those of any directory under the root whose project dir
// outlived it. Leftover dirs are matched by encoded prefix and then confirmed
// against the cwd their transcripts record, since the encoding is lossy
// (`repo.bak` and `repo/bak` collide).
export async function listSessions(
  root: string,
  worktrees: Worktree[],
): Promise<ClaudeSession[]> {
  const projects = claudeProjectsDir()
  let dirs: string[]
  try {
    dirs = await readdir(projects)
  } catch {
    return []
  }

  const live = new Map<string, {cwd: string; name: string}>()
  for (const w of worktrees) {
    if (w.isBare) continue
    live.set(encodeProjectPath(w.path), {cwd: w.path, name: worktreeName(w)})
  }
  const rootPrefix = `${encodeProjectPath(root)}-`

  const sessions: ClaudeSession[] = []
  for (const dir of dirs) {
    const dirPath = join(projects, dir)
    let files: string[]
    try {
      files = (await readdir(dirPath)).filter((f) => f.endsWith('.jsonl'))
    } catch {
      continue
    }
    if (files.length === 0) continue

    let where = live.get(dir) ?? null
    if (where === null) {
      if (!dir.startsWith(rootPrefix)) continue
      const cwd = extractCwd(await readHead(join(dirPath, files[0])))
      if (cwd === null || !cwd.startsWith(root + sep)) continue
      where = {cwd, name: relativeName(root, cwd)}
    }

    const exists = existsSync(where.cwd)
    for (const file of files) {
      const path = join(dirPath, file)
      let mtimeMs: number
      try {
        const info = await stat(path)
        if (info.size === 0) continue
        mtimeMs = info.mtimeMs
      } catch {
        continue
      }
      sessions.push({
        id: file.slice(0, -'.jsonl'.length),
        cwd: where.cwd,
        name: where.name,
        exists,
        title: extractTitle(await readHead(path)) ?? '(untitled)',
        mtimeMs,
      })
    }
  }

  return sessions.sort((a, b) => b.mtimeMs - a.mtimeMs)
}
