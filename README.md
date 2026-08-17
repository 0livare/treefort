# Treefort - git worktrees without the work 🌳

<p align="center">
<img width="550" alt="treefort interactive worktree selector" src="https://github.com/user-attachments/assets/e6a45bfc-aec8-4868-af10-41ec3e505d56" />
</p>

Git worktrees let you check out multiple branches at once, each in its own directory. AI has skyrocketed the use of worktrees so that multiple agents can work simultaneously without stepping on each other's toes.

But the raw `git worktree` commands are clunky. You have manage all the file paths yourself:

- come up with the paths
- remember the paths
- `cd` back and forth between them
- clean them up yourself when you're done

Treefort makes worktrees effortless. **Add, switch, and remove worktrees in a single
command and land in the right directory automatically.**

```sh
wt add feature-x     # create it, automatically cd'd into it   --> pwd: <repo>/.worktrees/feature-x
wt root              # jump back to the root worktree          --> pwd: <repo>
wt feat              # jump back to feature-x later            --> pwd: <repo>/.worktrees/feature-x
wt rm                # gone, instantly                         --> pwd: <repo>
```

<img width="562" height="246" alt="treefort live demo" src="https://github.com/user-attachments/assets/c3b50877-97e8-44fc-8b9e-720dd623b145" />

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Why you'll like it](#why-youll-like-it)
  - [🏃 You end up _inside_ the worktree every time](#-you-end-up-inside-the-worktree-every-time)
  - [💅 Worktrees live inside the repo, where they belong](#-worktrees-live-inside-the-repo-where-they-belong)
  - [🧠 Partial + frecency navigation, like `zoxide` for worktrees](#-partial--frecency-navigation-like-zoxide-for-worktrees)
  - [🎛 An interactive picker, one keystroke away](#-an-interactive-picker-one-keystroke-away)
  - [🌿 Your env files come along for free](#-your-env-files-come-along-for-free)
  - [⚡ Removal returns _immediately_](#-removal-returns-immediately)
  - [🛟 Branch cleanup that won't lose your work](#-branch-cleanup-that-wont-lose-your-work)
  - [🧹 Sweep up merged work in one shot](#-sweep-up-merged-work-in-one-shot)
  - [🌱 Turn your current branch into a worktree](#-turn-your-current-branch-into-a-worktree)
  - [🔭 Reach into a worktree without leaving yours](#-reach-into-a-worktree-without-leaving-yours)
  - [🤖 Claude Code Integration](#-claude-code-integration)
- [Installation](#installation)
- [Usage](#usage)
- [How the auto-`cd` works](#how-the-auto-cd-works)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [Command reference](#command-reference)
  - [wt cd](#wt-cd)
  - [wt add](#wt-add)
  - [wt rm](#wt-rm)
  - [wt rename](#wt-rename)
  - [wt prune](#wt-prune)
  - [wt list](#wt-list)
  - [wt status](#wt-status)
  - [wt root](#wt-root)
  - [wt exec](#wt-exec)
  - [wt ff](#wt-ff)
  - [wt claude](#wt-claude)
  - [wt install](#wt-install)
  - [wt shell-init](#wt-shell-init)
  - [wt help](#wt-help)
  - [wt version](#wt-version)
  - [Global flags](#global-flags)

<!-- END doctoc -->

## Why you'll like it

### 🏃 You end up _inside_ the worktree every time

No remembering where the thing lives. No manual `cd ../worktrees/foobar` annoyances.

`wt add`, `wt cd`, and the interactive picker all drop your shell straight into the right directory. You don't have to think about it.

### 💅 Worktrees live inside the repo, where they belong

Having worktrees live as siblings to the repo (or worse somewhere else entirely) is an organizational mess. Treefort keeps them tucked away in a `.worktrees/` directory inside your repo, that is automatically ignored by git.

> Treefort works equally well with worktrees that you've created via Claude or any other method

Bare-clone layouts work too: run wt inside a bare repo and worktrees land in a `.worktrees/` directory there, with new branches forked from the trunk.

### 🧠 Partial + frecency navigation, like `zoxide` for worktrees

You don't type paths. You don't even have to type full names. Type a fragment and `wt` finds it:

```sh
wt reg    # matches regularExpressionParser or codeFirstEndpointRegistry or coreRegularizer
wt cd reg # equivalent. cd is the default command when one isn't specified
```

When a fragment matches more than one worktree, `wt` picks the one you actually mean, ranked by **frecency** (how _frequently_ and _recently_ you've visited it). The worktrees you live in float to the top; the ones you forgot about sink.

### 🎛 An interactive picker, one keystroke away

Forgot the name entirely? Just run `wt` with no arguments and pick from a list. Same for removing them.

```sh
wt      # pick a worktree from a list, then automatically cd into it
```

### 🌿 Your env files come along for free

A fresh worktree only gets what git tracks, so your gitignored `.env` files stay behind and nothing runs. `wt add` fixes that: it scans the main worktree (the root plus three levels down, skipping dotdirs and `node_modules`) and copies every `.env*` file — `.env`, `.env.local`, `.env.<mode>`, and friends — into the new worktree at the same relative path. Anything git already checked out is left untouched. No config, no flags, just a worktree that works on the first `cd`.

### ⚡ Removal returns _immediately_

`wt rm` deregisters the worktree and moves it out of the way _instantly_, then deletes the files in the background. Your prompt comes back _**now**_ — not in 30s after `rm -rf` finishes churning through `node_modules`.

```bash
npm install   # no waiting for node_modules to be deleted later

wt rm <partial> # same partial frecency matching as `wt` & `wt cd`
                # (a partial match asks y/n first)

wt rm         # with no args either removes the current worktree
              # or opens the interactive picker (if you're at the root worktree)
```

### 🛟 Branch cleanup that won't lose your work

`wt rm feature-x` removes the worktree and asks whether to delete its branch — telling you first whether that's safe, meaning the branch's commits already live on in another branch so nothing is lost. The safety check picks the prompt's default: `Y/n` when deleting is safe, `y/N` when the changes exist nowhere else. Without a terminal (scripts), the branch is deleted only when safe.

> **Squash Merges** are detected by patch-equivalence against the trunk

Need to skip the prompt? `--keep-branch` (`-k`) always keeps it; `--force-branch` (`-D`) deletes it even if commits would be lost.

### 🧹 Sweep up merged work in one shot

Shipped a batch of features? `wt prune` removes _every_ worktree whose branch is already merged into `main` — true merges _and_ squash merges (GitHub's default), which ordinary `git branch --merged` can't see — asking before deleting each merged branch (Enter accepts, since merged means safe). Dirty worktrees are left untouched (pass `--force` to include them). One command and your `.worktrees/` is back to just the things you're still working on.

### 🌱 Turn your current branch into a worktree

Want to create a worktree around an existing branch? No problem. Run `wt add` with no name and your current branch graduates into a fresh worktree (supplying a branch name also works), freeing up the main worktree behind you.

### 🔭 Reach into a worktree without leaving yours

```sh
wt exec git pull --ff-only     # no target -> runs in the main (root) worktree
wt ff                          # shorthand for the above

wt exec feature-x -- bun test  # wk exec <other worktree> -- <command to run in other worktree>
wt exec @ -- git fetch         # @ and root both mean the main worktree
```

With no target the command runs in the root worktree, so `wt exec <command>` just works. To aim at another worktree, put its name before a `--` separator; everything after `--` is the command, flags and all.

> `@`, `root`, and `-`, can be used as the name as well, resolved exactly like `wt cd`.

### 🤖 Claude Code Integration

Claude Code keys every session to the directory it runs in, which makes worktrees awkward:

> Sessions started in a worktree are stored under that worktree's own project directory, and the `claude --resume` picker defaults to the current directory's sessions — so from the repo root, worktree sessions are invisible. Claude also can't reopen a worktree by name (`claude --worktree`) unless it lives under `.claude/worktrees/` inside the repo.

Treefort helps on both fronts:

- It detects when you're using Claude in a repo and creates new worktrees under `.claude/worktrees/` instead of the default `.worktrees/`, so Claude can always reopen them by name (and recent Claude versions can widen the resume picker to the whole repo with `Ctrl+W`).
- `wt claude --resume` gathers every session in the repo — the root's, every worktree's, even those whose worktree has since been removed — into one picker, and resumes your choice from the directory it ran in.

There's also the `wt claude` command itself, for choosing a worktree to open Claude in (similar to `claude --worktree` but interactive).

```sh
wt claude                            # open the worktree you're in, or pick from a list at the root
wt claude feature-x                  # or name one — offers to create it if it doesn't exist
wt claude feature-x --model opus     # open feature-x, forward --model opus
wt claude --resume                   # resume any session in the repo, whichever worktree it ran in
wt claude -- -p 'run the tests'      # no name, forward the prompt verbatim
```

## Installation

> ### Prerequisite - Bun
>
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
2. Ensures your global git excludes file ignores treefort's `.worktrees/`
   directories, so worktrees are ignored in every repo. It appends to
   `core.excludesfile` if set, otherwise to an existing `~/.config/git/ignore`,
   and only creates `~/.gitignore_global` when neither exists.
3. When run inside a git repo, also ignores them in that repo's
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
```

That's the gist. Every command, its aliases, and every flag are documented in
the [Command reference](#command-reference) at the bottom of this README.

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

Commands whose stdout belongs to something else — `exec`, `claude`, and
`shell-init` — are passed straight through by the wrapper instead of being
captured, so the program they run keeps the terminal.

> Adding a passthrough command means the wrapper changes, so re-run
> `wt install` (or `source` your rc file) after upgrading.

## Requirements

- **[Bun](https://bun.sh/docs/installation)** installed globally — `wt` runs
  straight from TypeScript, no build step
- **git 2.13+** (anything remotely modern)
- **zsh or bash** for the auto-`cd` shell wrapper and tab completion. Other
  shells can still use the binary directly; `wt shell-init` prints the wrapper
  to port
- macOS or Linux

## Contributing

Bug reports and pull requests are welcome. See
[CONTRIBUTING.md](CONTRIBUTING.md) for local setup, the typecheck/lint/test
gate, the project conventions, and how to regenerate the table of contents at
the top of the README.

## Command reference

### wt cd

Move to a worktree and land in its directory. `cd` is `wt`'s default command, so
`wt <name>` is shorthand for `wt cd <name>` and bare `wt` opens the picker.

- **Bare `wt`** (no target) opens the interactive picker, ordered by frecency
  with the cursor on the top worktree that isn't the current one. In a repo with
  only the root worktree it tells you to run `wt add` instead.
- **`wt cd <name>`** resolves the target by exact name or branch first, then by
  fuzzy partial match; when several match, the highest-**frecency** one wins
  (how _frequently_ and _recently_ you've visited it). No match offers to create
  a worktree with that name (interactive only).
- **`wt cd -`** (or `wt -`) toggles back to the previous worktree, like `cd -`.
- **`wt cd @`**, **`wt cd root`**, **`wt @`**, **`wt root`** all go to the main
  (root) worktree.

```sh
wt cd feature-x
wt reg             # partial match, frecency-ranked
wt -               # previous worktree
wt @               # root worktree
```

### wt add

Create a worktree — and its branch, unless it already exists — copy over
gitignored env files, and `cd` into it. Usage: `wt add [name] [start-point]`.

When a `name` is given, the branch is resolved in this order:

- an existing **local** branch is checked out as-is (a start-point is rejected);
- a branch that only exists **on a remote** is checked out as a local tracking
  branch (a branch on multiple remotes errors and asks you to pick
  `remote/branch`);
- otherwise a **new branch** is forked off the root worktree — even when you run
  this from inside another worktree.

Extra behavior:

- **`start-point`** bases a new branch off something else. `.` means "off the
  worktree I'm standing in" (its `HEAD`). It only applies when creating a branch.
- **No name** (`wt add`) graduates your _current_ branch into its own worktree,
  freeing the main worktree behind you. It refuses the trunk branch
  (`main`/`master`).
- If the wanted branch is held by the main or current worktree, `wt` frees it
  there first (checks out the trunk or the worktree's own name branch, else
  detaches). Freeing a **dirty** worktree needs `-f`/`--force`.
- Gitignored `.env*` files are copied from the main worktree into the new one
  (bare roots have nothing to copy).

**Flags**

- `-f`, `--force` — free the holding worktree even when it has uncommitted
  changes (its branch is checked out somewhere dirty).

```sh
wt add feature-x               # new branch off root, cd in
wt add feature-x origin/main   # base the new branch off origin/main
wt add feature-x .             # base it off the current worktree's HEAD
wt add                         # move the current branch into its own worktree
```

### wt rm

Remove a worktree. The directory is deregistered and moved out of the way
**instantly**, then deleted in the background — the command returns immediately,
even with a huge `node_modules`. Alias: `wt remove`.

- **Target** resolves like `wt cd` (exact name/branch, then fuzzy frecency), but
  because removal is destructive a fuzzy hit asks `y/N` first, and without a
  terminal an exact name is required. With **no name** it removes the current
  worktree or, from the root, opens the picker.
- **Dirty worktrees**: on a terminal `wt` shows the pending changes and asks to
  remove anyway; non-interactively it errors and points at `--force`. `-f`/
  `--force` skips the guard.
- **Branch deletion**: by default `wt` asks whether to delete the branch, with a
  safety check — do its commits already live on in another local or remote
  branch (squash merges are detected by patch-equivalence)? The prompt defaults
  to yes only when deleting is safe. `-k`/`--keep-branch` never deletes;
  `-D`/`--force-branch` deletes unconditionally.

**Flags**

- `-f`, `--force` — remove even with uncommitted changes (skip the dirty guard).
- `-k`, `--keep-branch` — keep the branch (skip the delete-branch prompt).
- `-D`, `--force-branch` — delete the branch unconditionally, even if commits
  would be lost.

```sh
wt rm feature-x            # remove, then asked about the branch
wt rm                      # current worktree, or the picker at the root
wt rm feature-x -k         # keep the branch, no questions
wt rm feature-x -D         # delete the branch even if commits would be lost
wt rm feature-x --force    # remove despite uncommitted changes
```

### wt rename

Rename a worktree and — when the branch still carries the worktree's name —
rename the branch in lockstep, moving the directory too. Alias: `wt mv`. Usage:
`wt rename [old] <new>`.

- **`wt rename <new>`** renames the worktree you're in; **`wt rename <old>
  <new>`** names both ends explicitly.
- The worktree stays in its current home (`.worktrees` or `.claude/worktrees`),
  so a nested name like `feat/x` moves within the same tree. It refuses to
  rename the root worktree or to a trunk name.
- Frecency ranking and the `wt cd -` pointer follow the move, and `wt` cds along
  when you rename the worktree you're standing in.

```sh
wt rename feature-x feature-y
wt rename feature-y          # rename the current worktree
wt mv feature-x feature-y
```

### wt prune

Remove **every** worktree whose branch is already merged into the trunk
(`main`/`master`) — true merges _and_ squash merges (GitHub's default), which
plain `git branch --merged` can't see. It asks before deleting each merged
branch (Enter accepts, since merged means nothing is lost; branches are
auto-deleted when there's no terminal to ask). Dirty worktrees are skipped
unless `--force`.

**Flags**

- `-f`, `--force` — include worktrees with uncommitted changes.

```sh
wt prune
wt prune --force   # include worktrees with uncommitted changes
```

### wt list

List every worktree. Alias: `wt ls`. The current worktree is marked with a bold
`❯`, worktrees with uncommitted changes are flagged `● dirty`, and — while the
repo holds both kinds — `◆ claude` marks the ones `wt claude` can address by
name.

```sh
wt list
wt ls
```

### wt status

Show everything about the worktree your shell is in: its name, branch (with
upstream and ahead/behind drift), `HEAD` commit, working-tree state (clean or
_N_ files changed), and where it sits on disk — plus a footer placing it among
the repo's other worktrees. A pure read; it never moves your shell. Alias:
`wt st`.

```sh
wt status
wt st
```

### wt root

`cd` to the main (root) worktree. Equivalent to `wt cd @` / `wt @`.

```sh
wt root
```

### wt exec

Run a command inside a worktree without switching to it. Usage:
`wt exec [name --] <command>`.

With no target the command runs in the **root** worktree, so `wt exec <command>`
just works. To aim at another worktree, put its name before a `--` separator;
everything after `--` is the command, flags and all. The target resolves exactly
like `wt cd` (`@`/`root` = main, `-` = previous, else exact-then-fuzzy match).
The command's exit code is forwarded.

```sh
wt exec git pull --ff-only     # runs in the root worktree
wt exec feature-x -- bun test  # runs in feature-x
wt exec @ -- git status        # @ is the root worktree
```

### wt ff

Fast-forward a worktree's branch from its upstream (`git pull --ff-only`). With
no target it uses the **root** worktree — a shorthand for
`wt exec git pull --ff-only`. Any target resolves like `wt cd`. A detached
`HEAD` (no branch to fast-forward) errors cleanly.

```sh
wt ff              # fast-forward the root worktree
wt ff feature-x    # fast-forward another worktree in place
```

### wt claude

Open a [Claude Code](https://www.anthropic.com/claude-code) session inside a
worktree, without switching to it. Usage:
`wt claude [name] [claude-flags]`.

- **No name** opens the worktree you're in; run from the root worktree it opens
  the interactive picker instead — which includes the root, for a session in the
  repo itself. A name that has no worktree yet offers to create it.
- **Outside a git repository** it just runs `claude` in the current directory,
  forwarding any arguments — so `wt claude` is a safe drop-in for `claude`.
- The first bare word is the target worktree; every other argument is forwarded
  to Claude as given. A `--` forwards everything after it verbatim, hyphen or
  not.
- `wt claude --help` explains these forwarding rules; `wt claude -- --help`
  reaches Claude's own help.
- **`--resume` (or `-r`)** picks from every session in the repo. Claude keys
  each session to the directory it ran in, so a worktree's sessions never
  appear in the root's default `claude --resume` list — this flag aggregates
  them all: the root's, every worktree's, and those of worktrees that have
  since been removed (resumed from the root instead). A bare name scopes the
  list to one worktree, and a lone candidate resumes immediately, no picker.
  `wt claude -- --resume` reaches Claude's own per-directory picker.
- Claude is always launched from the repo root. A worktree under
  `.claude/worktrees/` is reopened there by name (via `claude --worktree`); the
  root opens itself. Any other worktree can't be addressed from the root, so
  `wt claude` warns and opens the repo root in its place. (This is why `wt add`
  puts new worktrees under `.claude/worktrees/` in Claude repos.)

```sh
wt claude feature-x
wt claude feature-x --model opus   # flags after the name go to Claude
wt claude --resume                 # pick from every session in the repo
wt claude feature-x --resume       # only feature-x's sessions
wt claude -- -p 'run the tests'    # no name, forward the prompt verbatim
```

### wt install

One-time, idempotent setup. It:

1. Adds `eval "$(command wt shell-init <shell>)"` to your `~/.zshrc` or
   `~/.bashrc` (detected from `$SHELL`), defining the `wt` shell function that
   performs the auto-`cd` and enabling tab completion (worktree names for
   `rm`/`rename`/`cd`/`exec`/`claude`, branch names for `add`).
2. Ensures your global git excludes ignore treefort's worktree directories, so
   worktrees are ignored in every repo.
3. When run inside a repo, also ignores them in that repo's `.git/info/exclude`
   (local-only, never committed) so tools like Biome don't scan them. Re-run it
   in each repo where you want that.

```sh
wt install
```

### wt shell-init

Print the shell wrapper and tab completion for
`eval "$(command wt shell-init <shell>)"`. `shell` is `zsh` or `bash`, defaulting
from `$SHELL` (then `zsh`). `wt install` wires this up for you; run it directly
to port the wrapper to another shell.

```sh
wt shell-init zsh
```

### wt help

Print the full command, example, and flag reference. `-h`/`--help` do the same.

### wt version

Print the version number. `-v`/`--version` do the same.

### Global flags

Handled before any command runs, so they work anywhere. The flags each command
takes are documented under that command above.

| Flag              | Description              |
| ----------------- | ------------------------ |
| `-v`, `--version` | Print the version number |
| `-h`, `--help`    | Print help information   |
