import chalk from './chalk'

const write = (s = '') => process.stderr.write(`${s}\n`)

// Plain line to stderr (human output; stdout is reserved for the cd path).
export const say = (s = '') => write(s)

export function printError(message: string) {
  write(chalk.red(`  ✖  ${message}`))
}

export function printSuccess(message: string) {
  write(chalk.green(`  ✓  ${message}`))
}

export function printWarning(message: string) {
  write(chalk.yellow(`  ⚠  ${message}`))
}

export function printInfo(message: string) {
  write(chalk.dim(`  ${message}`))
}

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

// Animated status line on stderr while slow work runs. A no-op off a terminal,
// so piped output and tests stay clean. stop() erases the line; call it before
// printing anything else.
export function spinner(text: string): {
  update: (text: string) => void
  stop: () => void
} {
  const tty = process.stderr
  if (!tty.isTTY) return {update: () => {}, stop: () => {}}

  let frame = 0
  const draw = () =>
    tty.write(`\r\x1b[K  ${chalk.cyan(FRAMES[frame])} ${chalk.dim(text)}`)
  const showCursor = () => tty.write('\x1b[?25h')

  tty.write('\x1b[?25l')
  process.once('exit', showCursor)
  draw()
  const timer = setInterval(() => {
    frame = (frame + 1) % FRAMES.length
    draw()
  }, 80)

  return {
    update(next) {
      text = next
      draw()
    },
    stop() {
      clearInterval(timer)
      tty.write('\r\x1b[K')
      showCursor()
      process.removeListener('exit', showCursor)
    },
  }
}
