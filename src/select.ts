import chalk from './chalk'
import {printError} from './helpers'

const tty = process.stderr

// True when stdin can host a raw-mode prompt (i.e. we're on a terminal).
export const isInteractive = () => process.stdin.isTTY === true

// Split a raw input chunk into individual key sequences, so batched arrow
// presses (e.g. '\x1b[B\x1b[B' arriving in one chunk) are all handled.
function splitKeys(chunk: string): string[] {
  const keys: string[] = []
  for (let i = 0; i < chunk.length; i++) {
    if (chunk[i] === '\x1b' && chunk[i + 1] === '[') {
      let end = i + 2
      while (end < chunk.length && !/[@-~]/.test(chunk[end])) end++
      keys.push(chunk.slice(i, end + 1))
      i = end
    } else {
      keys.push(chunk[i])
    }
  }
  return keys
}

// Leave the terminal usable if we die mid-prompt (cursor shown, raw mode off).
const restoreTerminal = () => {
  if (process.stdin.isTTY) process.stdin.setRawMode(false)
  tty.write('\x1b[?25h')
}

export type SelectOptions<T> = {
  items: T[]
  label: (item: T) => string
  header?: string[] // full lines rendered above the list (caller styles them)
  hint?: string
  initialIndex?: number
  emptyMessage?: string
}

// Raw-mode arrow-key list picker. Renders to stderr so it works even when the
// zsh wrapper is capturing stdout via $(). Returns the chosen item, or null on
// cancel / empty list.
export async function select<T>(opts: SelectOptions<T>): Promise<T | null> {
  const {items, label} = opts
  const header = opts.header ?? []
  const hint = opts.hint ?? '↑↓  navigate   ⏎  confirm   esc  cancel'

  if (items.length === 0) {
    tty.write(chalk.yellow(`  ${opts.emptyMessage ?? 'Nothing to select'}\n`))
    return null
  }

  if (!isInteractive()) {
    printError('interactive picker requires a terminal')
    process.exit(1)
  }

  let cursor = opts.initialIndex ?? 0
  if (cursor < 0 || cursor >= items.length) cursor = 0

  const totalLines = header.length + items.length + 2 // + blank + hint

  const render = (first = false) => {
    if (!first) tty.write(`\x1b[${totalLines}A\x1b[J`)

    for (const line of header) tty.write(`${line}\n`)

    for (let i = 0; i < items.length; i++) {
      const text = label(items[i])
      if (i === cursor) {
        tty.write(chalk.cyan(`  ❯  ${chalk.bold(text)}\n`))
      } else {
        tty.write(`     ${chalk.dim(text)}\n`)
      }
    }

    tty.write('\n')
    tty.write(chalk.dim(`  ${hint}\n`))
  }

  process.on('exit', restoreTerminal)
  tty.write('\x1b[?25l') // hide cursor
  render(true)

  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  return new Promise((resolve) => {
    let done = false

    const cleanup = () => {
      done = true
      process.stdin.removeListener('data', onData)
      process.removeListener('exit', restoreTerminal)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      tty.write(`\x1b[${totalLines}A\x1b[J`)
      tty.write('\x1b[?25h') // show cursor
    }

    const onKey = (key: string) => {
      switch (key) {
        case '\x1b[A': // up arrow
        case 'k':
          cursor = (cursor - 1 + items.length) % items.length
          render()
          break
        case '\x1b[B': // down arrow
        case 'j':
          cursor = (cursor + 1) % items.length
          render()
          break
        case '\r': // enter
          cleanup()
          resolve(items[cursor])
          break
        case '\x03': // ctrl+c
        case '\x1b': // esc
        case 'q':
          cleanup()
          resolve(null)
          break
      }
    }

    const onData = (chunk: string) => {
      for (const key of splitKeys(chunk)) {
        if (done) return
        onKey(key)
      }
    }

    process.stdin.on('data', onData)
  })
}

// Raw-mode yes/no prompt on stderr. Enter takes the default; esc/ctrl-c = no.
export async function confirm(
  question: string,
  defaultYes = false,
): Promise<boolean> {
  // Callers should pre-check isInteractive() to give a better error; this is
  // just a backstop so we never crash calling setRawMode off a terminal.
  if (!isInteractive()) return false

  const hint = defaultYes ? 'Y/n' : 'y/N'
  tty.write(chalk.bold(`  ${question}`) + chalk.dim(` [${hint}] `))

  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  return new Promise((resolve) => {
    const onKey = (key: string) => {
      let result: boolean | null = null
      if (key === 'y' || key === 'Y') result = true
      else if (key === 'n' || key === 'N') result = false
      else if (key === '\r') result = defaultYes
      else if (key === '\x03' || key === '\x1b') result = false
      if (result === null) return

      process.stdin.removeListener('data', onKey)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      tty.write(`${result ? chalk.green('yes') : chalk.dim('no')}\n`)
      resolve(result)
    }

    process.stdin.on('data', onKey)
  })
}
