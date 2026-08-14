import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {rank, recordAccess} from '../frecency'
import {
  CLAUDE_WORKTREE_DIR,
  claudeWorktreeName,
  listWorktrees,
  type Worktree,
  worktreeName,
} from '../git'
import {printError, printInfo, printWarning} from '../helpers'
import {confirm, isInteractive} from '../select'
import {pickWorktree} from '../worktree-picker'
import {offerToCreate, resolveWorktree} from './cd'

// Open a Claude Code session in a worktree, without switching to it.
//
// Claude addresses worktrees by name under .claude/worktrees, and only folds a
// worktree's sessions into the repo's `claude --resume` list when it lives
// there. Worktrees outside that directory still open — just in place, with a
// warning that their history won't be unified. Creating .claude/worktrees up
// front is what makes `wt add` put new worktrees somewhere Claude can address.
//
// `forward` is everything the caller didn't claim as the target — Claude's own
// flags, appended to the argv wt builds.
export async function claude(target?: string, forward: string[] = []) {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    printError('not a git repository')
    process.exit(1)
  }
  const root = worktrees[0].path

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
  if (name === null) {
    const w = worktrees.find((x) => x.path === dest)
    printWarning(
      `${w ? worktreeName(w) : dest} isn't under ${CLAUDE_WORKTREE_DIR}/ — this session's history stays in that worktree instead of joining the repo's \`claude --resume\` list`,
    )
    // Without a terminal there's nobody to ask, and opening is the default —
    // so only ask when we can, rather than silently bailing on scripts.
    if (isInteractive() && !(await confirm('open Claude anyway?', true))) {
      process.exit(0)
    }
  }

  // add() already recorded the access when it created the worktree.
  if (!created) await recordAccess(root, dest)

  // A managed worktree is opened by name from the root, so Claude resolves it
  // against the main repo and folds its sessions into the repo's history.
  // Anything else is opened in place: passing its name to --worktree would
  // create a second worktree on a different branch rather than open this one.
  // Forwarded flags go last so an explicit one wins over wt's own.
  const [base, cwd]: [string[], string] =
    name === null ? [['claude'], dest] : [['claude', '--worktree', name], root]
  const command = [...base, ...forward]

  // stdio is inherited: this command's stdout is Claude's, not a cd path.
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

// Picker over the linked worktrees, ordered by frecency. Worktrees Claude can
// address by name are marked, so the ones whose session history won't be
// unified are visible before you pick rather than after.
async function pick(
  worktrees: Worktree[],
  root: string,
): Promise<string | null> {
  const pickable = worktrees.filter((w) => !w.isMain && !w.isBare)
  if (pickable.length === 0) {
    printInfo('no worktrees — run `wt claude <name>` to create one')
    return null
  }

  const managed = new Set(
    pickable
      .filter((w) => claudeWorktreeName(root, w.path) !== null)
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
