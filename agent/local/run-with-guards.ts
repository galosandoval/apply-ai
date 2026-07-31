import { spawn } from 'node:child_process'
import { resolveWallClockMs } from '../implement/run-policy'

/**
 * Local-only wall-clock guard for `agent:local` (#541, #556): a hard cap on the
 * whole run on top of `implement.ts`'s own `--max-turns` cap and the idle guard
 * the orchestrator now owns (#556 — so both adapters share it). CI already has
 * an equivalent wall-clock via the workflow's `timeout-minutes`; a local run has
 * no workflow wrapping it, so this process supervises the slow-but-still-working
 * failure mode itself. The budget comes from the run-policy contract
 * (env-overridable). Not unit-tested — a thin IO/process wrapper, verified by
 * running, matching how the repo treats the rest of its agent-pipeline IO
 * scripts.
 */

const WALL_CLOCK_MS = resolveWallClockMs(process.env)

const child = spawn('bun', ['agent/implement/implement.ts'], {
  stdio: ['inherit', 'pipe', 'pipe']
})

// implement.ts streams the CLI as `--output-format stream-json` (#556): one
// JSON event per line instead of a single blob printed at the very end.
// Pretty-print the events worth showing; anything unrecognized still passes
// through raw rather than getting swallowed, so a schema drift degrades to
// noisier output, never to silence.
let stdoutBuffer = ''
child.stdout.on('data', (chunk: Buffer) => {
  stdoutBuffer += chunk.toString('utf8')
  const lines = stdoutBuffer.split('\n')
  stdoutBuffer = lines.pop() ?? ''
  for (const line of lines) printStreamEvent(line)
})
child.stderr.on('data', (chunk: Buffer) => {
  process.stderr.write(chunk)
})

function printStreamEvent(line: string) {
  if (!line.trim()) return
  try {
    const summary = summarizeStreamEvent(JSON.parse(line))
    if (summary !== null) {
      console.log(summary)
      return
    }
  } catch {
    // Not JSON — stay resilient and fall through to raw passthrough.
  }
  console.log(line)
}

/** Returns a short progress line for events worth surfacing, or `null` to
 *  stay quiet for events with nothing new to show the maintainer. */
function summarizeStreamEvent(event: any): string | null {
  if (event.type === 'system' && event.subtype === 'init') {
    return '[session started]'
  }
  if (event.type === 'stream_event') {
    const block = event.event?.content_block
    if (
      event.event?.type === 'content_block_start' &&
      block?.type === 'tool_use'
    ) {
      return `[tool] ${block.name}`
    }
    return null
  }
  if (event.type === 'result') {
    return `[result] ${event.subtype ?? ''}${event.is_error ? ' (error)' : ''}`.trim()
  }
  return null
}

let killedFor: string | null = null

function killForTimeout(kind: string, ms: number) {
  if (killedFor) return
  killedFor = kind
  console.error(
    `\nFAILED: local ${kind} guard tripped after ${Math.round(ms / 60_000)} minute(s) — killing the agent.`
  )
  child.kill('SIGKILL')
}

const wallClockTimer = setTimeout(
  () => killForTimeout('wall-clock', WALL_CLOCK_MS),
  WALL_CLOCK_MS
)

const exitCode: number = await new Promise((resolve) => {
  child.on('close', (code) => resolve(code ?? 1))
})

clearTimeout(wallClockTimer)

// A guard kill still exits non-zero via the child's own SIGKILL exit code,
// but make the reason unambiguous in the log regardless of that exit code.
if (killedFor) {
  console.error(`FAILED: killed by the local ${killedFor} guard.`)
}

process.exit(killedFor ? 1 : exitCode)
