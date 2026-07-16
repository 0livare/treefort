# Alias for `git worktree add` that forwards flags and automatically cds into the newly created worktree directory
gwa() {
  local args=() arg skip=0 wkt_path=""

  for arg in "$@"; do
    if (( skip )); then
      skip=0
      args+=("$arg")
      continue
    fi
    case "$arg" in
      -b|-B|--reason|--orphan) skip=1; args+=("$arg") ;;
      -*) args+=("$arg") ;;
      *)
        if [[ -z "$wkt_path" ]]; then
          wkt_path="./.wkt/$arg"
          args+=("$wkt_path")
        else
          args+=("$arg")
        fi
        ;;
    esac
  done

  mkdir -p ./.wkt
  git worktree add "${args[@]}" && cd "$wkt_path"
}