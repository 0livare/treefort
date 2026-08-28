#!/usr/bin/env bun
import {parseCliArgs} from './cli'
import {
  add,
  cd,
  claude,
  claudeHelp,
  complete,
  detatch,
  exec,
  ff,
  help,
  install,
  list,
  prune,
  remove,
  rename,
  shellInit,
  status,
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

  // `claude` forwards its own flags to Claude, so it also bypasses parseArgs:
  // the first bare word is the worktree, everything else goes to Claude. A `--`
  // forwards the rest verbatim, for a session whose first bare word is Claude's
  // (`wt claude -- -p "..."`).
  if (raw[0] === 'claude') {
    const args = raw.slice(1)
    const sep = args.indexOf('--')
    const head = sep === -1 ? args : args.slice(0, sep)
    const tail = sep === -1 ? [] : args.slice(sep + 1)

    // Flags wt keeps for itself: `wt claude --help` explains the forwarding
    // rules, and `wt claude --resume` opens wt's session picker — one list for
    // the whole repo, where Claude's own is scoped to a single directory.
    // `wt claude -- --help` / `-- --resume` reach Claude's.
    if (head.includes('-h') || head.includes('--help')) {
      claudeHelp()
      process.exit(0)
    }
    const resume = head.includes('-r') || head.includes('--resume')

    let target: string | undefined
    const forward: string[] = []
    for (const arg of head) {
      if (arg === '-r' || arg === '--resume') continue
      if (target === undefined && !arg.startsWith('-')) target = arg
      else forward.push(arg)
    }
    await claude(target, [...forward, ...tail], {resume})
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
      // The single stdout line: where the shell wrapper should cd.
      process.stdout.write(
        `${await add(rest[0], rest[1], {force: cli.values.force})}\n`,
      )
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
    case 'status':
    case 'st':
      await status()
      break
    case 'rename':
    case 'mv':
      await rename(rest[0], rest[1])
      break
    case 'prune':
      await prune({force: cli.values.force})
      break
    case 'cd':
      // Explicit `wt cd [target]`; no target opens the picker.
      await cd(rest[0])
      break
    case 'ff':
      await ff(rest[0])
      break
    case 'detatch':
      await detatch(rest[0])
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
      shellInit(rest[0])
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
