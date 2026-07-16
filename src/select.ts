import chalk from './chalk'

const tty = process.stderr

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

  let cursor = opts.initialIndex ?? 0
  if (cursor < 0 || cursor >= items.length) cursor = 0

  const totalLines = header.length + items.length + 2 // + blank + hint

  const render = (first = false) => {
    if (!first) tty.write(`\x1b[${totalLines}A\x1b[J`)

    for (const line of header) tty.write(line + '\n')

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

  tty.write('\x1b[?25l') // hide cursor
  render(true)

  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  return new Promise((resolve) => {
    const cleanup = () => {
      process.stdin.removeListener('data', onKey)
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

    process.stdin.on('data', onKey)
  })
}

// Raw-mode yes/no prompt on stderr. Enter takes the default; esc/ctrl-c = no.
export async function confirm(
  question: string,
  defaultYes = false,
): Promise<boolean> {
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
      tty.write((result ? chalk.green('yes') : chalk.dim('no')) + '\n')
      resolve(result)
    }

    process.stdin.on('data', onKey)
  })
}
