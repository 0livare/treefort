// zoxide-style query matching (case-insensitive):
//   1. the query is split into whitespace-separated keywords;
//   2. all keywords must appear in `target` in order;
//   3. the last keyword's last `/`-component must appear in `target`'s last
//      `/`-component.
// For flat worktree names (no slash) this reduces to a substring match, e.g.
// `reg` matches `codeFirstEndpointRegistry`.
export function matchesQuery(query: string, target: string): boolean {
  const path = target.toLowerCase()
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (keywords.length === 0) return true

  // Rule 2: every keyword occurs in order.
  let idx = 0
  for (const kw of keywords) {
    const pos = path.indexOf(kw, idx)
    if (pos < 0) return false
    idx = pos + kw.length
  }

  // Rule 3: last keyword's last component lies within the path's last component.
  const lastKw = keywords[keywords.length - 1]
  const lastKwComponent = lastKw.slice(lastKw.lastIndexOf('/') + 1)
  const pathLastComponent = path.slice(path.lastIndexOf('/') + 1)
  return pathLastComponent.includes(lastKwComponent)
}
