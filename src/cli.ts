import {parseArgs} from 'node:util'
import {printError} from './helpers'

export function parseCliArgs() {
  try {
    const {values, positionals} = parseArgs({
      args: process.argv.slice(2),
      options: {
        force: {type: 'boolean', short: 'f'},
        'keep-branch': {type: 'boolean', short: 'k'},
        'force-branch': {type: 'boolean', short: 'D'},
        help: {type: 'boolean', short: 'h'},
        version: {type: 'boolean', short: 'v'},
      },
      strict: true,
      allowPositionals: true,
    })
    return {values, positionals}
  } catch (e) {
    printError(e instanceof Error ? e.message : String(e))
    process.exit(1)
  }
}
