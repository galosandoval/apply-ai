# Deploying to Vercel

**Status: in progress.** Two of the four prerequisites are done. Until the rest
are, [deploy-fly.md](./deploy-fly.md) is the path that works — keep it.

| # | Prerequisite | Status |
| --- | --- | --- |
| 1 | Print stylesheet compiled at build time, not read off `.next/static` | **Done** — verified against a real build and real Chromium |
| 2 | Migrations moved off the boot hook | **Done** — one run per deploy, on both hosts |
| 3 | Chromium available to the PDF route | Not started |
| 4 | Pooled database connection | Not started |

## Why this needed work at all

The app was built for a long-lived container, for one reason: the PDF route
prints with a real headless browser in-process
(`src/server/modules/profile/render-resume-pdf.ts`). Three further assumptions
followed from that host and none of them hold on a serverless one — a
filesystem holding this build's output, a single process to migrate the
database on boot, and a connection pool with one owner.

Each is addressed below. Read the `Why` lines before changing any of it; the
non-obvious ones are what make this deployment work.

## 1. The print stylesheet — done

`page.setContent` hands Chromium a document with no origin and no network, so
neither a `<link>` nor a `url(/fonts/…)` resolves. The sheet and all eight faces
have to be literal strings in the markup.

They used to be read off `.next/static` at request time. On Vercel that
directory is served from the CDN and is not in the function's filesystem, so
the print would have silently lost its styling and fonts.

`scripts/build-print-css.ts` now compiles the sheet at build time into
`src/generated/print-css.ts`, which the route imports like any other module.
Nothing is read from disk at runtime, so the host's filesystem layout no longer
matters.

**Nothing to configure.** Vercel runs `npm run build`, and `prebuild` runs the
generator. Two things to know:

- `src/generated` is gitignored build output, excluded from the Tailwind
  content globs (it would otherwise feed Tailwind its own class names and the
  base64 font data back as content to match) and from eslint.
- The generated module is ~905KB. It counts against the function bundle, which
  matters when Chromium joins it — see step 3.

## 2. Migrations off the boot hook — done

**Why:** `src/instrumentation.ts` ran `migrate()` on boot. On a container that
is one process, once. On Vercel it is once per cold start, and a traffic spike
cold-starts several concurrently — all running the migrator against the same
database with no lock between them.

The hook is gone. `scripts/migrate.mjs` (`npm run db:migrate`) now applies
migrations once per deploy, and `vercel.json` puts it ahead of the build:

```json
{ "buildCommand": "npm run db:migrate && npm run build" }
```

Three things to know:

- **It picks the unpooled connection.** DDL through a transaction pooler is a
  known source of trouble, so the script prefers `MIGRATION_DATABASE_URL`, then
  `DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING` (the two names the Neon
  integration may set), and only falls back to `DATABASE_URL`. Set nothing and
  it migrates through the pooled endpoint — confirm one of those names exists in
  the project's environment once step 4 lands.
- **A failed migration fails the build**, so the broken revision never takes
  traffic. It also means the *previous* deployment keeps serving, against a
  database the new code has not touched — which is the behaviour you want.
- **It is plain `.mjs`, not TypeScript**, because Fly runs the same script from
  a release machine whose image has no `tsx`. See below.

Fly runs it too, as a `release_command` in `fly.toml` — same script, once per
deploy, on its own machine before the new release takes traffic. That is why
`Dockerfile` still copies `migrations/`, and now also `scripts/migrate.mjs` and
`node_modules/drizzle-orm`: the standalone trace covers `pg`, but not the
migrator, which no longer has an importer in the app. If Fly is ever retired,
those three lines go with it.

## 3. Chromium — pending

**Why:** `playwright-core` ships no browser, and Vercel's runtime has none.

The plan is `@sparticuz/chromium`, a Lambda-compatible build, bundled into the
function. `render-resume-pdf.ts:18` is the only coupling point:

```ts
const browser = await chromium.launch({
  executablePath: await sparticuz.executablePath(),
  args: sparticuz.args
})
```

Things to get right:

- **Bundle size.** Vercel's limit is 250MB uncompressed. Chromium is the bulk
  of it, plus ~905KB of stylesheet. If it does not fit, swap `launch` for
  `connectOverCDP` against a hosted browser (Browserbase, Browserless) — that
  one line is the whole difference, because `setContent` never navigates.
