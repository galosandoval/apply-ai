# Deploying to Fly.io

First deploy of `apply-ai`, from nothing to a working URL with a database.

This is the path that works today. A move to Vercel is in progress — see
[deploy-vercel.md](./deploy-vercel.md) — but until it is proven in production
this stays the fallback, and the `Dockerfile` and `output: "standalone"` stay
with it.

## Why this app runs in a container

The PDF route prints with a real headless browser — `src/server/modules/profile/render-resume-pdf.ts`
calls `chromium.launch()` in the server process. That rules out serverless: there is no
Chromium binary, no ~2GB of headroom, and no warm process to reuse. So the image bundles
the app *and* Chromium (`mcr.microsoft.com/playwright:v1.62.1-noble`), and `fly.toml` keeps
one machine up permanently rather than cold-starting a browser per request.

Two consequences worth internalizing before you start:

- The machine is **ephemeral**. Nothing in `src/` writes to disk, so no volume is attached
  to the app and a redeploy loses nothing. All state is in Postgres.
- The machine is **always on** (`min_machines_running = 1`, `auto_stop_machines = false`).
  You are billed for a `shared-cpu-2x` / 2gb machine 24/7. That is the price of a warm browser.

## Prerequisites

```bash
brew install flyctl        # or: curl -L https://fly.io/install.sh | sh
fly auth login
fly version                # commands below assume a recent CLI
```

You also need an OpenAI API key, and Docker is *not* required locally — Fly builds the
image remotely by default.

## 1. Create the app

The name in `fly.toml` is `apply-ai`, and app names are globally unique on Fly. Try to claim it:

```bash
fly apps create apply-ai
```

If it is taken, pick another name and **change the `app =` line in `fly.toml` to match** —
the CLI reads it from there on every deploy. Your URL becomes `https://<app-name>.fly.dev`.

Do not run plain `fly launch` — it tries to regenerate `fly.toml` and will overwrite the
tuned VM size and machine settings. If you use it, use `fly launch --no-deploy` and decline
the config overwrite.

## 2. Provision Postgres

Nothing in this repo provisions a database. Pick one; you do **not** create a Fly volume by
hand in either case.

### Option A — Managed Postgres (recommended)

```bash
fly mpg create              # check `fly help` — the CLI is migrating away from `fly postgres`
```

Storage is part of the instance. Backups and failover are Fly's problem, not yours. Copy the
connection string it prints.

### Option B — External (Neon, Supabase, Railway)

Create a Postgres instance in their dashboard and copy the connection string. Fine choice —
the app holds a normal `pg` Pool (`src/server/db/index.ts`) and needs nothing Fly-specific.

> **SSL:** managed providers require TLS. Make sure the URL ends with `?sslmode=require`.
> `pg` reads `sslmode` from the connection string; if you hit a `self-signed certificate`
> error at boot, that is the knob to look at first.

### Not recommended

Running Postgres in the app container, or legacy single-node `fly postgres create`. The
former dies on every redeploy; the latter has no automatic backups or failover unless you
configure them.

## 3. Set secrets

All four are required by `src/env.ts` and validated at boot. Missing any one crashes the
machine on start — validation is skipped only during the image build (`SKIP_ENV_VALIDATION=1`).

```bash
fly secrets set \
  DATABASE_URL="postgresql://...?sslmode=require" \
  BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  APP_URL="https://apply-ai.fly.dev" \
  OPENAI_API_KEY="sk-..."
```

| Secret | Notes |
| --- | --- |
| `DATABASE_URL` | From step 2. The release command migrates against it too, unless `MIGRATION_DATABASE_URL` is set. |
| `BETTER_AUTH_SECRET` | Any 32-byte random string. **Rotating it invalidates every session.** |
| `APP_URL` | The exact public https origin, no trailing slash. `src/server/auth.ts` uses it as better-auth's `baseURL`; a wrong value breaks sign-in with no obvious error. |
| `OPENAI_API_KEY` | Used by the resume-generation routes. |

`TEST_DATABASE_URL` is local-only — never set it in production.

