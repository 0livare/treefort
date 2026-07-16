// The zsh wrapper + completion, emitted for `eval "$(command wt shell-init)"`.
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
  if [ -n "$dir" ]; then
    export WT_PREV_WORKTREE="$PWD"
    cd "$dir"
  fi
}

_wt() {
  local -a subcmds
  subcmds=(add rm list ls cd root exec install shell-init)
  if (( CURRENT == 2 )); then
    compadd -- $subcmds
    return
  fi
  if (( CURRENT == 3 )); then
    case "\${words[2]}" in
      rm|remove|exec)
        compadd -- \${(f)"$(command wt __complete worktrees 2>/dev/null)"}
        ;;
      cd)
        compadd -- \${(f)"$(command wt __complete cd 2>/dev/null)"}
        ;;
      add)
        compadd -- \${(f)"$(command wt __complete branches 2>/dev/null)"}
        ;;
    esac
  fi
}
whence compdef >/dev/null 2>&1 && compdef _wt wt`

export function shellInit() {
  // Intentionally stdout so \`eval "$(command wt shell-init)"\` picks it up.
  process.stdout.write(`${shellScript}\n`)
}
