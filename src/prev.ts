import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {WORKTREE_DIR} from './git'

// Repo-scoped "previous worktree" pointer for `wt cd -`, kept in a state file
// under the worktrees dir (gitignored). Repo-scoped rather than per-shell, but
// it means the toggle works regardless of which shell wrapper version is loaded.
const fileFor = (root: string) => join(root, WORKTREE_DIR, '.previous')

export async function getPrevious(root: string): Promise<string | null> {
  const file = Bun.file(fileFor(root))
  if (!(await file.exists())) return null
  return (await file.text()).trim() || null
}

export async function setPrevious(root: string, path: string): Promise<void> {
  await mkdir(join(root, WORKTREE_DIR), {recursive: true})
  await Bun.write(fileFor(root), `${path}\n`)
}
