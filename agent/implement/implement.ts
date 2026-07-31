import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { runImplementAgent, ImplementAgentError } from '@galosandoval/shopfloor'
import {
  MODEL,
  MAX_TURNS,
  CLAUDE_CODE_CLI_VERSION,
  IDLE_MINUTES,
  WALL_CLOCK_MINUTES,
  REQUIRED_ENV_VARS
} from './run-policy'

// Orchestrator entry point for the `agent:implement` pipeline (#576): a thin
// invocation of `@galosandoval/shopfloor`'s `runImplementAgent`, supplying
// recipe-chat-v1's own run-policy contract (run-policy.ts) and prompt.md. The
// package validates the env contract, spawns the Claude CLI, owns the runaway
// guards, captures the transcript, and checks for a zero-commit run; this
// script owns translating a failure into CI-glue (failure_reason.txt, exit 1).

const ISSUE_NUMBER = process.env.ISSUE_NUMBER as string
const ISSUE_TITLE = process.env.ISSUE_TITLE as string
const BRANCH = process.env.BRANCH as string
/** Subscription / flat-rate token — never `ANTHROPIC_API_KEY` (metered). */
const CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN as string

/**
 * Absolute path to the coding-standard rules (the skills repo's rules/, cloned
 * by the workflow). Optional: empty on a local run, in which case the prompt
 * skips the standards step. Lives outside the repo so it never enters a commit.
 */
const STANDARDS_DIR = process.env.STANDARDS_DIR ?? ''

/**
 * Directory for agent outputs the PR needs but a commit must not contain (the
 * PR description, failure reason). Lives outside the repo so they never land in
 * a commit; the workflow reads them back.
 */
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? os.tmpdir()

/**
 * Verify-phase screenshots dir (#523), a repo-relative path the agent commits
 * PNGs into, so they get raw URLs for inline rendering in the issue comment.
 */
const SCREENSHOTS_DIR = `.agent/verify/issue-${ISSUE_NUMBER}`

/** Claude Code's session store: `$HOME/.claude/projects/<encoded-cwd>/<id>.jsonl`. */
const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')

// Resolved against process.cwd() (the repo root, where the workflow invokes us).
const promptTemplate = fs.readFileSync(
  path.join('agent', 'implement', 'prompt.md'),
  'utf8'
)

try {
  const result = await runImplementAgent({
    issueNumber: ISSUE_NUMBER,
    issueTitle: ISSUE_TITLE,
    branch: BRANCH,
    claudeCodeOAuthToken: CLAUDE_CODE_OAUTH_TOKEN,
    standardsDir: STANDARDS_DIR,
    promptTemplate,
    prDescriptionFile: path.join(OUTPUT_DIR, 'pr_description.txt'),
    verifyReportFile: path.join(OUTPUT_DIR, 'verify_report.md'),
    screenshotsDir: SCREENSHOTS_DIR,
    transcriptFile: path.join(OUTPUT_DIR, 'transcript.jsonl'),
    projectsDir: PROJECTS_DIR,
    runPolicy: {
      model: MODEL,
      maxTurns: MAX_TURNS,
      cliVersion: CLAUDE_CODE_CLI_VERSION,
      idleMinutes: IDLE_MINUTES,
      wallClockMinutes: WALL_CLOCK_MINUTES,
      requiredEnvVars: REQUIRED_ENV_VARS
    }
  })

  if (result.prDescription === 'fallback') {
    console.warn('No PR description written by the agent; a fallback was used.')
  }
  console.log(`\n${result.commitsAhead} commit(s) on ${BRANCH} this run.`)
} catch (error) {
  const message =
    error instanceof ImplementAgentError
      ? `${error.message}${error.outputTail ? `\n\n${error.outputTail}` : ''}`
      : String(error)
  console.error(`\nFAILED: ${message}`)
  fs.writeFileSync(path.join(OUTPUT_DIR, 'failure_reason.txt'), message)
  process.exit(1)
}
