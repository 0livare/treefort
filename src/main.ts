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
import {printError} from './helpers'

async function main() {
  // `exec` forwards an arbitrary command that may contain its own flags, so
  // parse it straight from argv rather than through parseArgs. A `--` separates
  // an optional target from the command; with no `--` the whole tail is the
  // command and it runs in the main (root) worktree.
  const raw = process.argv.slice(2)
  if (raw[0] === 'exec') {
    const args = raw.slice(1)
    const sep = args.indexOf('--')
    const before = sep === -1 ? [] : args.slice(0, sep)
    const command = sep === -1 ? args : args.slice(sep + 1)
    if (before.length > 1) {
      printError('usage: wt exec [target --] <command>')
      process.exit(1)
    }
    await exec(before[0], command)
    return
  }

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
    case 'help':
      help()
      break
    case 'version':
      version()
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

try {
  await main()
} catch (e) {
  printError(e instanceof Error ? e.message : String(e))
  process.exit(1)
}
