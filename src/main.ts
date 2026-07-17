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
      // Explicit `wt cd [target]`; no target opens the picker.
      await cd(rest[0])
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
      // cd is the default command: bare `wt` (picker), `wt <name>`, `wt -`,
      // `wt @`, and `wt root` all resolve through the same cd path.
      await cd(command)
      break
  }
}

await main()
