import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'

// Repo-scoped "previous worktree" pointer for `wt cd -`, kept in a state file
// under .wkt/ (gitignored). Repo-scoped rather than per-shell, but it means the
// toggle works regardless of which version of the shell wrapper is loaded.
const fileFor = (root: string) => join(root, '.wkt', '.previous')

export async function getPrevious(root: string): Promise<string | null> {
  const file = Bun.file(fileFor(root))
  if (!(await file.exists())) return null
  return (await file.text()).trim() || null
}

export async function setPrevious(root: string, path: string): Promise<void> {
  await mkdir(join(root, '.wkt'), {recursive: true})
  await Bun.write(fileFor(root), `${path}\n`)
}
