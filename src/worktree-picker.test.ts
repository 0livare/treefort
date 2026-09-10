import {expect, test} from 'bun:test'
import type {Worktree} from './git'
import {currentWorktreeFirst} from './worktree-picker'

const worktree = (path: string, isCurrent = false): Worktree => ({
  path,
  branch: path,
  head: 'abc123',
  isMain: path === 'root',
  isBare: false,
  isCurrent,
})

test('puts the current worktree first in picker results', () => {
  const worktrees = [
    worktree('recent'),
    worktree('current', true),
    worktree('older'),
  ]

  expect(currentWorktreeFirst(worktrees).map((w) => w.path)).toEqual([
    'current',
    'recent',
    'older',
  ])
})

test('preserves ranked picker results when none is current', () => {
  const worktrees = [worktree('root'), worktree('feature')]

  expect(currentWorktreeFirst(worktrees)).toBe(worktrees)
})

test('preserves ranked picker results when current is already first', () => {
  const worktrees = [worktree('current', true), worktree('feature')]

  expect(currentWorktreeFirst(worktrees)).toBe(worktrees)
})
