// Query matching (case-insensitive): the query is split into
// whitespace-separated keywords, and every keyword must appear in `target` in
// order with at least one character between consecutive keywords — a space
// represents a gap, so `a b` behaves like the regex `a.+b`. A single keyword
// is a plain substring match, e.g. `reg` matches `codeFirstEndpointRegistry`.
export function matchesQuery(query: string, target: string): boolean {
  const name = target.toLowerCase()
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean)

  let idx = 0
  for (const [i, kw] of keywords.entries()) {
    const pos = name.indexOf(kw, i === 0 ? 0 : idx + 1)
    if (pos < 0) return false
    idx = pos + kw.length
  }
  return true
}
