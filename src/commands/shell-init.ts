// The zsh wrapper. It shadows the `wt` binary and performs the shell-level cd:
// it captures the binary's stdout (a single directory path, or nothing) and cds
// there. All human-facing output goes to stderr, so it flows straight through.
export const shellFunction = `wt() {
  local dir
  dir=$(command wt "$@") || return
  [ -n "$dir" ] && cd "$dir"
}`

export function shellInit() {
  // Intentionally stdout so \`eval "$(command wt shell-init)"\` picks it up.
  process.stdout.write(shellFunction + '\n')
}
