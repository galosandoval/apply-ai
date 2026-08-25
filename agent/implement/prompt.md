# Implement issue #{{ISSUE_NUMBER}}

**{{ISSUE_TITLE}}**

Read the issue with `gh issue view {{ISSUE_NUMBER}}` and implement what it
asks for. You are already on branch `{{BRANCH}}`; commit your work there.

Follow the `implement` skill for how to carry the work out, and this
repository's own conventions for what the result should look like:

- `docs/` — the decisions already made about this product's behaviour
  (`ats-score.md`, `editable-resume.md`, `resume-style.md`,
  `anti-fabrication-review.md`). Read the ones your change touches.
- `.claude/form-factor.md` — the UI's form-factor rules.
- **Tests are colocated** — `foo.test.ts` sits directly beside `foo.ts`, never
  under a `__tests__/` directory. Read the tests around the code you are
  changing before you write any: they are where this project's patterns are
  written down.

## What previous attempts left you

`{{ATTEMPTS_DIR}}` holds one file per previous attempt on this issue. Read
**all** of them before you start. Each separates the harness's own
observations, which are facts, from the previous agent's claims, which are not.
An empty or absent directory means this is the first attempt.

## What this run must leave behind

- The implementation, committed on `{{BRANCH}}`.
- The pull request description, written to `{{PR_DESCRIPTION_FILE}}`.
- What you verified and how, written to `{{VERIFY_REPORT_FILE}}`.
- Any screenshots, saved under `{{SCREENSHOTS_DIR}}`.
- Your own account of this attempt, written to `{{HANDOFF_CLAIMS_FILE}}`:
  what you tried, what you abandoned and why, what you believe the root cause
  is. Write it as you go — a run that is cut off still leaves what it had.

## Environment

<!-- shopfloor:environment -->

Install dependencies with `npm ci`.

This work is not done until `npm run typecheck && npm run lint && npm run test` passes.

Two Postgres databases are already running and reachable; both are ephemeral
and die with this run.

- `DATABASE_URL` is the app's. It exists so `src/env.ts` validates; nothing in
  the suite reads from it.
- `TEST_DATABASE_URL` is what the integration tests connect to.
  `src/server/db/test-database.ts` migrates it on first connect and truncates
  every table between cases, so there is no seed step and no migration step to
  run by hand. If your change needs a schema change, add it to `migrations/`
  with `npm run generate` (Drizzle) — never `npm run db:push`, which writes no
  migration for the next run to replay.

The DB-backed tests **skip themselves** when `TEST_DATABASE_URL` is unset. It
is set here, so a run that reports them as skipped has a broken connection, not
a passing suite.

For the verify phase, `e2e/` is a Playwright suite (`npm run test:e2e`,
configured by `playwright.config.ts`); Chromium is already installed. Commit
any screenshots you capture under `{{SCREENSHOTS_DIR}}` so they render inline
on the pull request.

<!-- /shopfloor:environment -->
