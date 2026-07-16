import {homedir} from 'node:os'
import {join} from 'node:path'
import {say, printSuccess, printInfo} from '../helpers'
import {globalExcludesFile, setGlobalExcludesFile} from '../git'

const EVAL_LINE = 'eval "$(command wt shell-init)"'

export async function install() {
  say()
  await installShell()
  await installGitExcludes()
  say()
}

async function installShell() {
  const zshrc = join(homedir(), '.zshrc')
  const file = Bun.file(zshrc)
  const existing = (await file.exists()) ? await file.text() : ''

  if (existing.includes(EVAL_LINE)) {
    printInfo('~/.zshrc already sources the wt shell function')
    return
  }

  const sep = existing === '' || existing.endsWith('\n') ? '' : '\n'
  const block = `${sep}\n# git-worktree-cli shell wrapper (cd-on-add support)\n${EVAL_LINE}\n`
  await Bun.write(zshrc, existing + block)
  printSuccess('added the wt shell function to ~/.zshrc')
  printInfo('run `source ~/.zshrc` or open a new shell to activate it')
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

  if (lines.includes('.wkt/') || lines.includes('.wkt')) {
    printInfo(`${excludes} already ignores .wkt/`)
    return
  }

  const sep = existing === '' || existing.endsWith('\n') ? '' : '\n'
  await Bun.write(resolved, existing + `${sep}.wkt/\n`)
  printSuccess(`added .wkt/ to ${excludes}`)
}
