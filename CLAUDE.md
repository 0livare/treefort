# CLAUDE.md

`wt` — a CLI that makes git worktrees effortless (add / switch / remove, with
auto-`cd`). Worktrees live under `.wkt/<name>` at the repo root.

## Stack

- **Bun + TypeScript**, no build step — the bin (`wt`) points straight at `src/main.ts`.
- Only runtime dep is `chalk`. Args parsed with `node:util`'s `parseArgs`.
- **Biome** for formatting + linting. No CLI framework, no tests.

## Layout

- `src/main.ts` — entrypoint; parses args (`src/cli.ts`) and dispatches on the subcommand.
- `src/commands/*` — one named-function export per command, re-exported via `index.ts`.
- `src/git.ts` — all `git`/fs work, shelling out via `Bun.spawn`.
- `src/select.ts` — raw-mode interactive picker + `confirm()` prompt.
- `src/chalk.ts`, `src/helpers.ts` — shared color + output helpers.

## The stdout/stderr contract (important)

A subprocess can't `cd` its parent shell, so:

- **stderr** = all human output (progress, pickers, `list`).
- **stdout** = at most one line: a directory path for the shell to `cd` into.
- The `wt` shell function (from `wt install` / `wt shell-init`) captures that path
  and runs `cd`. `exec` and `shell-init` are passed through without capture.

Keep this split intact: never print human-facing text to stdout.

## Conventions

- Biome (`biome.json`): no semicolons, single quotes, 2-space indent, trailing
  commas, **no bracket spacing** (`{foo}` not `{ foo }`), 80-col width.
- Use the `node:` prefix on all Node builtin imports (`node:path`, `node:util`, …).
- Before finishing: `bun run pr` (runs `tsc` typecheck + `biome check --write .`).
  Also `bun run format`, `bun run lint`, `bun run check` for individual steps.

## Commits — Conventional Commits

Follow the [Conventional Commits](https://www.conventionalcommits.org) spec:

```
<type>: <short summary>
```

- Common types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`.
- Summary in the imperative mood, lowercase, no trailing period.
- Add a body (blank line, then wrapped prose) for non-trivial changes.
- Commit distinct changes separately — one logical change per commit.

Examples from this repo: `feat: add zsh tab completion`,
`refactor: use node: prefix for Node builtin imports`.
