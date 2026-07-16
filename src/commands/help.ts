import chalk from '../chalk'
import {say} from '../helpers'
import pkg from '../../package.json'

const wt = chalk.bold.green('wt')
const c = (s: string) => chalk.cyan(s)

export function help() {
  say()
  say(pkg.description)
  say()

  say(
    `${chalk.bold('Usage:')} ${wt} ${c('[command]')} ${c('[args]')} ${c('[flags]')}`,
  )

  say()
  say(chalk.bold('Commands:'))
  say(`  ${wt}                             Interactive worktree switcher (cd)`)
  say(
    `  ${wt} ${c('add')} ${c('[name] [start-point]')}    Add a worktree and cd into it`,
  )
  say(
    `  ${wt} ${c('rm')} ${c('[name]')}                   Remove a worktree (deletes in background)`,
  )
  say(
    `  ${wt} ${c('list')}${chalk.dim(', ')}${c('ls')}                  List all worktrees`,
  )
  say(
    `  ${wt} ${c('exec')} ${c('<name>')} ${c('--')} ${c('<cmd>')}       Run a command in a worktree`,
  )
  say(
    `  ${wt} ${c('install')}                     Set up the shell wrapper + git excludes`,
  )
  say(
    `  ${wt} ${c('shell-init')}                  Print the zsh wrapper function`,
  )

  say()
  say(chalk.bold('Examples:'))
  say(
    `  ${wt} ${c('add')} ${c('feature-x')}               New branch feature-x off HEAD, cd in`,
  )
  say(
    `  ${wt} ${c('add')} ${c('feature-x origin/main')}   New branch off origin/main`,
  )
  say(
    `  ${wt} ${c('add')}                         Move current branch into its own worktree`,
  )
  say(
    `  ${wt} ${c('rm')} ${c('feature-x')} ${c('-d')}             Remove worktree and its branch`,
  )

  say()
  say(chalk.bold('Flags:'))
  say(
    `  ${c('-f')}, ${c('--force')}                     Skip the dirty-worktree / checkout guard`,
  )
  say(
    `  ${c('-d')}, ${c('--delete-branch')}             Also delete the branch (if safely pushed)`,
  )
  say(`  ${c('-v')}, ${c('--version')}                   Print version number`)
  say(
    `  ${c('-h')}, ${c('--help')}                      Print help information`,
  )

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
