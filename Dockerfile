# syntax=docker/dockerfile:1

# One image runs both the Next server and Chromium. That is the whole reason
# the deployment target is a long-lived host rather than a serverless platform:
# the PDF route prints with a real browser, in this process.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Browsers are installed in the runner, from the Playwright base image.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# `npm ci` needs a lock that lists this platform's optional binaries, and one
# generated on macOS often doesn't — fall back rather than fail the build.
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund)

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The build no longer opens a database connection — migrations run at boot, in
# `src/instrumentation.ts` — so no DATABASE_URL is needed here.
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Chromium and its system libraries come preinstalled and version-matched.
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Applied on boot by the instrumentation hook, so they have to ship.
COPY --from=builder /app/migrations ./migrations

EXPOSE 3000

CMD ["node", "server.js"]
