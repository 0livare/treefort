import chalk from '../chalk'
import {claudeWorktreeName, isDirty, listWorktrees, worktreeName} from '../git'
import {printWarning, say} from '../helpers'

export async function list() {
  const worktrees = await listWorktrees()
  if (worktrees.length === 0) {
    printWarning('not a git repository')
    process.exit(1)
  }

  const dirty = await Promise.all(worktrees.map((w) => isDirty(w.path)))
  const names = worktrees.map(worktreeName)
  const width = Math.max(...names.map((n) => n.length), 'NAME'.length)

  // Which worktrees `wt claude` can open. Only worth showing while the repo
  // holds both kinds — once every linked worktree lives under
  // .claude/worktrees the marker is on every row and says nothing.
  const root = worktrees[0].path
  const linked = worktrees.filter((w) => !w.isMain)
  const managed = linked.filter(
    (w) => claudeWorktreeName(root, w.path) !== null,
  )
  const showManaged = managed.length > 0 && managed.length < linked.length

  say()
  say(chalk.dim(`    ${'NAME'.padEnd(width)}   BRANCH`))
  worktrees.forEach((w, i) => {
    const marker = w.isCurrent ? chalk.cyan('❯') : ' '
    const name = names[i].padEnd(width)
    const nameStyled = w.isCurrent ? chalk.bold(name) : name
    const branch = w.branch
      ? chalk.dim(w.branch)
      : chalk.dim(w.isBare ? '(bare)' : `detached @ ${w.head.slice(0, 7)}`)
    const claudeMark =
      showManaged && claudeWorktreeName(root, w.path) !== null
        ? `   ${chalk.blue('◆ claude')}`
        : ''
    const dirtyMark = dirty[i] ? `   ${chalk.yellow('● dirty')}` : ''
    say(`  ${marker} ${nameStyled}   ${branch}${claudeMark}${dirtyMark}`)
  })
  say()
}
