// Ticket keys (Jira-style ABC-123) in branch names and commit subjects.

// The first ticket key in a branch name, upper-cased, or null. The key must
// start a path or word segment: `feature/abc-123-foo` → `ABC-123`.
export function ticketKey(branch: string): string | null {
  const m = branch.match(/(?:^|[/_-])([A-Za-z][A-Za-z0-9]+-\d+)(?!\d)/)
  return m ? m[1].toUpperCase() : null
}

// Whether `subject` mentions `key` as a whole token (ABC-12 ≠ ABC-123).
export function subjectHasTicket(subject: string, key: string): boolean {
  return new RegExp(`(?<![A-Za-z0-9])${key}(?!\\d)`, 'i').test(subject)
}