- **Memory and duration.** A cold Chromium print needs both. Set `maxDuration`
  and the memory size on the route, and confirm the ceiling your plan allows.
- **`serverExternalPackages`** in `next.config.ts` already keeps
  `playwright-core` unbundled; `@sparticuz/chromium` needs the same treatment.
- **`outputFileTracingIncludes`** currently pulls in `playwright-core` for this
  route. Revisit once the launch path changes.

The fonts need nothing here — they are baked into the stylesheet by step 1.

## 4. Database — pending

Neon, provisioned through the Vercel marketplace integration so the connection
strings land in the project's environment automatically.

**Why pooled:** `src/server/db/index.ts` holds a `pg` Pool. Every warm function
instance holds its own, so connections multiply with concurrency until Postgres
refuses them. The app must use Neon's **pooled** endpoint; migrations must use
the **unpooled** one.

The integration sets both — confirm the exact variable names in the Vercel
dashboard rather than assuming them, then make sure `DATABASE_URL` (which
`src/env.ts` requires) points at the pooled endpoint.

Neon also ships `pgvector`, which the ATS coverage work in
[ats-score.md](./ats-score.md) will want for matching posting requirements
against resume bullets semantically. That is per-user, per-resume data joined
to relational rows — it belongs in this database, not a separate vector store.

## Environment variables

All four are required by `src/env.ts` and validated at boot; validation is
skipped only during the build (`SKIP_ENV_VALIDATION=1`).

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Neon's **pooled** endpoint. Set by the integration — verify it is the pooled one. |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`. Rotating it invalidates every session. |
| `APP_URL` | The stable production origin, no trailing slash. `src/server/auth.ts` uses it as better-auth's `baseURL`. **Do not derive it from `VERCEL_URL`** — that is per-deployment, so callbacks would be signed against a URL that changes every push. |
| `OPENAI_API_KEY` | Used by the resume generation and PDF import routes. |

`MIGRATION_DATABASE_URL` is optional: set it to the **unpooled** endpoint if the
integration's own unpooled variable is named something `scripts/migrate.mjs`
does not already look for.

`TEST_DATABASE_URL` is local and CI only. Never set it in production.

Preview deployments need their own `APP_URL`, and sign-in will not work on them
until that is set to the preview's own origin.

## Verifying a deployment

In this order — each exercises a different failure mode, and the last is the
one most likely to break:

1. **Sign up.** Confirms `DATABASE_URL`, that migrations applied, and that
   `APP_URL` matches the origin. A mismatch shows up as the session cookie not
   sticking rather than as an error.
2. **Generate a resume.** Confirms `OPENAI_API_KEY` and the function's duration
   limit.
3. **Download the PDF.** Confirms Chromium launched, and that the print is in
   its real faces rather than a system fallback. Open it and check the
   typography — a fallback renders perfectly happily and looks almost right.

`npm run test:pdf` asserts point 3 locally against real Chromium, and it is
worth running in CI: `REQUIRE_PDF_TESTS=1` turns a missing browser into a
failure instead of a skip.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Build fails in `prebuild` | The stylesheet generator threw | Reproduce with `npm run generate:css` |
| PDF renders unstyled or in the wrong font | The generated sheet did not ship | Confirm `src/generated/print-css.ts` exists after build; run `npm run test:pdf` |
| PDF route times out | Cold Chromium exceeded the limit | Raise `maxDuration` and memory, or move to a hosted browser |
| Deploy rejected for bundle size | Chromium plus dependencies over 250MB | Move to `connectOverCDP` against a hosted browser |
| `too many connections` | Unpooled endpoint | Point `DATABASE_URL` at Neon's pooled endpoint |
| Migration errors on deploy | DDL through the pooler | Set `MIGRATION_DATABASE_URL` to the unpooled endpoint |
| Sign-in succeeds, session drops | `APP_URL` ≠ the real origin | Exact https origin, no trailing slash |

## Relationship to the Fly deployment

Both are supported for now, and everything in step 1 is a plain improvement
that helps either. `output: "standalone"` in `next.config.ts` and the
`Dockerfile` exist for Fly; leave them until Vercel is proven in production.

The tradeoff is real and worth restating: Fly keeps one machine warm so
Chromium never cold-starts, and bills 24/7 for it. Vercel scales to zero and
pays for that with a cold browser on the first print after idle.
