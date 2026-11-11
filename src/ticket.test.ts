import {expect, test} from 'bun:test'
import {subjectHasTicket, ticketKey} from './ticket'

test('extracts and upper-cases a ticket key from a branch name', () => {
  expect(ticketKey('abc-123')).toBe('ABC-123')
  expect(ticketKey('feature/abc-123-add-thing')).toBe('ABC-123')
  expect(ticketKey('zo/BAWP-42_fix')).toBe('BAWP-42')
  expect(ticketKey('fix-abc-7')).toBe('ABC-7')
})

test('returns null when the branch has no ticket key', () => {
  expect(ticketKey('add-login-page')).toBeNull()
  expect(ticketKey('123-fix')).toBeNull()
  expect(ticketKey('topic')).toBeNull()
})

test('matches a ticket key in a subject as a whole token', () => {
  expect(subjectHasTicket('ABC-123: add thing (#45)', 'ABC-123')).toBe(true)
  expect(subjectHasTicket('feat(abc-123): add thing', 'ABC-123')).toBe(true)
  expect(subjectHasTicket('ABC-1234 other thing', 'ABC-123')).toBe(false)
  expect(subjectHasTicket('XABC-123 other thing', 'ABC-123')).toBe(false)
  expect(subjectHasTicket('ABC-12 other thing', 'ABC-123')).toBe(false)
})
