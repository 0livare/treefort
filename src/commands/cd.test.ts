import {expect, test} from 'bun:test'
import type {Worktree} from '../git'
import {currentWorktreeIndex} from './cd'

const worktree = (path: string, isCurrent = false): Worktree => ({
  path,
  branch: path,
  head: 'abc123',
  isMain: path === 'root',
  isBare: false,
  isCurrent,
})

test('preselects the current worktree in ranked picker results', () => {
  const worktrees = [
    worktree('recent'),
    worktree('current', true),
    worktree('older'),
  ]

  expect(currentWorktreeIndex(worktrees)).toBe(1)
})

test('preselects the first worktree when none is current', () => {
  expect(currentWorktreeIndex([worktree('root'), worktree('feature')])).toBe(0)
})
