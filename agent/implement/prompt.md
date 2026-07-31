# TASK

Implement issue #{{ISSUE_NUMBER}}: {{ISSUE_TITLE}}

You are on branch `{{BRANCH}}`, already created from `main`. Pull the issue
in full with its discussion:

```
gh issue view {{ISSUE_NUMBER}} --comments
```

If the issue references a parent PRD or blocking issues, pull those in too
(`gh issue view <N> --comments`) so you understand the intended slice and scope.

# HEADLESS — there is no human in this loop

This run is fully autonomous. Nobody will review interactively or approve steps.

- Do the work and **commit it yourself** once the quality gate is green.
- Do **not** wait for approval and do **not** ask questions — decide and proceed.
- Do **not** close the issue and do **not** open the PR — the workflow does that.
- Stay within the issue's scope. If a blocker makes the issue impossible, stop
  and explain why in the PR description file (final step) rather than guessing.

# CONTEXT

Before changing anything, read the project's domain docs if they exist:

- `CONTEXT.md` at the repo root (the glossary / ubiquitous language).
- Relevant ADRs under `docs/adr/`.

If those files don't exist, proceed silently — don't flag their absence.

Then explore the area you'll change and fill your context with the relevant
parts. **Tests are colocated** — the test file sits directly beside the prod
file (no `__tests__/` directories). Read the colocated tests around the code
you'll touch; they show the established patterns to follow.

# CODING STANDARDS

If `{{STANDARDS_DIR}}` is non-empty and exists, read the markdown files in it
before writing code and conform to the ones relevant to the languages you're
changing (each file's `paths` frontmatter says which files it governs). They are
the project owner's TypeScript / React / Prisma conventions — treat them as
binding. If `{{STANDARDS_DIR}}` is empty or missing, proceed without it.

# DATABASE

A Postgres + pgvector database is already running and migrated. The integration
suite connects via `DATABASE_PRISMA_URL` / `DATABASE_URL_NON_POOLING` (already
set in the environment). The Prisma client is generated and all migrations are
applied. If your change needs a schema change, create the migration with
`bunx prisma migrate dev --name <name>` (never `db push`), then continue.

# EXECUTION — test-driven

Use red-green-refactor:

1. **RED** — write one failing test that pins the next piece of behavior.
2. **GREEN** — write the minimum code to make it pass.
3. **REPEAT** until the issue's acceptance criteria are met.
4. **REFACTOR** — clean up with the tests green.

Backend / Node tests need the `@jest-environment node` docblock at the top of
the test file (the default environment is jsdom).

# QUALITY GATE — run before every commit, fix and rerun until clean

Everything is Bun (`bun install`, `bunx …`, `bun run …`). Run, in order:

1. `bun run typecheck`
2. `bun run lint`
3. `bun run format`
4. `bun run test`

If any step fails, fix the cause and rerun the whole gate from the top. Only
commit when all four pass.

# COMMIT

Make one or more commits on `{{BRANCH}}` with conventional-commit messages
(`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`). Keep commits
focused. Do not amend or force-push; just add commits.

# VERIFY — prove it works (best-effort, never blocks the PR)

After your green-gate commits, prove the change actually works for a user. This
runs on top of the project's Playwright e2e harness (`playwright.config.ts`, the
`e2e/` directory, the shared auth fixture in `e2e/auth.setup.ts`, and the
`bun run test:e2e` script). The database is already seeded with the user
`alice@prisma.io` (one recipe), so login and populated-state assertions are
deterministic — do **not** re-script login or app boot; reuse the fixture.

**1. Judge UI-verifiability.** From the issue's acceptance criteria, decide
whether the change is observable in the running app (a screen renders, an
interaction works). Backend-only / infra / tooling changes are **not**
UI-verifiable.

**2a. If it IS UI-verifiable** — write a durable spec, run it, capture proof:

- Add or extend a spec under `e2e/` (e.g. `e2e/<feature>.spec.ts`) that drives
  the issue's user flow through the real app and asserts on what the user sees
  (never on internal state). This is a real regression test that stays in the
  repo — part of your TDD, not a throwaway script. It reuses the authenticated
  `storageState` from the `chromium` project, so it starts already logged in.
- In the spec, capture a screenshot of the final working state of each
  user-facing acceptance criterion (and a failure-state shot if you hit one)
  with `await page.screenshot({ path: '{{SCREENSHOTS_DIR}}/<criterion>.png' })`.
  Use the exact directory `{{SCREENSHOTS_DIR}}` — the workflow reads PNGs there.
- Re-seed the database with `bun run seed` immediately before running the
  browser (your integration tests during the gate truncate the tables, so the
  seeded user must be restored), then run `bun run test:e2e` (Playwright boots
  the built app via its `webServer` against the seeded DB). Fix the spec until
  it passes.
- **Commit** the new/updated `e2e/` spec **and** the PNGs under
  `{{SCREENSHOTS_DIR}}` onto `{{BRANCH}}` (the screenshots are committed on
  purpose so they get a raw URL and render inline on the PR — the workflow
  strips them off the branch tip in a follow-up commit after posting).

**2b. If it is NOT UI-verifiable** — skip the browser work entirely. Write no
spec and no screenshots. Say so in the report (verified via the unit/integration
suite, not the UI).

**3. Never let verify fail the run.** Verify is best-effort. If the app won't
boot or `test:e2e` errors, do not fail — capture whatever evidence you can
(including a failure-state screenshot / the Playwright trace), and explain the
problem in the report. Your green implement commits stand regardless.

**4. Write the verify report.** Write a short markdown report to the absolute
path `{{VERIFY_REPORT_FILE}}`. **Do not commit this file** — it lives outside the
repo and the workflow posts it as a comment on the PR. Cover: whether the
change was UI-verifiable, what user flow you checked (tie each screenshot to an
acceptance criterion), the verdict (verified / couldn't verify and why), and the
name of the e2e spec you added. If you captured no screenshots, say why.

# FINAL STEP — write the PR description

As the very last thing, write a short PR description (plain markdown) to the
absolute path `{{PR_DESCRIPTION_FILE}}`. **Do not commit this file** — it lives
outside the repo and the workflow reads it to build the PR body.

Cover, briefly:

- What you changed and why (tie it to the issue's acceptance criteria).
- How it's tested (the new/updated tests).
- Anything a reviewer should know (trade-offs, follow-ups, anything skipped).
