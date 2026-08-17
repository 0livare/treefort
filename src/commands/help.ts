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

// `wt claude` forwards flags rather than parsing them, so -h/--help would go
// to Claude like anything else. It's carved out to print this instead — the
// forwarding rules are exactly what someone reaching for it wants explained.
// `wt claude -- --help` is the way through to Claude's own help.
export function claudeHelp() {
  say()
  say(
    `${chalk.bold('Usage:')} ${wt} ${c('claude')} ${c('[name]')} ${c('[claude-flags]')}`,
  )
  say()
  say('  Open a Claude Code session in a worktree, without switching to it.')
  say('  With no name, open the worktree you are in — or pick one (the root')
  say('  included) when run from the root. A name with no worktree yet offers')
  say('  to create it. Outside a git repository it just runs Claude.')

  const rules: [string, string][] = [
    [c('[name]'), 'The first argument that does not start with a hyphen'],
    [c('[claude-flags]'), 'Every other argument, forwarded to Claude as given'],
    [
      `${c('-r')}, ${c('--resume')}`,
      "Pick from every session in the repo (Claude's own list is per-directory)",
    ],
    [c('--'), 'Forward everything after it verbatim, hyphen or not'],
  ]

  const examples: [string, string][] = [
    [`${wt} ${c('claude')} ${c('feature-x')}`, 'Open Claude in feature-x'],
    [
      `${wt} ${c('claude')} ${c('feature-x --model opus')}`,
      `Same, with ${c('--model opus')} passed to Claude`,
    ],
    [
      `${wt} ${c('claude')} ${c('--continue feature-x')}`,
      'Flags may come before the name',
    ],
    [
      `${wt} ${c('claude')} ${c('--resume')}`,
      'Resume any session in the repo, whichever worktree it ran in',
    ],
    [
      `${wt} ${c('claude')} ${c('feature-x --resume')}`,
      "Resume one of feature-x's sessions",
    ],
    [
      `${wt} ${c('claude')} ${c("-- -p 'run the tests'")}`,
      'Picker, then forward the prompt verbatim',
    ],
    [
      `${wt} ${c('claude')} ${c('-- --help')}`,
      "Claude's own help, instead of this",
    ],
  ]

  const col = Math.max(...[...rules, ...examples].map(([left]) => width(left)))

  say()
  say(chalk.bold('Arguments:'))
  table(rules, col)

  say()
  say(chalk.bold('Examples:'))
  table(examples, col)
  say()
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
    [
      `${wt} ${c('rename')} ${c('[old] <new>')}`,
      `Rename a worktree and its branch${chalk.dim(' (alias: mv)')}`,
    ],
    [`${wt} ${c('prune')}`, 'Remove all worktrees merged into main'],
    [`${wt} ${c('list')}${chalk.dim(', ')}${c('ls')}`, 'List all worktrees'],
    [
      `${wt} ${c('status')}${chalk.dim(', ')}${c('st')}`,
      'Show the current worktree and its state',
    ],
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
    [
      `${wt} ${c('claude')} ${c('[name] [claude-flags]')}`,
      'Open a Claude Code session in a worktree (current, or picker at root)',
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
      `${wt} ${c('claude')} ${c('feature-x')}`,
      'Open Claude in feature-x, creating it if needed',
    ],
    [
      `${wt} ${c('claude')} ${c('feature-x --model opus')}`,
      'Flags after the name are forwarded to Claude',
    ],
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
      'Keep the branch (skip the delete-branch prompt)',
    ],
    [
      `${c('-D')}, ${c('--force-branch')}`,
      'Delete the branch without asking, even if commits would be lost',
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
