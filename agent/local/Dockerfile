# Local Docker rehearsal image for `agent:local` (#541) — a faithful CI
# rehearsal of the `agent:implement` pipeline the maintainer can run against a
# throwaway branch with no GitHub side effects. Pins the same Node 22 / bun
# 1.2.0 combination CI's setup-node / oven-sh/setup-bun steps use, and adds
# gh, git, the Claude Code CLI, and a Playwright Chromium browser so the full
# quality gate plus the verify/e2e phase can run inside the container.
#
# Local-only: never published, no registry, not used by CI (CI stays
# no-Docker, tools installed per step).
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates unzip git gnupg sudo \
  && rm -rf /var/lib/apt/lists/*

# gh CLI, from GitHub's official apt repo.
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

# bun, pinned to the same version CI's oven-sh/setup-bun@v2 step declares.
# Installed under a world-readable system path (not /root, which is 700) so
# the unprivileged `agent` user below can run it too.
ENV BUN_INSTALL=/usr/local/share/bun
ENV PATH="${BUN_INSTALL}/bin:${PATH}"
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.2.0" \
  && chmod -R a+rX "${BUN_INSTALL}"

# Claude Code CLI, pinned to the version the run-policy contract declares (#556)
# — read straight from the module so the local image and CI's workflow install
# step can never freeze at different versions. bun's global installs never run
# dependency lifecycle scripts (`--trust` only affects a project's
# package.json, not `-g`), so the postinstall that fetches the real
# platform-native binary has to be run explicitly — without it `claude` is left
# as a tiny stub that errors on invocation.
COPY agent/implement/run-policy.ts /tmp/run-policy.ts
RUN CLAUDE_CODE_CLI_VERSION="$(bun /tmp/run-policy.ts cli-version)" \
  && bun install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_CLI_VERSION}" \
  && node "${BUN_INSTALL}/install/global/node_modules/@anthropic-ai/claude-code/install.cjs" \
  && chmod -R a+rX "${BUN_INSTALL}" \
  && rm /tmp/run-policy.ts
# bun/bunx/claude resolve via /usr/local/bin regardless of PATH policy
# (sudo's secure_path included), since dropping to the unprivileged user
# below goes through `sudo`, which doesn't honor the custom PATH set above.
RUN for bin in "${BUN_INSTALL}"/bin/*; do ln -s "$bin" "/usr/local/bin/$(basename "$bin")"; done

WORKDIR /build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
# Chromium's OS-level deps need root (apt-get); the browser binary itself is
# installed per-user below, matching who actually runs it — Claude Code CLI
# refuses `--dangerously-skip-permissions` as root (a real safety check, since
# that flag's whole point is unattended autonomy), so the agent has to run as
# an unprivileged user.
RUN bunx playwright install-deps chromium

# `-m` creates /home/agent; sudoers grants root -> agent with the run's env
# preserved (entrypoint.sh runs as root up to the actual Claude CLI
# invocation, which alone needs to drop privileges).
RUN useradd -m -s /bin/bash agent \
  && echo 'root ALL=(agent) NOPASSWD: ALL' >> /etc/sudoers \
  && mkdir -p /workdir && chown -R agent:agent /workdir

# Prewarm the browser binary in the *agent* user's cache (~/.cache/ms-playwright)
# since that's who actually runs it, both here and at runtime — entrypoint.sh's
# own later `playwright install chromium` call is then normally a no-op.
RUN sudo -H -u agent bash -c 'cd /build && bunx playwright install chromium'

COPY agent/local/entrypoint.sh /usr/local/bin/agent-local-entrypoint
RUN chmod +x /usr/local/bin/agent-local-entrypoint

WORKDIR /workdir
ENTRYPOINT ["agent-local-entrypoint"]
