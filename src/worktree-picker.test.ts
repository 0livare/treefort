import {expect, test} from 'bun:test'
import type {Worktree} from './git'
import {
  currentWorktreeFirst,
  pickerState,
  restorePickerState,
} from './worktree-picker'

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

test('restores shared option order and selection in another picker', () => {
  const original = [
    worktree('feature-c'),
    worktree('root'),
    worktree('feature-a'),
    worktree('feature-b'),
  ]
  const state = pickerState(original, 2)
  const available = [
    worktree('feature-a'),
    worktree('feature-b'),
    worktree('feature-c'),
  ]

  const restored = restorePickerState(available, state)

  expect(restored.worktrees.map((w) => w.path)).toEqual([
    'feature-c',
    'feature-a',
    'feature-b',
  ])
  expect(restored.initialIndex).toBe(1)
})

test('appends options absent from the previous picker without reordering them', () => {
  const state = {
    order: ['feature-b', 'feature-a'],
    selectedPath: 'feature-b',
  }
  const available = [
    worktree('root'),
    worktree('feature-a'),
    worktree('new'),
    worktree('feature-b'),
  ]

  const restored = restorePickerState(available, state)

  expect(restored.worktrees.map((w) => w.path)).toEqual([
    'feature-b',
    'feature-a',
    'root',
    'new',
  ])
  expect(restored.initialIndex).toBe(0)
})
