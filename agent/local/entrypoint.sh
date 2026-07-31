#!/usr/bin/env bash
set -euo pipefail

# Runs inside the `agent:local` container (#541): reads the issue, clones the
# host repo from the bind-mounted `.git` dir only (never the host's working
# tree), cuts a throwaway branch, runs the shared setup + orchestrator against
# the ephemeral pgvector service, and pushes the result branch back into the
# host repo. No GitHub write ever happens here — no `gh pr create`, no
# `gh issue edit` — the agent's own prompt (agent/implement/prompt.md) already
# forbids opening a PR or closing the issue, so this stays a pure rehearsal.

: "${ISSUE_NUMBER:?Missing ISSUE_NUMBER}"
: "${CLAUDE_CODE_OAUTH_TOKEN:?Missing CLAUDE_CODE_OAUTH_TOKEN}"
: "${GH_TOKEN:?Missing GH_TOKEN}"
: "${NEXTAUTH_SECRET:?Missing NEXTAUTH_SECRET}"
: "${OPENAI_API_KEY:?Missing OPENAI_API_KEY}"

REPO="galosandoval/recipe-chat"
HOST_REPO_DIR="${HOST_REPO_DIR:-/host-repo}"
WORKDIR="/workdir/repo"
export OUTPUT_DIR="/workdir/output"
STANDARDS_MOUNT="${STANDARDS_DIR:-/standards}"

mkdir -p "$OUTPUT_DIR"

echo "==> Reading issue #${ISSUE_NUMBER}"
ISSUE_TITLE="$(gh issue view "$ISSUE_NUMBER" --repo "$REPO" --json title --jq .title)"
echo "    ${ISSUE_TITLE}"

BRANCH="agent/local-$(date +%Y%m%d%H%M%S)"
echo "==> Branch: ${BRANCH}"

echo "==> Cloning host repo (git history only — the host working tree is never mounted)"
git clone --quiet "$HOST_REPO_DIR" "$WORKDIR"
cd "$WORKDIR"
git config user.name "claude-code[local]"
git config user.email "claude-code-local@users.noreply.github.com"
git checkout --quiet main
git checkout --quiet -b "$BRANCH"

echo "==> Installing dependencies"
bun install

echo "==> Running shared setup (#539): Prisma generate, migrate deploy, seed"
bun run gen
bun run migrate:deploy
bun run seed

if [ -d "$STANDARDS_MOUNT" ] && [ -n "$(ls -A "$STANDARDS_MOUNT" 2>/dev/null)" ]; then
  export STANDARDS_DIR="$STANDARDS_MOUNT"
  echo "==> Coding standards mounted at ${STANDARDS_DIR}"
else
  export STANDARDS_DIR=""
  echo "==> No coding standards mounted; the prompt will skip that step"
fi

export ISSUE_NUMBER ISSUE_TITLE BRANCH CLAUDE_CODE_OAUTH_TOKEN

# Everything above runs as root (simplest for the bind-mounted-.git push
# below). Claude Code CLI itself refuses `--dangerously-skip-permissions` as
# root, so from here on the actual agent run drops to the unprivileged
# `agent` user created in the Dockerfile — including the Playwright browser
# install, since it's `agent` who runs `test:e2e` during the agent's own
# verify phase.
chown -R agent:agent "$WORKDIR" "$OUTPUT_DIR"
# Git refuses to operate on a repo owned by a different user than the one
# running it ("detected dubious ownership") once root reads it back below —
# the commits are real, root just can't see them without this.
git config --global --add safe.directory "$WORKDIR"

echo "==> Ensuring the Playwright browser matches this checkout's pinned version"
sudo -H -u agent bash -c "cd '$WORKDIR' && bunx playwright install chromium"

echo "==> Running the implementation agent (shared orchestrator, #540)"
# Derive the sudo --preserve-env allowlist from the run-policy contract (#556)
# so adding an env var can never silently strip it from the local agent.
PRESERVE_ENV="$(bun agent/implement/run-policy.ts env-list)"
set +e
sudo -H -u agent \
  --preserve-env="$PRESERVE_ENV" \
  bash -c "cd '$WORKDIR' && bun agent/local/run-with-guards.ts"
AGENT_EXIT_CODE=$?
set -e

echo "==> Pushing whatever landed on ${BRANCH} back to the host repo"
COMMITS_AHEAD="$(git rev-list --count main.."$BRANCH" 2>/dev/null || echo 0)"
if [ "$COMMITS_AHEAD" -gt 0 ]; then
  git push "$HOST_REPO_DIR" "$BRANCH":"$BRANCH"
  echo "==> Pushed ${COMMITS_AHEAD} commit(s) to local branch ${BRANCH}"
  echo "    Inspect with: git -C <your repo> log ${BRANCH}"
else
  echo "==> No commits were made on ${BRANCH}; nothing to push"
fi

if [ -f "${OUTPUT_DIR}/pr_description.txt" ]; then
  echo "==> PR description the agent wrote:"
  cat "${OUTPUT_DIR}/pr_description.txt"
fi

if [ -f "${OUTPUT_DIR}/verify_report.md" ]; then
  echo "==> Verify report:"
  cat "${OUTPUT_DIR}/verify_report.md"
fi

if [ "$AGENT_EXIT_CODE" -ne 0 ] && [ -f "${OUTPUT_DIR}/failure_reason.txt" ]; then
  echo "==> Failure reason:"
  cat "${OUTPUT_DIR}/failure_reason.txt"
fi

exit "$AGENT_EXIT_CODE"
