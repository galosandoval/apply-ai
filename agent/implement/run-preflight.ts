import * as fs from 'node:fs'
import { runPreflight } from '@galosandoval/shopfloor'

// Thin invocation of `@galosandoval/shopfloor`'s `runPreflight` (#576): the
// package gathers the labeled issue's native parent/sub-issue links and the
// open PRs targeting it, evaluates the leaf-issue refusal gate, and — on
// refusal — swaps the labels and posts the explanatory comment. This script
// owns only the workflow-specific `$GITHUB_OUTPUT` signal that tells the
// `implement` job whether to run.

const ISSUE_NUMBER = required('ISSUE_NUMBER')
const REPO = required('GITHUB_REPOSITORY')

const { verdict } = await runPreflight({
  issueNumber: ISSUE_NUMBER,
  repo: REPO
})

if (verdict.refused) {
  setOutput('refused', 'true')
  console.log(`Pre-flight refused #${ISSUE_NUMBER}: ${verdict.reason}`)
} else {
  setOutput('refused', 'false')
  console.log(`Pre-flight passed for #${ISSUE_NUMBER}.`)
}

function setOutput(name: string, value: string) {
  const file = process.env.GITHUB_OUTPUT
  if (!file) {
    console.warn(`GITHUB_OUTPUT unset; would have written ${name}=${value}`)
    return
  }
  fs.appendFileSync(file, `${name}=${value}\n`)
}

function required(name: string) {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return value
}
