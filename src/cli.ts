import {parseArgs} from 'node:util'
import {printError} from './helpers'

export function parseCliArgs() {
  let args
  try {
    args = parseArgs({
      args: process.argv.slice(2),
      options: {
        force: {type: 'boolean', short: 'f'},
        'delete-branch': {type: 'boolean', short: 'd'},
        help: {type: 'boolean', short: 'h'},
        version: {type: 'boolean', short: 'v'},
      },
      strict: true,
      allowPositionals: true,
    })
  } catch (e: any) {
    printError(e.message)
    process.exit(1)
  }

  return {
    values: args.values,
    positionals: args.positionals,
  }
}
