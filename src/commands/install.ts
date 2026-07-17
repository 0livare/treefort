import {homedir} from 'node:os'
import {basename, join} from 'node:path'
import {globalExcludesFile, setGlobalExcludesFile, WORKTREE_DIR} from '../git'
import {printInfo, printSuccess, printWarning, say} from '../helpers'

// The shell name is baked into the line so the emitted wrapper/completion
// always matches the file it lives in, whatever $SHELL says later.
const evalLine = (shell: string) => `eval "$(command wt shell-init ${shell})"`

const RC_FILES: Record<string, string> = {
  zsh: '.zshrc',
  bash: '.bashrc',
}

export async function install() {
  say()
  await installShell()
  await installGitExcludes()
  say()
}

async function installShell() {
  const shell = basename(process.env.SHELL ?? '')
  const rcName = RC_FILES[shell]
  if (!rcName) {
    printWarning(
      `no automatic setup for your shell (${shell || 'unknown'}) — zsh and bash are supported`,
    )
    printInfo(`add the equivalent of this to your shell config manually:`)
    printInfo(`  ${evalLine('zsh')}`)
    return
  }

  const rc = join(homedir(), rcName)
  const file = Bun.file(rc)
  const existing = (await file.exists()) ? await file.text() : ''

  // Matches both the current line and the older argument-less form.
  if (existing.includes('command wt shell-init')) {
    printInfo(`~/${rcName} already sources the wt shell function`)
    return
  }

  const sep = existing === '' || existing.endsWith('\n') ? '' : '\n'
  const block = `${sep}\n# treefort (wt) shell wrapper (cd-on-add support)\n${evalLine(shell)}\n`
  await Bun.write(rc, existing + block)
  printSuccess(`added the wt shell function to ~/${rcName}`)
  printInfo(`run \`source ~/${rcName}\` or open a new shell to activate it`)
}

async function installGitExcludes() {
  let excludes = await globalExcludesFile()
  if (!excludes) {
    excludes = join(homedir(), '.gitignore_global')
    await setGlobalExcludesFile(excludes)
    printSuccess(`set git core.excludesfile to ${excludes}`)
  }

  const resolved = excludes.replace(/^~(?=$|\/)/, homedir())
  const file = Bun.file(resolved)
  const existing = (await file.exists()) ? await file.text() : ''
  const lines = existing.split('\n').map((l) => l.trim())

  const ignore = `${WORKTREE_DIR}/`
  if (lines.includes(ignore) || lines.includes(WORKTREE_DIR)) {
    printInfo(`${excludes} already ignores ${ignore}`)
    return
  }

  const sep = existing === '' || existing.endsWith('\n') ? '' : '\n'
  await Bun.write(resolved, `${existing}${sep}${ignore}\n`)
  printSuccess(`added ${ignore} to ${excludes}`)
}
