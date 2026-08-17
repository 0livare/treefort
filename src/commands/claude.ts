import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import chalk from '../chalk'
import {type ClaudeSession, listSessions, timeAgo} from '../claude-sessions'
import {rank, recordAccess} from '../frecency'
import {
  CLAUDE_WORKTREE_DIR,
  claudeWorktreeName,
  listWorktrees,
  type Worktree,
  worktreeName,
} from '../git'
import {printError, printInfo, printWarning} from '../helpers'
import {confirm, isInteractive, select} from '../select'
import {pickWorktree} from '../worktree-picker'
import {offerToCreate, resolveWorktree} from './cd'

// Open a Claude Code session in a worktree, without switching to it.
//
// Claude always launches from the repo root, so every session folds into the
// repo's `claude --resume` list. A worktree under .claude/worktrees is reopened
// there by name (via `claude --worktree`); the root opens itself. A worktree
// outside that directory can't be addressed from the root, so it still runs —
// but with a warning that we're opening the repo root in its place. Creating
// .claude/worktrees up front is what makes `wt add` put new worktrees somewhere
// Claude can address.
//
// `forward` is everything the caller didn't claim as the target — Claude's own
// flags, appended to the argv wt builds. `resume` opens wt's own session
// picker (aggregated across the whole repo) instead of launching a session.
export async function claude(
  target?: string,
  forward: string[] = [],
  opts: {resume?: boolean} = {},
) {
  const worktrees = await listWorktrees()
  // Outside a git repo there's no worktree to address, so behave like a plain
  // `claude` in the current directory — forwarding whatever was passed, the
  // bare word wt would otherwise treat as a worktree name included.
  if (worktrees.length === 0) {
    const args = target === undefined ? forward : [target, ...forward]
    if (opts.resume) args.unshift('--resume')
    return runClaude(['claude', ...args], process.cwd())
  }
  const root = worktrees[0].path

  if (opts.resume) return resume(root, worktrees, target, forward)

  await mkdir(join(root, CLAUDE_WORKTREE_DIR), {recursive: true})

  let created = false
  const dest =
    target !== undefined
      ? await resolveWorktree({
          target,
          worktrees,
          root,
          onNoMatch: async () => {
            const path = await offerToCreate(target)
            created = path !== null
            return path
          },
        })
      : await currentOrPick(worktrees, root)
  if (dest === null) return // picker cancelled, or create declined

  const name = claudeWorktreeName(root, dest)
  // Claude always launches from the root, where only a worktree under
  // .claude/worktrees can be reopened by name. The root itself is fine — it's
  // what we'd open anyway — but any other worktree can't be addressed, so warn
  // that we'll open the repo root in its place before doing so.
  if (name === null && dest !== root) {
    const w = worktrees.find((x) => x.path === dest)
    printWarning(
      `${w ? worktreeName(w) : dest} isn't under ${CLAUDE_WORKTREE_DIR}/, so Claude can't reopen it from the root — opening the repo root instead`,
    )
    // Without a terminal there's nobody to ask, and opening is the default —
    // so only ask when we can, rather than silently bailing on scripts.
    if (
      isInteractive() &&
      !(await confirm('open Claude at the root instead?', true))
    ) {
      process.exit(0)
    }
  }

  // add() already recorded the access when it created the worktree.
  if (!created) await recordAccess(root, dest)

  // Always launched from the repo root, so Claude resolves the session against
  // the main repo and folds it into the repo's history. A managed worktree is
  // still addressed by name via --worktree; the root (and any worktree that
  // can't be addressed) just opens the root itself. Forwarded flags go last so
  // an explicit one wins over wt's own.
  const base = name === null ? ['claude'] : ['claude', '--worktree', name]
  return runClaude([...base, ...forward], root)
}

