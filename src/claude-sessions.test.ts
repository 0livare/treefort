import {describe, expect, test} from 'bun:test'
import {
  encodeProjectPath,
  extractCwd,
  extractTitle,
  timeAgo,
} from './claude-sessions'

const line = (obj: object) => `${JSON.stringify(obj)}\n`

describe('encodeProjectPath', () => {
  test('replaces every non-alphanumeric character with a dash', () => {
    expect(encodeProjectPath('/Users/z/dev/repo')).toBe('-Users-z-dev-repo')
    expect(encodeProjectPath('/Users/z/repo/.claude/worktrees/feat')).toBe(
      '-Users-z-repo--claude-worktrees-feat',
    )
    expect(encodeProjectPath('/a/b.c/d_e f')).toBe('-a-b-c-d-e-f')
  })
})

describe('extractTitle', () => {
  test('prefers a summary line over the first prompt', () => {
    const jsonl =
      line({type: 'user', message: {content: 'first prompt'}}) +
      line({type: 'summary', summary: 'The Summary Title'})
    expect(extractTitle(jsonl)).toBe('The Summary Title')
  })

  test('falls back to the first real user prompt', () => {
    const jsonl =
      line({type: 'user', isMeta: true, message: {content: 'meta noise'}}) +
      line({
        type: 'user',
        message: {content: '<command-name>/clear</command-name>'},
      }) +
      line({type: 'user', message: {content: 'fix the login bug'}}) +
      line({type: 'user', message: {content: 'a later prompt'}})
    expect(extractTitle(jsonl)).toBe('fix the login bug')
  })

  test('reads the first text block of array content', () => {
    const jsonl = line({
      type: 'user',
      message: {
        content: [{type: 'image'}, {type: 'text', text: 'hello there'}],
      },
    })
    expect(extractTitle(jsonl)).toBe('hello there')
  })

  test('collapses whitespace and truncates long prompts', () => {
    const jsonl = line({
      type: 'user',
      message: {content: `do\n  the ${'very '.repeat(30)}long thing`},
    })
    const title = extractTitle(jsonl)
    expect(title).toStartWith('do the very')
    expect(title).toEndWith('…')
    expect(title?.length).toBe(60)
  })

  test('ignores a torn trailing line and returns null when nothing fits', () => {
    expect(extractTitle('{"type":"user","message":{"con')).toBeNull()
    expect(extractTitle('')).toBeNull()
  })
})

describe('extractCwd', () => {
  test('returns the first recorded cwd', () => {
    const jsonl =
      line({type: 'summary', summary: 'title'}) +
      line({
        type: 'user',
        cwd: '/repo/.claude/worktrees/x',
        message: {content: 'hi'},
      })
    expect(extractCwd(jsonl)).toBe('/repo/.claude/worktrees/x')
    expect(extractCwd(line({type: 'summary', summary: 't'}))).toBeNull()
  })
})

describe('timeAgo', () => {
  const now = 1_000_000_000_000
  const ago = (ms: number) => timeAgo(now - ms, now)

  test('buckets ages coarsely', () => {
    expect(ago(5 * 1000)).toBe('now')
    expect(ago(90 * 1000)).toBe('1m')
    expect(ago(2 * 60 * 60 * 1000)).toBe('2h')
    expect(ago(3 * 24 * 60 * 60 * 1000)).toBe('3d')
    expect(ago(15 * 24 * 60 * 60 * 1000)).toBe('2w')
  })

  test('never goes negative on clock skew', () => {
    expect(timeAgo(now + 5000, now)).toBe('now')
  })
})
