import {afterAll, expect, test} from 'bun:test'
import {mkdtempSync, realpathSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

// End-to-end tests that drive the real CLI (bun src/main.ts) as a subprocess
// against throwaway repos. stdin is never a TTY here, so these also pin down
// the non-interactive behavior. Git config is isolated so the host's settings
// (merge.ff, hooks, …) can't leak in.

const MAIN = join(import.meta.dir, 'main.ts')
// realpath so paths compare equal to git's output (macOS tmpdir is a symlink).
const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'wt-test-')))
const gitConfig = join(scratch, 'gitconfig')
writeFileSync(
  gitConfig,
  '[user]\n\tname = wt test\n\temail = wt@test.invalid\n[init]\n\tdefaultBranch = main\n',
)

const ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: gitConfig,
  GIT_CONFIG_SYSTEM: '/dev/null',
}

afterAll(() => rmSync(scratch, {recursive: true, force: true}))

type Result = {code: number; stdout: string; stderr: string}

async function run(cmd: string[], cwd: string): Promise<Result> {
  const proc = Bun.spawn(cmd, {
    cwd,
    env: ENV,
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  return {code: await proc.exited, stdout: stdout.trim(), stderr: stderr.trim()}
}

const wt = (cwd: string, ...args: string[]) => run(['bun', MAIN, ...args], cwd)
const git = (cwd: string, ...args: string[]) => run(['git', ...args], cwd)

let repoCount = 0
async function makeRepo(): Promise<string> {
  const dir = join(scratch, `repo${repoCount++}`)
  await git(scratch, 'init', '-q', dir)
  writeFileSync(join(dir, 'file.txt'), 'hello\n')
  await git(dir, 'add', '.')
  await git(dir, 'commit', '-q', '-m', 'init')
  return dir
}

async function tip(cwd: string, ref: string): Promise<string> {
  return (await git(cwd, 'rev-parse', ref)).stdout
}

test('add creates a worktree off main and prints its path', async () => {
  const repo = await makeRepo()
  const res = await wt(repo, 'add', 'feature')
  expect(res.code).toBe(0)
  expect(res.stdout).toBe(join(repo, '.worktrees', 'feature'))
  expect(await tip(repo, 'feature')).toBe(await tip(repo, 'main'))
})

test('add forks from the root worktree, not the shell cwd', async () => {
  const repo = await makeRepo()
  const a = (await wt(repo, 'add', 'a')).stdout
  writeFileSync(join(a, 'extra.txt'), 'x\n')
  await git(a, 'add', '.')
  await git(a, 'commit', '-q', '-m', 'extra')

  const res = await wt(a, 'add', 'b') // run from inside worktree a
  expect(res.code).toBe(0)
  expect(await tip(repo, 'b')).toBe(await tip(repo, 'main'))
  expect(await tip(repo, 'b')).not.toBe(await tip(repo, 'a'))
})

test('slash-named worktrees keep distinct names', async () => {
  const repo = await makeRepo()
  await wt(repo, 'add', 'feat/x')
  await wt(repo, 'add', 'fix/x')

  const complete = await wt(repo, '__complete', 'worktrees')
  expect(complete.stdout.split('\n').sort()).toEqual(['feat/x', 'fix/x'])

  const rm = await wt(repo, 'rm', 'feat/x', '-k')
  expect(rm.code).toBe(0)
  expect(rm.stderr).toContain('removed feat/x')
  expect((await wt(repo, '__complete', 'worktrees')).stdout).toBe('fix/x')
})

test('add tracks a branch that exists only on a remote', async () => {
  const src = await makeRepo()
  await git(src, 'checkout', '-q', '-b', 'remote-only')
  writeFileSync(join(src, 'remote.txt'), 'r\n')
  await git(src, 'add', '.')
  await git(src, 'commit', '-q', '-m', 'remote work')
  await git(src, 'checkout', '-q', 'main')

  const repo = join(scratch, 'clone-track')
  await git(scratch, 'clone', '-q', src, repo)

  const res = await wt(repo, 'add', 'remote-only')
  expect(res.code).toBe(0)
  expect(res.stderr).toContain('tracking origin/remote-only')
  expect(await tip(repo, 'remote-only')).toBe(
    await tip(repo, 'origin/remote-only'),
  )
  expect(await tip(repo, 'remote-only')).not.toBe(await tip(repo, 'main'))
  const upstream = await git(
    repo,
    'rev-parse',
    '--abbrev-ref',
    'remote-only@{upstream}',
  )
  expect(upstream.stdout).toBe('origin/remote-only')
})

test('add errors when a branch exists on multiple remotes', async () => {
  const src = await makeRepo()
  await git(src, 'branch', 'shared')

  const repo = join(scratch, 'clone-multi')
  await git(scratch, 'clone', '-q', src, repo)
  await git(repo, 'remote', 'add', 'upstream', src)
  await git(repo, 'fetch', '-q', 'upstream')

  const res = await wt(repo, 'add', 'shared')
  expect(res.code).toBe(1)
  expect(res.stderr).toContain('multiple remotes')

  // An explicit start-point disambiguates.
  const explicit = await wt(repo, 'add', 'shared', 'origin/shared')
  expect(explicit.code).toBe(0)
  expect(await tip(repo, 'shared')).toBe(await tip(repo, 'origin/shared'))
})

test('add rejects a start-point for an existing branch', async () => {
  const repo = await makeRepo()
  await git(repo, 'branch', 'existing')
  const res = await wt(repo, 'add', 'existing', 'main')
  expect(res.code).toBe(1)
  expect(res.stderr).toContain('already exists')
})

test('add refuses to free a dirty root worktree without --force', async () => {
  const repo = await makeRepo()
  await git(repo, 'checkout', '-q', '-b', 'held')
  writeFileSync(join(repo, 'dirty.txt'), 'wip\n')

  const refused = await wt(repo, 'add', 'held')
  expect(refused.code).toBe(1)
  expect(refused.stderr).toContain('uncommitted changes')

  const forced = await wt(repo, 'add', 'held', '-f')
  expect(forced.code).toBe(0)
  expect((await git(repo, 'branch', '--show-current')).stdout).toBe('main')
})

test('prune removes squash-merged worktrees and keeps unmerged ones', async () => {
  const repo = await makeRepo()
  const topic = (await wt(repo, 'add', 'topic')).stdout
  writeFileSync(join(topic, 'one.txt'), '1\n')
  await git(topic, 'add', '.')
  await git(topic, 'commit', '-q', '-m', 'c1')
  writeFileSync(join(topic, 'two.txt'), '2\n')
  await git(topic, 'add', '.')
  await git(topic, 'commit', '-q', '-m', 'c2')
  const unmerged = (await wt(repo, 'add', 'unmerged')).stdout
  writeFileSync(join(unmerged, 'wip.txt'), 'wip\n')
  await git(unmerged, 'add', '.')
  await git(unmerged, 'commit', '-q', '-m', 'wip')

  await git(repo, 'merge', '--squash', '-q', 'topic')
  await git(repo, 'commit', '-q', '-m', 'topic (squashed)')

  const res = await wt(repo, 'prune')
  expect(res.code).toBe(0)
  expect(res.stderr).toContain('removed topic')
  expect(res.stderr).toContain('deleted branch topic')
  expect((await git(repo, 'branch', '--list', 'topic')).stdout).toBe('')
  expect((await wt(repo, '__complete', 'worktrees')).stdout).toBe('unmerged')
})

test('rm deletes a squash-merged branch but keeps an unmerged one', async () => {
  const repo = await makeRepo()

  const merged = (await wt(repo, 'add', 'merged')).stdout
  writeFileSync(join(merged, 'm.txt'), 'm\n')
  await git(merged, 'add', '.')
  await git(merged, 'commit', '-q', '-m', 'm')
  await git(repo, 'merge', '--squash', '-q', 'merged')
  await git(repo, 'commit', '-q', '-m', 'merged (squashed)')

  const unmerged = (await wt(repo, 'add', 'unmerged')).stdout
  writeFileSync(join(unmerged, 'u.txt'), 'u\n')
  await git(unmerged, 'add', '.')
  await git(unmerged, 'commit', '-q', '-m', 'u')

  const rmMerged = await wt(repo, 'rm', 'merged')
  expect(rmMerged.stderr).toContain('deleted branch merged')
  expect((await git(repo, 'branch', '--list', 'merged')).stdout).toBe('')

  const rmUnmerged = await wt(repo, 'rm', 'unmerged')
  expect(rmUnmerged.stderr).toContain('kept branch unmerged')
  expect((await git(repo, 'branch', '--list', 'unmerged')).stdout).not.toBe('')
})

test('bare repos: add forks from trunk, root is labeled and unsuggested', async () => {
  const src = await makeRepo()
  const bare = join(scratch, 'bare.git')
  await git(scratch, 'clone', '-q', '--bare', src, bare)

  const add = await wt(bare, 'add', 'feat')
  expect(add.code).toBe(0)
  expect(await tip(bare, 'feat')).toBe(await tip(bare, 'main'))

  expect((await wt(bare, 'ls')).stderr).toContain('(bare)')
  expect((await wt(bare, '__complete', 'cd')).stdout).toBe('feat')
  expect((await wt(bare, 'root')).stdout).toBe(bare)
})

test('interactive commands fail cleanly without a TTY', async () => {
  const repo = await makeRepo()
  await wt(repo, 'add', 'feature')

  const picker = await wt(repo)
  expect(picker.code).toBe(1)
  expect(picker.stderr).toContain('requires a terminal')

  const noMatch = await wt(repo, 'nosuchtree')
  expect(noMatch.code).toBe(1)
  expect(noMatch.stderr).toContain('no worktree matching')

  const fuzzyRm = await wt(repo, 'rm', 'feat')
  expect(fuzzyRm.code).toBe(1)
  expect(fuzzyRm.stderr).toContain('closest match is feature')
})

test('cd resolves names and toggles with -', async () => {
  const repo = await makeRepo()
  const feature = (await wt(repo, 'add', 'feature')).stdout

  expect((await wt(repo, 'feature')).stdout).toBe(feature)
  expect((await wt(repo, 'cd', '-')).stdout).toBe(repo)
})

test('help and version are subcommands', async () => {
  const repo = await makeRepo()
  expect((await wt(repo, 'help')).code).toBe(0)
  const version = await wt(repo, 'version')
  expect(version.code).toBe(0)
  expect(version.stderr).toMatch(/^\d+\.\d+\.\d+$/)
})

test('exec runs in the root worktree and 127s on unknown commands', async () => {
  const repo = await makeRepo()
  const echo = await wt(repo, 'exec', '--', 'echo', 'hi')
  expect(echo.code).toBe(0)
  expect(echo.stdout).toBe('hi')

  const missing = await wt(repo, 'exec', '--', 'wt-no-such-cmd')
  expect(missing.code).toBe(127)
  expect(missing.stderr).toContain('command not found')
})

test('shell-init emits the wrapper with per-shell completion', async () => {
  const repo = await makeRepo()
  const zsh = await wt(repo, 'shell-init', 'zsh')
  expect(zsh.stdout).toContain('wt() {')
  expect(zsh.stdout).toContain('compdef')

  const bash = await wt(repo, 'shell-init', 'bash')
  expect(bash.stdout).toContain('wt() {')
  expect(bash.stdout).toContain('complete -F _wt wt')
})
