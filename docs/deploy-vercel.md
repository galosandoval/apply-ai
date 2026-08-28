# Deploying to Vercel

The app runs on Vercel, against a Neon database provisioned through the Vercel
marketplace integration. Push to `development` and it deploys.

This is the only deployment. There was a Fly one — a Docker image bundling the
app and Chromium, one machine kept warm — and it is gone. What follows is the
Vercel setup and the handful of things about it that are easy to get wrong.

## The build

`vercel.json` sets one command:

```json
{ "buildCommand": "npm run db:migrate && npm run build" }
```

Migrations run **before** the build, so a bad migration fails the deploy and the
previous deployment keeps serving. `prebuild` then compiles the print
stylesheet, and `next build` runs.

## Environment variables

All four are required by `src/env.ts` and validated at build time — a missing one
fails the build rather than the first request. Never set `SKIP_ENV_VALIDATION`
on Vercel; it only moves that failure to runtime.

| Variable             | Notes                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Set by the Neon integration. Must be the **pooled** endpoint — see below.             |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`. Rotating it invalidates every session.                     |
| `APP_URL`            | The exact origin the browser sees, scheme and host only — no trailing slash, no path. |
| `OPENAI_API_KEY`     | Used by resume generation and PDF import.                                             |

Two optional ones: `MIGRATION_DATABASE_URL` to force migrations onto a specific
(unpooled) endpoint, and `BROWSER_WS_ENDPOINT` to print on a hosted browser
instead of the bundled one.

Env vars are read at deploy time. Changing one in the dashboard does nothing
until you redeploy.

### `APP_URL` is the origin, exactly

better-auth uses it as `baseURL` (`src/server/auth.ts:16`) and compares it
against each request's `Origin` header. A mismatch is rejected outright:

```
ERROR [Better Auth]: Invalid origin: https://www.applyai.app
```

If `www` and the apex both resolve, only one of them actually serves — check
Settings → Domains for which is primary and which redirects, and point `APP_URL`
at the survivor. Do not derive it from `VERCEL_URL`: that is per-deployment, so
every push would change the origin callbacks are signed against.

Preview deployments have their own hostname and need their own `APP_URL`. Until
that is set, sign-in does not work on them.

## Migrations

`scripts/migrate.mjs` (`npm run db:migrate`) applies them once per deploy. It
used to be an `instrumentation.ts` boot hook, which on a serverless host means
once per cold start — a traffic spike would run several migrators against the
same database with no lock between them.

It prefers an unpooled connection, because DDL through a transaction pooler is a
known source of trouble: `MIGRATION_DATABASE_URL`, then `DATABASE_URL_UNPOOLED`
or `POSTGRES_URL_NON_POOLING` (the names Neon's integration may set), and only
then `DATABASE_URL`.

Plain `.mjs`, not TypeScript — it runs before the build, with no transpile step
in front of it.

## Chromium

`playwright-core` ships no browser and the Vercel runtime has none, so
`@sparticuz/chromium` — a Lambda-compatible build — travels in the function
bundle and unpacks to `/tmp` on the first print of a cold instance.

`src/server/modules/profile/launch-print-browser.ts` is the only place that
knows this. It picks, in order: `BROWSER_WS_ENDPOINT` if set
(`connectOverCDP` against a hosted browser), sparticuz when `VERCEL` is set, and
plain `chromium.launch()` otherwise, which is what a dev machine with
`npx playwright install chromium` uses.

- **Size.** The browser is 67MB compressed against a 250MB limit. If a deploy is
  ever rejected for size, set `BROWSER_WS_ENDPOINT` and drop the dependency.
  That works only because `setContent` never navigates — the remote browser
  needs no route back to this server.
- **Cold start.** The route sets `maxDuration = 60` (Hobby's ceiling) and
  `vercel.json` asks for 2048MB. A cold print pays for the unpack; a warm one
  does not.
- **`setGraphicsMode = false`** skips ~40MB of software GL that a page of text
  and rules never touches.

## The print stylesheet

`page.setContent` hands Chromium a document with no origin and no network, so
neither a `<link>` nor a `url(/fonts/…)` resolves. The sheet and all eight faces
have to be literal strings in the markup.

`scripts/build-print-css.ts` compiles them at build time into
`src/generated/print-css.ts`, which the route imports like any other module —
~905KB, and nothing is read from disk at runtime. `src/generated` is gitignored
build output, excluded from the Tailwind content globs (it would otherwise feed
Tailwind its own class names and the base64 font data back as content) and from
eslint.

## Database

Neon, through the Vercel marketplace integration, which sets the connection
strings automatically.

`src/server/db/index.ts` holds a `pg` Pool, and every warm function instance
holds its own — so connections multiply with concurrency until Postgres refuses
them. `DATABASE_URL` must therefore be Neon's **pooled** endpoint. Worth
verifying in the dashboard rather than assuming; the symptom of getting it wrong
is `too many connections` under load, not at deploy.

Neon also ships `pgvector`, which the ATS coverage work in
[ats-score.md](./ats-score.md) will want for matching posting requirements
against resume bullets semantically. That is per-user, per-resume data joined to
relational rows — it belongs in this database, not a separate vector store.

## Verifying a deployment

In this order — each exercises a different failure mode, and the last is the one
most likely to break:

1. **Sign up.** Confirms `DATABASE_URL`, that migrations applied, and that
   `APP_URL` matches the origin.
2. **Import a resume PDF.** Confirms `OPENAI_API_KEY` and that pdfjs's native
   dependencies shipped.
3. **Download the PDF.** Confirms Chromium launched, and that the print is in
   its real faces rather than a system fallback. Open it and check the
   typography — a fallback renders perfectly happily and looks almost right.

`npm run test:pdf` asserts point 3 locally against real Chromium, and it is
worth running in CI: `REQUIRE_PDF_TESTS=1` turns a missing browser into a
failure instead of a skip.

## Troubleshooting

Everything below has actually happened.

| Symptom                                   | Cause                                                                                                        | Fix                                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENOENT … src/generated/print-css.ts`     | The generator's output directory is gitignored, so a fresh checkout has none                                 | Fixed — `build-print-css.ts` creates it. Reproduce with `rm -rf src/generated && npm run generate:css`                                      |
| `ENOENT … next-server.js.nft.json`        | `output: "standalone"` relocates the trace files and Vercel's build step cannot find them                    | Fixed — the setting is gone with Fly. Do not reintroduce it                                                                                 |
| `DOMMatrix is not defined` on PDF import  | pdfjs `require`s `@napi-rs/canvas` in a try/catch, so the tracer misses it and the function ships without it | Fixed — `outputFileTracingIncludes` names it. Note the key is `/api/trpc/**`: `[trpc]` parses as a glob character class and matches nothing |
| `Invalid origin` on sign-up               | `APP_URL` ≠ the origin the browser is on                                                                     | The exact surviving origin, no trailing slash. Redeploy                                                                                     |
| Sign-in succeeds, session drops           | Same cause, subtler symptom                                                                                  | Same fix                                                                                                                                    |
| Build fails in `prebuild`                 | The stylesheet generator threw                                                                               | Reproduce with `npm run generate:css`                                                                                                       |
| PDF renders unstyled or in the wrong font | The generated sheet did not ship                                                                             | Confirm `src/generated/print-css.ts` exists after build; run `npm run test:pdf`                                                             |
| PDF route times out                       | Cold Chromium exceeded the limit                                                                             | Raise `maxDuration` and the memory in `vercel.json`, or set `BROWSER_WS_ENDPOINT`                                                           |
| Deploy rejected for bundle size           | Chromium plus dependencies over 250MB                                                                        | Set `BROWSER_WS_ENDPOINT` and drop `@sparticuz/chromium`                                                                                    |
| `too many connections`                    | `DATABASE_URL` points at the unpooled endpoint                                                               | Point it at Neon's pooled one                                                                                                               |
| Migration errors on deploy                | DDL through the pooler                                                                                       | Set `MIGRATION_DATABASE_URL` to the unpooled endpoint                                                                                       |

A general note on tracing: a package Next never statically sees — required in a
try/catch, resolved by path at runtime — will not ship unless
`outputFileTracingIncludes` names it. That has now bitten twice, once for
Chromium and once for canvas. It fails at runtime, not at build.
