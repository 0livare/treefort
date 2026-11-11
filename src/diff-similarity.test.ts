import {expect, test} from 'bun:test'
import {changedLines, diffSimilarity, lineCount} from './diff-similarity'

const diff = (file: string, lines: string[]) =>
  [
    `diff --git a/${file} b/${file}`,
    'index 0000000..1111111 100644',
    `--- a/${file}`,
    `+++ b/${file}`,
    '@@ -1,2 +1,2 @@',
    ' context',
    ...lines,
  ].join('\n')

test('changedLines keeps only added/removed lines, keyed by file', () => {
  const lines = changedLines(diff('a.ts', ['+one', '-two', '+', '+  one  ']))
  expect(lineCount(lines)).toBe(3)
  expect(lines.get('a.ts\0+one')).toBe(2)
  expect(lines.get('a.ts\0-two')).toBe(1)
})

test('the same line in different files is a different change', () => {
  const a = changedLines(diff('a.ts', ['+x']))
  const b = changedLines(diff('b.ts', ['+x']))
  expect(diffSimilarity(a, b)).toBe(0)
})

test('identical diffs are fully similar, disjoint ones not at all', () => {
  const a = changedLines(diff('a.ts', ['+1', '+2', '-3']))
  expect(diffSimilarity(a, a)).toBe(1)
  expect(diffSimilarity(a, changedLines(diff('a.ts', ['+9'])))).toBe(0)
  expect(diffSimilarity(new Map(), new Map())).toBe(0)
})

test('partial overlap is measured against the larger side', () => {
  const ten = Array.from({length: 10}, (_, i) => `+line ${i}`)
  const branch = changedLines(diff('a.ts', ten))
  const landed = changedLines(diff('a.ts', [...ten.slice(0, 9), '+tweaked']))
  expect(diffSimilarity(branch, landed)).toBe(0.9)

  // A big commit that happens to contain the branch isn't a match.
  const big = changedLines(
    diff('a.ts', [...ten, ...ten.map((l) => `${l} more`)]),
  )
  expect(diffSimilarity(branch, big)).toBe(0.5)
})