// Hand off to Claude with inherited stdio — its stdout is the session's, not a
// cd path for the shell wrapper — and exit with its status. Never returns.
async function runClaude(command: string[], cwd: string): Promise<never> {
  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn(command, {
      cwd,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    })
  } catch {
    printError('command not found: claude')
    process.exit(127)
  }
  process.exit(await proc.exited)
}

// `wt claude --resume`: pick from every session the repo has, regardless of
// worktree. Claude keys sessions by the directory they ran in and its own
// picker defaults to that one directory's list, so worktree sessions are
// invisible from the root; this aggregates them all. The chosen session is
// resumed from its own directory (so it behaves exactly like a local
// `claude --resume` there) — or from the root when that directory is gone,
// which newer Claude versions resolve across projects.
async function resume(
  root: string,
  worktrees: Worktree[],
  target: string | undefined,
  forward: string[],
): Promise<void> {
  let sessions = await listSessions(root, worktrees)
  if (sessions.length === 0) {
    printInfo('no Claude sessions found for this repo')
    return
  }
  // A bare word alongside --resume scopes the list to that worktree.
  if (target !== undefined) {
    sessions = sessions.filter((s) => s.name === target)
    if (sessions.length === 0) {
      printError(`no Claude sessions found for '${target}'`)
      process.exit(1)
    }
  }
  // One candidate needs no picker — resume it straight away, which also lets
  // scripts resume a worktree's only session without a terminal.
  const chosen =
    sessions.length === 1 ? sessions[0] : await pickSession(sessions)
  if (chosen === null) return
  return runClaude(
    ['claude', '--resume', chosen.id, ...forward],
    chosen.exists ? chosen.cwd : root,
  )
}

async function pickSession(
  sessions: ClaudeSession[],
): Promise<ClaudeSession | null> {
  const width = Math.max(
    ...sessions.map((s) => s.name.length),
    'WORKTREE'.length,
  )
  const ages = new Map(sessions.map((s) => [s.id, timeAgo(s.mtimeMs)]))
  const ageWidth = Math.max(...[...ages.values()].map((a) => a.length), 3)
  return select<ClaudeSession>({
    items: sessions,
    header: [
      chalk.bold('  Resume Claude session'),
      '',
      chalk.dim(
        `     ${'WORKTREE'.padEnd(width)}   ${'AGE'.padEnd(ageWidth)}   TITLE`,
      ),
    ],
    label: (s) =>
      `${s.name.padEnd(width)}   ${(ages.get(s.id) ?? '').padEnd(ageWidth)}   ${s.title}`,
  })
}

// With no explicit target, `wt claude` acts on the worktree you're standing in:
// run from inside a linked worktree it opens that one straight away, the same
// "here" default the other commands lean on. Only from the root worktree —
// where there's no single obvious choice — does it fall through to the picker.
async function currentOrPick(
  worktrees: Worktree[],
  root: string,
): Promise<string | null> {
  const current = worktrees.find((w) => w.isCurrent)
  if (current && !current.isMain && !current.isBare) return current.path
  return pick(worktrees, root)
}

// Picker over the worktrees, ordered by frecency, the root included so a
// session can be opened in the repo itself. Worktrees whose sessions join the
// repo's history are marked, so the ones that would strand it stand out before
// you pick rather than after. A bare root is left out — there's no working tree
// there to open Claude in.
async function pick(
  worktrees: Worktree[],
  root: string,
): Promise<string | null> {
  const pickable = worktrees.filter((w) => !w.isBare)
  if (pickable.length === 0) {
    printInfo('no worktrees — run `wt claude <name>` to create one')
    return null
  }

  const managed = new Set(
    pickable
      .filter((w) => w.isMain || claudeWorktreeName(root, w.path) !== null)
      .map((w) => w.path),
  )
  const chosen = await pickWorktree(await rank(root, pickable), {
    title: 'Open Claude in worktree',
    // Only worth showing while the repo holds both kinds. Once everything
    // lives under .claude/worktrees the marker would be on every row.
    managed: managed.size < pickable.length ? managed : undefined,
  })
  return chosen?.path ?? null
}
