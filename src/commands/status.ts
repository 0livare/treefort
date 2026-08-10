import {homedir} from 'node:os'
import {relative} from 'node:path'
import chalk from '../chalk'
import {
  aheadBehind,
  claudeWorktreeName,
  currentWorktree,
  headCommit,
  listWorktrees,
  upstreamRef,
  worktreeName,
  worktreeStatus,
} from '../git'
import {printWarning, say} from '../helpers'

// Abbreviate an absolute path under $HOME to `~/…`, leaving others untouched.
function tilde(p: string): string {
  const home = homedir()
  return p === home || p.startsWith(`${home}/`) ? `~${p.slice(home.length)}` : p
}

// Right-align a two-column table to the widest label plus a 3-space gutter.
function table(rows: [string, string][]) {
  const col = Math.max(...rows.map(([label]) => label.length))
  for (const [label, value] of rows) {
    say(`  ${chalk.dim(label.padStart(col))}   ${value}`)
  }
}

// `wt status`: everything about the worktree the cwd is in — its name, branch
// (with upstream drift), HEAD, working-tree state, and where it sits on disk —
// plus a one-line footer placing it among the repo's other worktrees. Pure
// read: all output goes to stderr, nothing to stdout, so the shell stays put.
export async function status() {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    printWarning('not a git repository')
    process.exit(1)
  }

  const current = await currentWorktree()
  const wt = worktrees.find((w) => w.path === current)
  if (!wt) {
    printWarning('not inside a worktree')
    process.exit(1)
  }

  const [statusLines, ab, upstream, head] = await Promise.all([
    worktreeStatus(wt.path),
    wt.branch ? aheadBehind(wt.path) : Promise.resolve(null),
    wt.branch ? upstreamRef(wt.path) : Promise.resolve(null),
    headCommit(wt.path),
  ])

  const root = worktrees[0].path
  const name = worktreeName(wt)
  const nameCell =
    chalk.bold(name) +
    (claudeWorktreeName(root, wt.path) !== null
      ? `  ${chalk.blue('◆ claude')}`
      : '')

  const drift =
    ab && (ab.ahead || ab.behind)
      ? '  ' +
        [
          ab.ahead ? chalk.green(`↑${ab.ahead}`) : '',
          ab.behind ? chalk.red(`↓${ab.behind}`) : '',
        ]
          .filter(Boolean)
          .join(' ')
      : ''
  const trackCell = upstream ? chalk.dim(` → ${upstream}`) : ''
  const branchCell = wt.branch
    ? chalk.green(wt.branch) + trackCell + drift
    : chalk.yellow(`detached @ ${wt.head.slice(0, 7)}`)

  // cwd may be a subdirectory of the worktree; show the worktree path and note
  // how deep the cwd sits within it when it isn't the top level.
  const sub = relative(wt.path, process.cwd())
  const dirCell = tilde(wt.path) + (sub ? chalk.dim(`  (in ./${sub})`) : '')

  const headCell = head
    ? `${chalk.yellow(head.hash)} ${head.subject}`
    : chalk.dim('(no commits yet)')

  const changed = statusLines ? statusLines.split('\n').length : 0
  const changesCell =
    changed === 0
      ? chalk.green('clean')
      : chalk.yellow(`${changed} file${changed === 1 ? '' : 's'} changed`)

  say()
  table([
    ['worktree', nameCell],
    ['branch', branchCell],
    ['directory', dirCell],
    ['head', headCell],
    ['changes', changesCell],
  ])

  const total = worktrees.length
  say()
  say(
    chalk.dim(
      `  ${total} worktree${total === 1 ? '' : 's'} · root ${tilde(root)}`,
    ),
  )
  say()
}
