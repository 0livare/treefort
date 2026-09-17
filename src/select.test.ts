import {expect, test} from 'bun:test'
import {resolveSelectedItems} from './select'

test('multi-select confirms toggled items in option order', () => {
  expect(
    resolveSelectedItems(['first', 'second', 'third'], new Set([2, 0]), 1),
  ).toEqual(['first', 'third'])
})

test('multi-select confirms the cursor when no items are toggled', () => {
  expect(
    resolveSelectedItems(['first', 'second', 'third'], new Set(), 1),
  ).toEqual(['second'])
})
