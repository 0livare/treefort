# Treefort - git worktrees without the work 🌳

<img width="562" height="246" alt="treefort live demo" src="https://github.com/user-attachments/assets/c3b50877-97e8-44fc-8b9e-720dd623b145" />
<br/><br/>

Git worktrees let you check out multiple branches at once, each in its own directory. AI has skyrocketed the use of worktrees so that multiple agents can work simultaneously without stepping on each other's toes.

But the raw `git worktree` commands are clunky. You have manage all the file paths yourself:

- come up with the paths
- remember the paths
- `cd` back and forth between them
- clean them up yourself when you're done

Treefort makes worktrees effortless. **Add, switch, and remove worktrees in a single
command and land in the right directory automatically.**

```sh
wt add feature-x     # create it, automatically cd'd into it   --> pwd: /repo/.worktrees/feature-x
wt root              # jump back to the root worktree          --> pwd: /repo
wt feat              # jump back to feature-x later            --> pwd: /repo/.worktrees/feature-x
wt rm                # gone, instantly                         --> pwd: /repo
```

## Why you'll like it

### 🏃 You end up _inside_ the worktree every time

No remembering where the thing lives. No manual `cd ../worktrees/foobar` annoyances.

`wt add`, `wt cd`, and the interactive picker all drop your shell straight into the right directory. You don't have to think about it.

### 💅 Worktrees live inside the repo, where they belong

Having worktrees live as siblings to the repo (or worse somewhere else entirely) is an organizational mess. Treefort keeps them tucked away in a `.worktrees/` directory at the root of your repo, that is automatically ignored by git.

> Treefort works equally well with worktrees that you've created via Claude or any other method

Bare-clone layouts work too: run wt inside a bare repo and worktrees land in <bare>/.worktrees, with new branches forked from the trunk.

### 🧠 Partial + frecency navigation, like `zoxide` for worktrees

You don't type paths. You don't even have to type full names. Type a fragment and `wt` finds it:

```sh
wt reg    # matches regularExpressionParser or codeFirstEndpointRegistry or coreRegularizer
wt cd reg # equivalent. cd is the default command when one isn't specified
```

