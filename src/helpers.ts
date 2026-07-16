import chalk from './chalk'

const write = (s = '') => process.stderr.write(s + '\n')

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
