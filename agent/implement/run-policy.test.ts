/**
 * @jest-environment node
 */
import {
  CLAUDE_CODE_CLI_VERSION,
  MAX_TURNS,
  MODEL,
  OPTIONAL_ENV_VARS,
  PRESERVE_ENV_VARS,
  REQUIRED_ENV_VARS,
  resolveWallClockMs,
  runPolicyCommand
} from './run-policy'

describe('run-policy contract', () => {
  describe('preserve-env allowlist', () => {
    it('covers every required and optional var', () => {
      expect(PRESERVE_ENV_VARS).toEqual([
        ...REQUIRED_ENV_VARS,
        ...OPTIONAL_ENV_VARS
      ])
    })

    it('has no duplicate names', () => {
      expect(new Set(PRESERVE_ENV_VARS).size).toBe(PRESERVE_ENV_VARS.length)
    })
  })

  describe('budget resolution', () => {
    it('falls back to the contract wall-clock default when unset', () => {
      expect(resolveWallClockMs({})).toBe(45 * 60_000)
    })

    it('honors a positive numeric env override', () => {
      expect(resolveWallClockMs({ LOCAL_WALL_CLOCK_MINUTES: '20' })).toBe(
        20 * 60_000
      )
    })

    it('falls back when the override is empty, non-numeric, or non-positive', () => {
      expect(resolveWallClockMs({ LOCAL_WALL_CLOCK_MINUTES: '-5' })).toBe(
        45 * 60_000
      )
    })
  })

  describe('CLI print mode', () => {
    it('env-list emits the preserve-env allowlist the exports declare', () => {
      expect(runPolicyCommand(['env-list'])).toEqual({
        output: PRESERVE_ENV_VARS.join(',')
      })
    })

    it('cli-version emits the pinned Claude Code CLI version', () => {
      expect(runPolicyCommand(['cli-version'])).toEqual({
        output: CLAUDE_CODE_CLI_VERSION
      })
    })

    it('model emits the contract model id', () => {
      expect(runPolicyCommand(['model'])).toEqual({ output: MODEL })
    })

    it('max-turns emits the contract max-turns cap', () => {
      expect(runPolicyCommand(['max-turns'])).toEqual({
        output: String(MAX_TURNS)
      })
    })

    it('reports an error for an unknown subcommand', () => {
      const result = runPolicyCommand(['nope'])
      expect('error' in result).toBe(true)
    })
  })
})