Verify with `fly secrets list` (names and digests only; values are write-once).

## 4. Deploy

```bash
fly deploy
```

The build runs the three Dockerfile stages: install deps, `next build` (standalone output),
then copy `public/`, `.next/standalone`, `.next/static`, `migrations/` and the migration
script onto the Playwright runtime image. First build is slow — the Playwright base image is large.

The `release_command` in `fly.toml` runs `scripts/migrate.mjs` on its own machine before
the new release takes traffic — once per deploy, not once per boot. A failed migration
fails the deploy and the current release keeps serving.

```bash
fly logs        # release command migrates, then the machine reports "Ready"
fly status      # machine should be `started`
fly open        # opens the URL
```

## 5. Verify it actually works

Three things, in order — each exercises a different failure mode:

1. **Sign up for an account.** Confirms `DATABASE_URL`, that migrations applied, and that
   `APP_URL` matches the origin (a mismatch shows up as the session cookie not sticking).
2. **Generate a resume.** Confirms `OPENAI_API_KEY`.
3. **Download the PDF.** Confirms Chromium launched inside the container. This is the one
   most likely to fail on a first deploy, and it fails at *runtime*, not build time.

## Ongoing work

### Shipping a schema change

The release command applies migrations, so the flow is just:

```bash
npm run generate        # writes a new file into migrations/
git add migrations/ src/server/db/schema.ts
fly deploy
```

Review the generated SQL before deploying. The release command is a single machine, so there
is no concurrent-migration race — but destructive migrations still have no undo. Take a backup first if the
change drops or rewrites a column.

### Useful commands

```bash
fly logs -a apply-ai            # stream logs
fly ssh console                 # shell into the running machine
fly machine restart <id>        # restart the server (does not re-run migrations)
fly scale show                  # confirm shared-cpu-2x / 2gb
fly secrets set KEY=value       # updating a secret redeploys the machine
```

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Machine boot-loops immediately | An env var failed `src/env.ts` validation | `fly logs` names the variable; set it with `fly secrets set` |
| `self-signed certificate` / SSL error at boot | Provider requires TLS | Append `?sslmode=require` to `DATABASE_URL` |
| Sign-in appears to succeed but the session drops | `APP_URL` ≠ the real origin | Set it to the exact https URL, no trailing slash, and redeploy |
| PDF route 500s, everything else works | Chromium could not launch | `fly ssh console`, check `/ms-playwright`. See the version-pin note below |
| PDF route looks for a browser in `/tmp` | `VERCEL` or `BROWSER_WS_ENDPOINT` leaked into the machine's env | `fly secrets unset` it — on Fly neither should be set |
| OOM during PDF generation | Chromium exceeded the machine | `fly scale memory 4096` |
| Deploy fails in `npm ci` | Lockfile lacks this platform's optional binaries | The Dockerfile already falls back to `npm install`; if it still fails, regenerate the lockfile on Linux |

### Where the browser comes from

`src/server/modules/profile/launch-print-browser.ts` picks it: on Fly it takes the plain
`chromium.launch()` path, because neither `VERCEL` nor `BROWSER_WS_ENDPOINT` is set and the
runner image already carries a matching browser. Nothing to configure — but that is why
neither variable belongs in `fly secrets`.

### Known soft spot: the Playwright version pin

The runner image is hard-pinned to `v1.62.1-noble`, but `package.json` has
`"playwright-core": "^1.62.1"`. If the lockfile ever floats to 1.63+, `playwright-core` will
look for a Chromium revision the base image does not ship, and `chromium.launch()` fails at
runtime with no build-time warning. When you bump Playwright, bump **both** — drop the caret
and change the Dockerfile tag in the same commit.

## Cost

One `shared-cpu-2x` / 2gb machine running continuously, plus whatever Postgres you chose.
Scaling to zero is not an option here: a cold start would mean booting Chromium on the first
PDF request. If cost matters more than that latency, the change is `auto_stop_machines = true`
and `min_machines_running = 0` in `fly.toml` — accept a multi-second first request.
