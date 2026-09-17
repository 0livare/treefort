import {expect, test} from 'bun:test'
import type {Worktree} from '../git'
import {prepareRemovePicker} from './remove'

const worktree = (path: string, isMain = false): Worktree => ({
  path,
  branch: path,
  head: 'abc123',
  isMain,
  isBare: false,
  isCurrent: false,
})

test('precomputes dirty state for removable worktrees', async () => {
  const worktrees = [
    worktree('root', true),
    worktree('clean'),
    worktree('dirty'),
  ]
  const checked: string[] = []

  const preparation = prepareRemovePicker(worktrees, async (path) => {
    checked.push(path)
    return path === 'dirty'
  })

  expect(checked).toEqual(['clean', 'dirty'])
  const result = await preparation
  expect(result).toEqual({
    value: {
      worktrees,
      dirty: new Set(['dirty']),
    },
  })
})

test('defers preparation errors until the result is consumed', async () => {
  const error = new Error('status failed')
  const preparation = prepareRemovePicker(
    [worktree('root', true), worktree('feature')],
    async () => {
      throw error
    },
  )

  expect(await preparation).toEqual({error})
})
