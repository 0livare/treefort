import {expect, test} from 'bun:test'
import {join} from 'node:path'
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

test.each([
  {keys: '  \r', initialIndex: 0, expected: ['first']},
  {keys: ' \x1b[B \r', initialIndex: 0, expected: ['first', 'second']},
  {keys: '  \r', initialIndex: 2, expected: ['third']},
  {keys: ' \x1b[B\r', initialIndex: 0, expected: ['first']},
  {keys: ' \x1b[B \x1b[B\r', initialIndex: 0, expected: ['first', 'second']},
])(
  'multi-select toggles in place and confirms only checked rows: %j',
  async ({keys, initialIndex, expected}) => {
    // Isolate the simulated terminal from the test runner's own stdin.
    const proc = Bun.spawn(
      [
        process.execPath,
        '-e',
        `
          import {select} from ${JSON.stringify(join(import.meta.dir, 'select.ts'))}
          Object.defineProperty(process.stdin, 'isTTY', {value: true})
          process.stdin.setRawMode = () => process.stdin
          const result = select({
            items: ['first', 'second', 'third'],
            label: (item) => item,
            multiple: true,
            initialIndex: ${initialIndex},
          })
          process.stdin.emit('data', ${JSON.stringify(keys)})
          console.log(JSON.stringify(await result))
        `,
      ],
      {stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'},
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    expect(code, stderr).toBe(0)
    expect(JSON.parse(stdout)).toEqual(expected)
  },
)
