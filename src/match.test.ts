import {expect, test} from 'bun:test'
import {matchesQuery} from './match'

test('single keyword is a substring match anywhere', () => {
  expect(matchesQuery('bar', 'foo-bar')).toBe(true)
  expect(matchesQuery('bar', 'bar-foo')).toBe(true)
  expect(matchesQuery('bar', 'foo-baz')).toBe(false)
})

test('all keywords must appear in order', () => {
  expect(matchesQuery('fo ba', 'foo-bar')).toBe(true)
  expect(matchesQuery('fo ba', 'bar-foo')).toBe(false)
})

test('a space requires a gap between keywords', () => {
  expect(matchesQuery('a b', 'a-b')).toBe(true)
  expect(matchesQuery('a b', 'ab')).toBe(false)
  expect(matchesQuery('fo ba', 'fobar')).toBe(false)
})

test('case-insensitive', () => {
  expect(matchesQuery('FOO', 'foo')).toBe(true)
  expect(matchesQuery('foo', 'FOO')).toBe(true)
})

test('partial substring of a flat worktree name', () => {
  expect(matchesQuery('reg', 'codeFirstEndpointRegistry')).toBe(true)
  expect(matchesQuery('auth', 'feature-auth')).toBe(true)
  expect(matchesQuery('zzz', 'feature-auth')).toBe(false)
})

test('branch names with slashes are matched literally', () => {
  expect(matchesQuery('feat/auth', 'feat/auth-tokens')).toBe(true)
  expect(matchesQuery('feat auth', 'feat/auth-tokens')).toBe(true)
})

test('empty query matches anything', () => {
  expect(matchesQuery('', 'anything')).toBe(true)
})
