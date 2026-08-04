import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {stateDir} from './git'

// Repo-scoped "previous worktree" pointer for `wt cd -`, kept in a state file
// inside .git (so git never sees it). Repo-scoped rather than per-shell, but
// it means the toggle works regardless of which shell wrapper version is loaded.
const fileFor = async (root: string) => join(await stateDir(root), 'previous')

export async function getPrevious(root: string): Promise<string | null> {
  const file = Bun.file(await fileFor(root))
  if (!(await file.exists())) return null
  return (await file.text()).trim() || null
}

export async function setPrevious(root: string, path: string): Promise<void> {
  await mkdir(await stateDir(root), {recursive: true})
  await Bun.write(await fileFor(root), `${path}\n`)
}
