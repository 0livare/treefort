import {expect, test} from 'bun:test'
import {matchesQuery} from './match'

test('single keyword matches the last component only', () => {
  expect(matchesQuery('bar', '/foo/bar')).toBe(true)
  expect(matchesQuery('bar', '/bar/foo')).toBe(false)
})

test('all keywords must appear in order', () => {
  expect(matchesQuery('fo ba', '/foo/bar')).toBe(true)
  expect(matchesQuery('fo ba', '/bar/foo')).toBe(false)
})

test('slashes are matched literally', () => {
  expect(matchesQuery('fo / ba', '/foo/bar')).toBe(true)
  expect(matchesQuery('fo / ba', '/foobar')).toBe(false)
})

test('last keyword component must match the last path component', () => {
  expect(matchesQuery('foo/bar', '/foo/bar')).toBe(true)
  expect(matchesQuery('foo/bar', '/foo/bar/baz')).toBe(false)
})

test('case-insensitive', () => {
  expect(matchesQuery('FOO', '/foo')).toBe(true)
  expect(matchesQuery('foo', '/FOO')).toBe(true)
})

test('partial substring of a flat worktree name', () => {
  expect(matchesQuery('reg', 'codeFirstEndpointRegistry')).toBe(true)
  expect(matchesQuery('auth', 'feature-auth')).toBe(true)
  expect(matchesQuery('zzz', 'feature-auth')).toBe(false)
})

test('empty query matches anything', () => {
  expect(matchesQuery('', 'anything')).toBe(true)
})
