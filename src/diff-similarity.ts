// Fuzzy comparison of two unified diffs, for spotting a squash merge whose
// landed diff isn't identical to the branch's (review tweaks, conflict
// resolution, …) but is overwhelmingly the same change.

// Below this a percentage says little, and exact matches are already caught
// by patch-id / merge-tree checks.
export const MIN_CHANGED_LINES = 20
export const SIMILARITY_THRESHOLD = 0.9

// A diff's added/removed lines as a multiset keyed by file, sign, and the
// trimmed line text. Headers, hunk markers, and blank lines are dropped.
export function changedLines(diff: string): Map<string, number> {
  const lines = new Map<string, number>()
  let file = ''
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      file = line.slice(line.indexOf(' b/') + 3)
      continue
    }
    if (line.startsWith('+++ ') || line.startsWith('--- ')) continue
    const sign = line[0]
    if (sign !== '+' && sign !== '-') continue
    const text = line.slice(1).trim()
    if (!text) continue
    const key = `${file}\0${sign}${text}`
    lines.set(key, (lines.get(key) ?? 0) + 1)
  }
  return lines
}

export function lineCount(lines: Map<string, number>): number {
  let total = 0
  for (const n of lines.values()) total += n
  return total
}

// Shared lines over the larger side's size, 0–1. Dividing by the larger side
// keeps a huge commit from "containing" a small, unrelated branch.
export function diffSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  const denom = Math.max(lineCount(a), lineCount(b))
  if (denom === 0) return 0
  let shared = 0
  for (const [key, n] of a) shared += Math.min(n, b.get(key) ?? 0)
  return shared / denom
}
