import pkg from '../../package.json'
import chalk from '../chalk'
import {say} from '../helpers'

const wt = chalk.bold.green('wt')
const c = (s: string) => chalk.cyan(s)

// Visible width of a string, ignoring chalk's ANSI color codes — so columns are
// padded by what renders, not by the raw character count. Built from a variable
// so no literal control character appears in the regex source.
const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
const width = (s: string) => s.replace(ansi, '').length

// Render `[left, right]` rows as a two-column table, aligning every right cell
// to `col` (the widest left cell) plus a 4-space gutter. No hand-counted spaces.
function table(rows: [string, string][], col: number) {
  for (const [left, right] of rows) {
    say(`  ${left}${' '.repeat(col - width(left) + 4)}${right}`)
  }
}

export function help() {
  say()
  say(pkg.description)
  say()

  say(
    `${chalk.bold('Usage:')} ${wt} ${c('[command]')} ${c('[args]')} ${c('[flags]')}`,
  )

  const commands: [string, string][] = [
    [wt, 'Interactive worktree switcher (cd)'],
    [
      `${wt} ${c('add')} ${c('[name] [start-point]')}`,
      'Add a worktree and cd into it',
    ],
    [
      `${wt} ${c('rm')} ${c('[name]')}`,
      `Remove a worktree (deletes in background)${chalk.dim(' (alias: remove)')}`,
    ],
    [`${wt} ${c('prune')}`, 'Remove all worktrees merged into main'],
    [`${wt} ${c('list')}${chalk.dim(', ')}${c('ls')}`, 'List all worktrees'],
    [
      `${wt} ${c('cd')} ${c('[name|-]')}`,
      'cd to a worktree (picker if omitted, - = previous)',
    ],
    [`${wt} ${c('root')}`, 'cd back to the root worktree'],
    [
      `${wt} ${c('exec')} ${c('[name --]')} ${c('<cmd>')}`,
      'Run a command in a worktree (root if no target)',
    ],
    [
      `${wt} ${c('ff')} ${c('[name]')}`,
      'Fast-forward a worktree from its upstream (root if omitted)',
    ],
    [`${wt} ${c('install')}`, 'Set up the shell wrapper + git excludes'],
    [
      `${wt} ${c('shell-init')} ${c('[shell]')}`,
      'Print the shell wrapper (zsh or bash)',
    ],
  ]

  const examples: [string, string][] = [
    [
      `${wt} ${c('add')} ${c('feature-x')}`,
      'New branch off the root worktree, cd in',
    ],
    [
      `${wt} ${c('add')} ${c('feature-x origin/main')}`,
      'New branch off origin/main',
    ],
    [
      `${wt} ${c('add')} ${c('feature-x .')}`,
      'New branch off the current worktree',
    ],
    [`${wt} ${c('add')}`, 'Move current branch into its own worktree'],
    [
      `${wt} ${c('rm')} ${c('feature-x')} ${c('-k')}`,
      'Remove worktree but keep its branch',
    ],
    [
      `${wt} ${c('feature-x')}`,
      `Shorthand for ${wt} ${c('cd')} ${c('feature-x')}`,
    ],
    [
      `${wt} ${c('-')}`,
      `Shorthand for ${wt} ${c('cd')} ${c('-')} (previous worktree)`,
    ],
  ]

  const flags: [string, string][] = [
    [`${c('-f')}, ${c('--force')}`, 'Skip the dirty-worktree / checkout guard'],
    [
      `${c('-k')}, ${c('--keep-branch')}`,
      'Keep the branch (rm deletes it when safe)',
    ],
    [
      `${c('-D')}, ${c('--force-branch')}`,
      'Delete the branch even if commits would be lost',
    ],
    [`${c('-v')}, ${c('--version')}`, 'Print version number'],
    [`${c('-h')}, ${c('--help')}`, 'Print help information'],
  ]

  // One shared column across all three sections so every description lines up.
  const col = Math.max(
    ...[...commands, ...examples, ...flags].map(([left]) => width(left)),
  )

  say()
  say(chalk.bold('Commands:'))
  table(commands, col)

  say()
  say(chalk.bold('Examples:'))
  table(examples, col)

  say()
  say(chalk.bold('Flags:'))
  table(flags, col)

  say()
  say(chalk.bold('Setup:'))
  say(
    chalk.dim(
      '  Run once so `wt` can cd your shell and ignore worktrees globally:',
    ),
  )
  say()
  say(`  ${wt} ${c('install')}`)
  say()
}
