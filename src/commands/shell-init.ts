import {basename} from 'node:path'

// The wrapper + completion, emitted for `eval "$(command wt shell-init <shell>)"`.
//
// The wrapper shadows the `wt` binary and performs the shell-level cd: it
// captures the binary's stdout (a single directory path, or nothing) and cds
// there. `exec` and `shell-init` are passed through untouched — their stdout is
// the command's own output / shell code, not a path to cd into. The wrapper is
// POSIX-compatible and shared between shells; completion is per-shell.
const wrapper = `wt() {
  case "$1" in
    exec|shell-init)
      command wt "$@"
      return $?
      ;;
  esac
  local dir
  dir=$(command wt "$@") || return
  [ -n "$dir" ] || return 0
  cd "$dir"
}`

const zshCompletion = `_wt() {
  if (( CURRENT == 2 )); then
    # \`wt <name>\` is shorthand for \`wt cd <name>\`, so complete worktrees here
    # (same candidates as \`wt cd\`), not the subcommands.
    compadd -- \${(f)"$(command wt __complete cd 2>/dev/null)"}
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

const bashCompletion = `_wt() {
  local cur=\${COMP_WORDS[COMP_CWORD]}
  local candidates=''
  if (( COMP_CWORD == 1 )); then
    candidates=$(command wt __complete cd 2>/dev/null)
  elif (( COMP_CWORD == 2 )); then
    case "\${COMP_WORDS[1]}" in
      rm|remove|exec) candidates=$(command wt __complete worktrees 2>/dev/null) ;;
      cd) candidates=$(command wt __complete cd 2>/dev/null) ;;
      add) candidates=$(command wt __complete branches 2>/dev/null) ;;
    esac
  fi
  COMPREPLY=($(compgen -W "$candidates" -- "$cur"))
}
complete -F _wt wt`

// `shell` comes from the CLI arg (wt install writes it into the eval line);
// fall back to $SHELL for a bare `wt shell-init`, then to zsh.
export function shellInit(shell?: string) {
  const which = shell || basename(process.env.SHELL ?? '') || 'zsh'
  const completion = which === 'bash' ? bashCompletion : zshCompletion
  // Intentionally stdout so `eval "$(command wt shell-init)"` picks it up.
  process.stdout.write(`${wrapper}\n\n${completion}\n`)
}
