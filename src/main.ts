#!/usr/bin/env bun
import {parseCliArgs} from './cli'
import {
  help,
  version,
  add,
  remove,
  list,
  switchWorktree,
  exec,
  install,
  shellInit,
  complete,
} from './commands'
import {printError} from './helpers'

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

  switch (command) {
    case undefined:
      // Bare `wt`: interactive switcher.
      await switchWorktree()
      break
    case 'add':
      await add(rest[0], rest[1], {force: cli.values.force})
      break
    case 'rm':
    case 'remove':
      await remove(rest[0], {
        force: cli.values.force,
        deleteBranch: cli.values['delete-branch'],
      })
      break
    case 'list':
    case 'ls':
      await list()
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
      printError(`unknown command: ${command}`)
      help()
      process.exit(1)
  }
}

await main()
