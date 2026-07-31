/**
 * The single run-policy contract for the `agent:implement` pipeline (#556).
 *
 * Before this module the run policy both adapters must agree on — required env
 * vars, runaway-guard budgets, model, max-turns cap, and Claude Code CLI
 * version — was restated across the workflow, the compose file, the entrypoint's
 * `sudo --preserve-env` allowlist, the local supervisor's defaults, and the
 * invocation-assembly module. "Local is a faithful CI rehearsal" was an
 * invariant maintained by hand, and it had already slipped (the CI idle guard
 * was dropped in #540; the idle default disagreed 30-vs-10; the CLI froze at
 * different times on each side).
 *
 * Every consumer now derives from here: `implement.ts` passes {@link
 * REQUIRED_ENV_VARS} / {@link MODEL} / {@link MAX_TURNS} / {@link
 * IDLE_MINUTES} into `@galosandoval/shopfloor`'s `runImplementAgent`, which
 * validates env and resolves the idle budget itself (#576 — no local copy of
 * that logic); the local supervisor reads the wall-clock budget from
 * {@link resolveWallClockMs} (the one guard the package doesn't own, since
 * `runImplementAgent` enforces no wall clock of its own); and the shell
 * consumers (entrypoint, workflow install step, image build) read {@link
 * PRESERVE_ENV_VARS} and {@link CLAUDE_CODE_CLI_VERSION} through the {@link
 * runPolicyCommand} CLI print mode instead of duplicating them. No IO here —
 * pure values and derivations.
 */

/** Claude model the headless agent runs. */
export const MODEL = 'claude-opus-4-8'

/**
 * Fast-loop backstop cap on agent turns, layered on top of the idle guard and
 * the wall-clock guard. Sourced by the invocation-assembly module.
 */
export const MAX_TURNS = 150

/**
 * Pinned Claude Code CLI version, consumed by both the workflow install step
 * and the local image build so the rehearsal runs the exact CLI CI runs.
 * Unpinned before #556, the two sides froze at different times.
 */
export const CLAUDE_CODE_CLI_VERSION = '2.1.208'

/** Wall-clock runaway budget, in minutes. Overridable via `LOCAL_WALL_CLOCK_MINUTES`. */
export const WALL_CLOCK_MINUTES = 45

/**
 * Idle runaway budget, in minutes. Overridable via `LOCAL_IDLE_MINUTES`.
 * Restores the 900-second (15-minute) idle timeout #540 dropped when it removed
 * Sandcastle; both adapters now enforce it via the orchestrator.
 */
export const IDLE_MINUTES = 15

/**
 * Env vars the orchestrator must see, non-empty, before it spends any tokens.
 * Passed as `runPolicy.requiredEnvVars` into `runImplementAgent`, which
 * aborts the run at startup naming every missing one instead of surfacing
 * mid-run.
 */
export const REQUIRED_ENV_VARS = [
  'ISSUE_NUMBER',
  'ISSUE_TITLE',
  'BRANCH',
  // Subscription / flat-rate token — never ANTHROPIC_API_KEY (metered).
  'CLAUDE_CODE_OAUTH_TOKEN',
  // The integration suite + any TDD against the DB connect here.
  'DATABASE_PRISMA_URL',
  'DATABASE_URL_NON_POOLING',
  // App/suite paths the agent exercises during TDD and the verify phase.
  'NEXTAUTH_SECRET',
  'OPENAI_API_KEY',
  // The agent reads the issue and drives the verify flow through `gh`.
  'GH_TOKEN'
] as const

/**
 * Env vars the agent run consumes but can proceed without — each has a default
 * or is a passthrough override. Present here only so the preserve-env allowlist
 * covers them and a local `sudo` drop never silently strips them.
 */
export const OPTIONAL_ENV_VARS = [
  'STANDARDS_DIR',
  'OUTPUT_DIR',
  'AUTH_TRUST_HOST',
  'LOCAL_WALL_CLOCK_MINUTES',
  'LOCAL_IDLE_MINUTES'
] as const

/**
 * The `sudo --preserve-env` allowlist the local entrypoint must pass through:
 * every var the run reads, required or optional. Adding a var to the contract
 * can never again silently strip it from the local agent.
 */
export const PRESERVE_ENV_VARS = [
  ...REQUIRED_ENV_VARS,
  ...OPTIONAL_ENV_VARS
] as const

/** Parse a minutes override, falling back to `fallbackMinutes` unless it is a positive number. */
function resolveMinutesMs(
  raw: string | undefined,
  fallbackMinutes: number
): number {
  const parsed = Number(raw)
  const minutes =
    Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMinutes
  return minutes * 60_000
}

/** Wall-clock budget in ms — the contract default unless `LOCAL_WALL_CLOCK_MINUTES` overrides it. */
export function resolveWallClockMs(
  env: Record<string, string | undefined>
): number {
  return resolveMinutesMs(env.LOCAL_WALL_CLOCK_MINUTES, WALL_CLOCK_MINUTES)
}

/**
 * The CLI print mode: a shell consumer runs `bun run-policy.ts <subcommand>` to
 * read a contract value instead of restating it. Returns the value to print, or
 * an error string for an unknown subcommand.
 */
export function runPolicyCommand(
  argv: string[]
): { output: string } | { error: string } {
  switch (argv[0]) {
    case 'env-list':
      return { output: PRESERVE_ENV_VARS.join(',') }
    case 'cli-version':
      return { output: CLAUDE_CODE_CLI_VERSION }
    case 'model':
      return { output: MODEL }
    case 'max-turns':
      return { output: String(MAX_TURNS) }
    default:
      return {
        error: `Unknown run-policy subcommand: ${argv[0] ?? '(none)'}\nUsage: run-policy.ts <env-list|cli-version|model|max-turns>`
      }
  }
}

// True only when this file is the process entry (a shell consumer running
// `bun run-policy.ts <subcommand>`), never when imported as a module — kept as
// an argv check rather than `import.meta.main` so Jest's CJS wrapping parses it.
const invokedAsCli = process.argv[1]?.endsWith('run-policy.ts') ?? false

if (invokedAsCli) {
  const result = runPolicyCommand(process.argv.slice(2))
  if ('error' in result) {
    console.error(result.error)
    process.exit(1)
  }
  process.stdout.write(`${result.output}\n`)
}