When a fragment matches more than one worktree, `wt` picks the one you actually mean, ranked by **frecency** (how _frequently_ and _recently_ you've visited it). The worktrees you live in float to the top; the ones you forgot about sink.

### 🎛️ An interactive picker, one keystroke away

Forgot the name entirely? Just run `wt` with no arguments and pick from a list. Same for removing them.

```sh
wt      # pick a worktree from a list, then automatically cd into it
```

### 🌿 Your env files come along for free

A fresh worktree only gets what git tracks, so your gitignored `.env` files stay behind and nothing runs. `wt add` fixes that: it scans the main worktree (the root plus three levels down, skipping dotdirs and `node_modules`) and copies every `.env*` file — `.env`, `.env.local`, `.env.<mode>`, and friends — into the new worktree at the same relative path. Anything git already checked out is left untouched. No config, no flags, just a worktree that works on the first `cd`.

### ⚡️ Removal returns _immediately_

`wt rm` deregisters the worktree and moves it out of the way _instantly_, then deletes the files in the background. Your prompt comes back _**now**_ — not in 30s after `rm -rf` finishes churning through `node_modules`.

```bash
npm install   # no waiting for node_modules to be deleted later

wt rm <partial> # same partial frecency matching as `wt` & `wt cd`
                # (a partial match asks y/n first)

wt rm         # with no args either removes the current worktree
              # or opens the interactive picker (if you're at the root worktree)
```

### 🛟 Branch cleanup that won't lose your work

`wt rm feature-x` removes the worktree _and_ deletes its branch, but only when that's safe; meaning the branch's commits already live on in another branch so nothing is lost. If the changes exist nowhere else, the branch is kept.

> **Squash Merges** are detected by patch-equivalence against the trunk

Need to override? `--keep-branch` (`-k`) always keeps it; `--force-branch` (`-D`) deletes it even if commits would be lost.

### 🧹 Sweep up merged work in one shot

Shipped a batch of features? `wt prune` removes _every_ worktree (and corresponding branch) whose branch is already merged into `main` — true merges _and_ squash merges (GitHub's default), which ordinary `git branch --merged` can't see. Dirty worktrees are left untouched (pass `--force` to include them). One command and your `.worktrees/` is back to just the things you're still working on.

### 🌱 Turn your current branch into a worktree

Want to create a worktree around an existing branch? No problem. Run `wt add` with no name and your current branch graduates into a fresh worktree (supplying a branch name also works), freeing up the main worktree behind you.

### 🔭 Reach into a worktree without leaving yours

```sh
wt exec git pull --ff-only     # no target -> runs in the main (root) worktree
wt exec feature-x -- bun test  # wk exec <other worktree> -- <command to run in other worktree>
wt exec @ -- git fetch         # @ and root both mean the main worktree
```

With no target the command runs in the root worktree, so `wt exec <command>` just works. To aim at another worktree, put its name before a `--` separator; everything after `--` is the command, flags and all.

> `@`, `root`, and `-`, can be used as the name as well, resolved exactly like `wt cd`.

## Installation

> ### Prerequisite - Bun
> This package depends on Bun being [installed globally](https://bun.sh/docs/installation)


```bash
# Create a global `wt` command
npm i -g treefort

# Set up the shell wrapper + global gitignore (one time)
wt install
```

`wt install` is idempotent. It:

1. Adds `eval "$(command wt shell-init <shell>)"` to your `~/.zshrc` or
   `~/.bashrc` (detected from `$SHELL`). This defines a `wt` shell function
   that wraps the binary and performs the actual `cd`
   > A subprocess can't change its parent shell's directory, so this wrapper is required for the auto-`cd` behavior.
2. Ensures your global git excludes file contains `.worktrees/`, so worktrees
   are ignored in every repo. It appends to `core.excludesfile` if set,
   otherwise to an existing `~/.config/git/ignore`, and only creates
   `~/.gitignore_global` when neither exists.
3. When run inside a git repo, also adds `.worktrees/` to that repo's
   `.git/info/exclude` (local-only, never committed). Some tools — biome, for
   one — read a repo's ignore files but not the global excludes, and would
   otherwise scan the worktrees. Rerun `wt install` in each repo where you
   want this.

After running it, open a new shell or `source` your rc file.

## Usage

```sh
# Interactive worktree switcher — pick one and you're there
wt

# Show all the commands
wt help

# Add a worktree and automatically cd into it.
#   - if the branch exists, it's checked out
#   - if it only exists on a remote, a local tracking branch is created
#     (a branch on multiple remotes errors and asks you to pick one)
#   - otherwise a new branch is created off the root worktree
#     (even when you run this from inside another worktree)
wt add feature-x

# Base the new branch off something else
wt add feature-x origin/main

# `.` means "base it off the worktree I'm standing in"
wt add feature-x .

# No name: move your *current* branch into its own worktree.
wt add

# List all worktrees (current is marked, dirty ones flagged)
wt list        # or: wt ls

# move to a worktree by name or branch (partial with frecency — a fragment is enough)
wt cd feature-x
wt feature-x       # shorthand for `wt cd feature-x`
wt                 # no args opens the interactive picker (same as `wt cd`)

# move to the previous worktree, toggling back and forth (like `cd -`)
wt cd -        # or just: wt -

# cd to the root (main) worktree
wt root
wt cd @        # equivalent. @ is a special alias for the main worktree
wt @           # also equivalent

# Remove a worktree. The directory is deregistered and moved out of the way
# instantly, then deleted in the background — the command returns immediately.
# Its branch is also deleted, but only if that's safe (its commits live on in
# another local or remote branch); otherwise the branch is kept.
wt rm feature-x

# Remove interactively (pick from a list)
wt rm                     # the longhand `wt remove` works too

# Remove the worktree but always keep its branch
wt rm feature-x -k        # or: --keep-branch

# Delete the branch even if its commits aren't anywhere else (may lose work)
wt rm feature-x -D        # or: --force-branch

# Force-remove a worktree with uncommitted changes
wt rm feature-x --force

# Prune every worktree whose branch is already merged into main (deletes those
# merged branches too). Dirty worktrees are skipped unless --force.
wt prune
wt prune --force

# Run a command inside another worktree without switching to it.
# Use `@` to target the main worktree. Everything after `--` is the command.
wt exec feature-x -- bun test
wt exec @ -- git status
```

Tab completion (worktree names for `rm`/`cd`/`exec`, branch names for `add`) is
set up automatically by `wt install` for zsh and bash.

### Flags

| Flag                   | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `-f`, `--force`        | Skip the dirty-worktree / checkout guard        |
| `-k`, `--keep-branch`  | Keep the branch (`rm` deletes it when safe)     |
| `-D`, `--force-branch` | Delete the branch even if commits would be lost |
| `-v`, `--version`      | Print version number                            |
| `-h`, `--help`         | Print help information                          |

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
    [ -n "$dir" ] || return 0
    cd "$dir"
  }
  ```

## Requirements

- **[Bun](https://bun.sh/docs/installation)** installed globally — `wt` runs
  straight from TypeScript, no build step
- **git 2.13+** (anything remotely modern)
- **zsh or bash** for the auto-`cd` shell wrapper and tab completion. Other
  shells can still use the binary directly; `wt shell-init` prints the wrapper
  to port
- macOS or Linux

## Development

> You must have [Bun](https://bun.sh/docs/installation) installed globally.

Install dependencies and point the global `wt` command at your local checkout:

```bash
bun install
bun link      # makes `wt` resolve to this local checkout
wt install    # one-time shell wrapper + global gitignore setup
```

Before finishing a change, run the typecheck + lint + test gate:

```bash
bun run pr
```
