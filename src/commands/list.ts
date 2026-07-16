import chalk from '../chalk'
import {isDirty, listWorktrees, worktreeName} from '../git'
import {printWarning, say} from '../helpers'

export async function list() {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    printWarning('not a git repository')
    process.exit(1)
  }

  const dirty = await Promise.all(worktrees.map((w) => isDirty(w.path)))
  const names = worktrees.map(worktreeName)
  const width = Math.max(...names.map((n) => n.length))

  say()
  worktrees.forEach((w, i) => {
    const marker = w.isCurrent ? chalk.cyan('❯') : ' '
    const name = names[i].padEnd(width)
    const nameStyled = w.isCurrent ? chalk.bold(name) : name
    const branch = w.branch
      ? chalk.dim(w.branch)
      : chalk.dim(`detached @ ${w.head.slice(0, 7)}`)
    const dirtyMark = dirty[i] ? `   ${chalk.yellow('● dirty')}` : ''
    say(`  ${marker} ${nameStyled}   ${branch}${dirtyMark}`)
  })
  say()
}
