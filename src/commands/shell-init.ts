// The zsh wrapper, emitted for `eval "$(command wt shell-init)"`.
//
// The wrapper shadows the `wt` binary and performs the shell-level cd: it
// captures the binary's stdout (a single directory path, or nothing) and cds
// there. `exec` and `shell-init` are passed through untouched — their stdout is
// the command's own output / shell code, not a path to cd into.
const shellScript = `wt() {
  case "$1" in
    exec|shell-init)
      command wt "$@"
      return $?
      ;;
  esac
  local dir
  dir=$(command wt "$@") || return
  [ -n "$dir" ] && cd "$dir"
}`

export function shellInit() {
  // Intentionally stdout so \`eval "$(command wt shell-init)"\` picks it up.
  process.stdout.write(shellScript + '\n')
}
