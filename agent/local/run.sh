#!/usr/bin/env bash
set -euo pipefail

# Host-side entrypoint for `bun run agent:local <issue-number>` (#541): the
# maintainer's one command to rehearse the full `agent:implement` pipeline
# locally. Brings up the ephemeral pgvector service, runs the agent in Docker
# against a throwaway `agent/local-<timestamp>` branch, then tears the
# database down — no GitHub side effects, no risk to the working tree or
# current branch (see agent/local/entrypoint.sh for the in-container flow).

ISSUE_NUMBER="${1:-}"
if [ -z "$ISSUE_NUMBER" ]; then
  echo "Usage: bun run agent:local -- <issue-number>" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/agent/local/docker-compose.yml"

: "${CLAUDE_CODE_OAUTH_TOKEN:?Set CLAUDE_CODE_OAUTH_TOKEN (subscription token — run \`claude setup-token\`)}"

# gh read access only — never used to push. Reused from the maintainer's own
# already-authenticated CLI so no new secret has to be provisioned for local
# runs (unlike CI's write-scoped AGENT_PAT).
GH_TOKEN="$(gh auth token)"

# NEXTAUTH_SECRET / OPENAI_API_KEY: reuse the shell's own value if already
# exported, otherwise pull just these two lines out of the repo's local `.env`
# (never sourced wholesale, so prod DB/Stripe credentials in there never reach
# the container).
env_fallback() {
  local name="$1"
  local value="${!name:-}"
  if [ -z "$value" ] && [ -f "$REPO_ROOT/.env" ]; then
    value="$(grep -E "^${name}=" "$REPO_ROOT/.env" | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/')"
  fi
  printf '%s' "$value"
}
NEXTAUTH_SECRET="$(env_fallback NEXTAUTH_SECRET)"
OPENAI_API_KEY="$(env_fallback OPENAI_API_KEY)"
: "${NEXTAUTH_SECRET:?Set NEXTAUTH_SECRET (or add it to your .env)}"
: "${OPENAI_API_KEY:?Set OPENAI_API_KEY (or add it to your .env)}"

HOST_GIT_DIR="$(git -C "$REPO_ROOT" rev-parse --absolute-git-dir)"

# Mount the maintainer's local skills rules if present; otherwise mount an
# empty scratch dir so entrypoint.sh's "non-empty directory" check correctly
# skips the standards step (docs/agents/domain.md / memory: skills live at
# ~/Projects/skills, symlinked into ~/.claude/rules).
DEFAULT_STANDARDS_DIR="$HOME/Projects/skills/rules"
if [ -d "${LOCAL_STANDARDS_DIR:-$DEFAULT_STANDARDS_DIR}" ]; then
  STANDARDS_HOST_DIR="${LOCAL_STANDARDS_DIR:-$DEFAULT_STANDARDS_DIR}"
else
  STANDARDS_HOST_DIR="$(mktemp -d)"
fi

export ISSUE_NUMBER GH_TOKEN CLAUDE_CODE_OAUTH_TOKEN NEXTAUTH_SECRET OPENAI_API_KEY
export HOST_GIT_DIR STANDARDS_HOST_DIR

cleanup() {
  echo "==> Tearing down the ephemeral pgvector service"
  docker compose -f "$COMPOSE_FILE" down -v
}
trap cleanup EXIT

echo "==> Starting agent:local for issue #${ISSUE_NUMBER}"
docker compose -f "$COMPOSE_FILE" run --rm --build agent
