#!/usr/bin/env bun
import {parseCliArgs} from './cli'
import {
  add,
  cd,
  complete,
  exec,
  help,
  install,
  list,
  prune,
  remove,
  shellInit,
  switchWorktree,
  version,
} from './commands'

async function main() {
  const cli = parseCliArgs()

  if (cli.values.help) {
    help()
    process.exit(0)
  }

  if (cli.values.version) {
    version()
    process.exit(0)
  }

  const [command, ...rest] = cli.positionals

  // Bare `wt`: interactive switcher.
  if (command === undefined) {
    await switchWorktree()
    return
  }

  switch (command) {
    case 'add':
      await add(rest[0], rest[1], {force: cli.values.force})
      break
    case 'rm':
    case 'remove':
      await remove(rest[0], {
        force: cli.values.force,
        keepBranch: cli.values['keep-branch'],
        forceBranch: cli.values['force-branch'],
      })
      break
    case 'list':
    case 'ls':
      await list()
      break
    case 'prune':
      await prune({force: cli.values.force})
      break
    case 'cd':
      // No target behaves like bare `wt` (interactive picker).
      if (rest[0] === undefined) await switchWorktree()
      else await cd(rest[0])
      break
    case 'root':
      await cd('@')
      break
    case 'exec':
      await exec(rest[0], rest.slice(1))
      break
    case 'install':
      await install()
      break
    case 'shell-init':
      shellInit()
      break
    case '__complete':
      await complete(rest[0])
      break
    default:
      // `wt <name>` is shorthand for `wt cd <name>` (like `pnpm <script>`).
      await cd(command)
      break
  }
}

await main()
