import {existsSync} from 'node:fs'
import {copyFile, mkdir, readdir, stat} from 'node:fs/promises'
import {dirname, join, relative} from 'node:path'
import {printSuccess, printWarning} from './helpers'

// Env files that git won't carry into a new worktree (they're typically
// gitignored): `.env`, `.env.local`, `.env.<mode>`, `.env.<mode>.local`, …
const ENV_FILE = /^\.env(\..+)?$/

// Root (depth 0) plus this many nested levels are scanned.
const MAX_DEPTH = 3

// Copy env files from one worktree into another so a freshly created worktree
// is usable immediately. Best-effort: a per-file failure warns and continues.
// `from` and `to` are absolute worktree roots.
export async function copyEnvFiles(from: string, to: string): Promise<void> {
  await scan(from, to, from, 0)
}

async function scan(
  dir: string,
  toRoot: string,
  fromRoot: string,
  depth: number,
): Promise<void> {
  const entries = await readdir(dir, {withFileTypes: true}).catch(() => [])

  for (const entry of entries) {
    const full = join(dir, entry.name)

    // Resolve symlinks (following the link) so we can tell files from dirs; a
    // matched symlinked file is copied by its contents, dir symlinks are never
    // followed.
    let isDir = entry.isDirectory()
    let isFile = entry.isFile()
    if (entry.isSymbolicLink()) {
      try {
        const st = await stat(full)
        isDir = st.isDirectory()
        isFile = st.isFile()
      } catch {
        continue
      }
    }

    if (isDir) {
      // Skip dotdirs (.git, .worktrees, .vscode, …) and node_modules; don't
      // follow directory symlinks. Descend only while within MAX_DEPTH.
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      if (entry.isSymbolicLink()) continue
      if (depth < MAX_DEPTH) await scan(full, toRoot, fromRoot, depth + 1)
      continue
    }

    if (!isFile || !ENV_FILE.test(entry.name)) continue

    const rel = relative(fromRoot, full)
    const dest = join(toRoot, rel)
    // Never overwrite what git already put in the new worktree.
    if (existsSync(dest)) continue

    try {
      await mkdir(dirname(dest), {recursive: true})
      await copyFile(full, dest)
      printSuccess(`copied ${rel}`)
    } catch (e) {
      printWarning(
        `could not copy ${rel}: ${e instanceof Error ? e.message : e}`,
      )
    }
  }
}
