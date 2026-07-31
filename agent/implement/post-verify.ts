import * as os from 'node:os'
import * as path from 'node:path'
import { postVerifyComment } from '@galosandoval/shopfloor'

/**
 * Thin invocation of `@galosandoval/shopfloor`'s `postVerifyComment` (#576):
 * the package reads the agent's verify report, enumerates the committed
 * screenshots, builds the comment, and posts it via `gh pr comment`.
 *
 * Best-effort by contract: verify never blocks the PR, so `postVerifyComment`
 * swallows its own errors — this script only logs the outcome.
 */

const ISSUE_NUMBER = required('ISSUE_NUMBER')
const REPO = required('GITHUB_REPOSITORY')
const PR_NUMBER = required('PR_NUMBER')
const SHA = required('SHA')
const RUN_URL = process.env.RUN_URL ?? ''

const OUTPUT_DIR = process.env.OUTPUT_DIR ?? os.tmpdir()
const VERIFY_REPORT_FILE =
  process.env.VERIFY_REPORT_FILE ?? path.join(OUTPUT_DIR, 'verify_report.md')

/** Repo-relative dir holding the committed PNGs (also where raw URLs point). */
const SCREENSHOTS_DIR =
  process.env.SCREENSHOTS_DIR ?? `.agent/verify/issue-${ISSUE_NUMBER}`

const result = await postVerifyComment({
  issueNumber: ISSUE_NUMBER,
  repo: REPO,
  prNumber: PR_NUMBER,
  sha: SHA,
  runUrl: RUN_URL,
  verifyReportFile: VERIFY_REPORT_FILE,
  screenshotsDir: SCREENSHOTS_DIR,
  commentFile: path.join(OUTPUT_DIR, 'verify_comment.md')
})

if (result.posted) {
  console.log(
    `Posted verify comment to PR #${PR_NUMBER} (${result.screenshotCount} screenshot(s)).`
  )
} else {
  // Never fail the run over the comment — implement commits already landed.
  console.warn(`Could not post verify comment: ${String(result.error)}`)
}

function required(name: string) {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return value
}
