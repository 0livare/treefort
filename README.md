# Git Worktree CLI (`wt`)

A CLI to make working with [git worktrees](https://git-scm.com/docs/git-worktree) effortless — add, switch between, and remove worktrees with a single command, and get `cd`'d into the right directory automatically.

Worktrees live under `.wkt/<name>` at the root of your repo.

## Installation

Clone this repo, then:

```bash
bun install
bun link      # makes `wt` available globally
wt install    # sets up the shell wrapper + global gitignore (one time)
```

`wt install` is idempotent. It:

1. Adds `eval "$(command wt shell-init)"` to your `~/.zshrc`. This defines a `wt` shell function that wraps the binary and performs the actual `cd` — a subprocess can't change its parent shell's directory, so this wrapper is required for the auto-`cd` behavior.
2. Ensures git's global excludes file (`core.excludesfile`, defaulting to `~/.gitignore_global`) contains `.wkt/`, so worktrees are ignored in every repo.

After running it, open a new shell or `source ~/.zshrc`.

## Usage

```sh
# Interactive worktree switcher — pick one and cd into it
wt

# Add a worktree and cd into it.
#   - if the branch exists, it's checked out
#   - otherwise a new branch is created off HEAD
wt add feature-x

# Base the new branch off something other than HEAD
wt add feature-x origin/main

# No name: move your *current* branch into its own worktree.
# (Detaches the main worktree's HEAD to free the branch, then cds you in.)
wt add

# List all worktrees (current is marked, dirty ones flagged)
wt list        # or: wt ls

# Remove a worktree. The directory is deregistered and moved out of the way
# instantly, then deleted in the background — the command returns immediately.
wt rm feature-x

# Remove interactively (pick from a list)
wt rm

# Remove and also delete the branch — only if a remote ref points at its
# latest commit (i.e. the work is safely pushed), otherwise the branch is kept.
wt rm feature-x -d

# Force-remove a worktree with uncommitted changes
wt rm feature-x --force
```

### Flags

| Flag                    | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `-f`, `--force`         | Skip the dirty-worktree / checkout guard       |
| `-d`, `--delete-branch` | Also delete the branch (only if safely pushed) |
| `-v`, `--version`       | Print version number                           |
| `-h`, `--help`          | Print help information                         |

## How the auto-`cd` works

The `wt` binary never changes your shell's directory directly (it can't — it's a
subprocess). Instead:

- All human-facing output (progress, the interactive picker, `list`) goes to **stderr**.
- When a command should move you, the binary prints a single directory path to **stdout**.
- The `wt` shell function installed by `wt install` captures that path and runs `cd`:

  ```zsh
  wt() {
    local dir
    dir=$(command wt "$@") || return
    [ -n "$dir" ] && cd "$dir"
  }
  ```
