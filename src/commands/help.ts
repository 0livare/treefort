import pkg from '../../package.json'
import chalk from '../chalk'
import {say} from '../helpers'

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
    `  ${wt} ${c('prune')}                       Remove all worktrees merged into main`,
  )
  say(
    `  ${wt} ${c('list')}${chalk.dim(', ')}${c('ls')}                  List all worktrees`,
  )
  say(
    `  ${wt} ${c('cd')} ${c('[name|-]')}                 cd to a worktree (picker if omitted, - = previous)`,
  )
  say(
    `  ${wt} ${c('root')}                        cd back to the root worktree`,
  )
  say(
    `  ${wt} ${c('exec')} ${c('[name --]')} ${c('<cmd>')}       Run a command in a worktree (root if no target)`,
  )
  say(
    `  ${wt} ${c('ff')} ${c('[name]')}                   Fast-forward a worktree from its upstream (root if omitted)`,
  )
  say(
    `  ${wt} ${c('install')}                     Set up the shell wrapper + git excludes`,
  )
  say(
    `  ${wt} ${c('shell-init')} ${c('[shell]')}          Print the shell wrapper (zsh or bash)`,
  )

  say()
  say(chalk.bold('Examples:'))
  say(
    `  ${wt} ${c('add')} ${c('feature-x')}               New branch off the root worktree, cd in`,
  )
  say(
    `  ${wt} ${c('add')} ${c('feature-x origin/main')}   New branch off origin/main`,
  )
  say(
    `  ${wt} ${c('add')} ${c('feature-x .')}             New branch off the current worktree`,
  )
  say(
    `  ${wt} ${c('add')}                         Move current branch into its own worktree`,
  )
  say(
    `  ${wt} ${c('rm')} ${c('feature-x')} ${c('-k')}             Remove worktree but keep its branch`,
  )
  say(
    `  ${wt} ${c('feature-x')}                    Shorthand for ${wt} ${c('cd')} ${c('feature-x')}`,
  )
  say(
    `  ${wt} ${c('-')}                            Shorthand for ${wt} ${c('cd')} ${c('-')} (previous worktree)`,
  )

  say()
  say(chalk.bold('Flags:'))
  say(
    `  ${c('-f')}, ${c('--force')}                     Skip the dirty-worktree / checkout guard`,
  )
  say(
    `  ${c('-k')}, ${c('--keep-branch')}               Keep the branch (rm deletes it when safe)`,
  )
  say(
    `  ${c('-D')}, ${c('--force-branch')}              Delete the branch even if commits would be lost`,
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
