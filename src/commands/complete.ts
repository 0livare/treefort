import {branchNames, cdTargets, worktreeNames} from '../git'

// Hidden helper the zsh completion function calls to get dynamic candidates.
// Writes one candidate per line to stdout (called via `command wt`, so the
// shell wrapper never sees this output).
export async function complete(kind: string | undefined) {
  const names =
    kind === 'branches'
      ? await branchNames()
      : kind === 'cd'
        ? await cdTargets()
        : await worktreeNames()
  if (names.length) process.stdout.write(`${names.join('\n')}\n`)
}
