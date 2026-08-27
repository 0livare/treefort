import {branchIsSafeToDelete, deleteBranch} from './git'
import {printError, printInfo, printSuccess, printWarning} from './helpers'
import {confirm, isInteractive} from './select'

// Delete `branch` and report the outcome, including the commit it pointed at
// so the user can recover it before it's garbage-collected.
export async function deleteBranchAndReport(branch: string): Promise<void> {
  const res = await deleteBranch(branch)
  if (res.code === 0)
    printSuccess(
      `deleted branch ${branch}${res.hash ? ` (was ${res.hash})` : ''}`,
    )
  else printError(res.stderr || `could not delete branch ${branch}`)
}

// Ask before deleting a removed worktree's branch. The safety check — do the
// branch's commits live on in another local branch or remote? — no longer
// decides on its own; it's reported to the user and picks the prompt's
// default (Y/n when safe, y/N when not). Without a terminal there's nobody to
// ask, so fall back to auto-deleting only when safe. Callers that already
// know deletion is safe (prune's merged-into-trunk check) pass `safe` and
// `safeReason` to skip the re-check and explain why.
export async function promptBranchDelete(
  branch: string,
  opts: {safe?: boolean; safeReason?: string; defaultYes?: boolean} = {},
): Promise<void> {
  const safe = opts.safe ?? (await branchIsSafeToDelete(branch))

  if (!isInteractive()) {
    if (safe) await deleteBranchAndReport(branch)
    else
      printWarning(
        `kept branch ${branch} — its commits aren't in any other branch (use --force-branch to delete anyway)`,
      )
    return
  }

  if (safe)
    printInfo(
      `branch ${branch} looks safe to delete — ${
        opts.safeReason ?? 'its commits live on in another branch or remote'
      }`,
    )
  else printWarning(`branch ${branch} has commits that exist nowhere else`)

  if (await confirm(`delete branch ${branch}?`, opts.defaultYes ?? safe))
    await deleteBranchAndReport(branch)
  else printInfo(`kept branch ${branch}`)
}
