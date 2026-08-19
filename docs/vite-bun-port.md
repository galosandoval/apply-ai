# Porting apply-ai from Next.js to Vite + Bun

Plan of record for moving the app off Next.js. Written 2026-08-18 against
`development` @ `621f20b`. No code has been written yet — an exploratory spike
was run and reverted, and its findings are recorded under
[Spike findings](#spike-findings).

## Goal

Move to a stack that is conventional and well-represented in model training
data, so that generated code lands closer to correct on the first try. The
current app is a create-t3-app scaffold: Next.js 13 pages router, tRPC v10,
Drizzle, NextAuth v4.

## Target stack

| Concern     | Now                        | After                              |
| ----------- | -------------------------- | ---------------------------------- |
| Client      | Next.js pages router (SSR) | Vite + React + TanStack Router SPA |
| Server      | Next API routes            | Bun + Hono                         |
| API         | tRPC v10 + React Query v4  | tRPC v11 + React Query v5          |
| Auth        | NextAuth v4 credentials    | better-auth                        |
| AI          | `openai-edge` + `ai@2`     | `ai@7` + `@ai-sdk/openai`          |
| ORM         | Drizzle + `pg`             | unchanged                          |
| UI          | shadcn/ui + Tailwind       | unchanged                          |

SSR is dropped deliberately. Every screen except the landing and legal pages is
auth-gated, so there is no SEO surface to protect and no server-render to
preserve. A plain client plus an explicit server is the more legible shape.

**Single package, not a monorepo.** At ~6.5k LOC across 61 files, an
`apps/web` + `apps/server` split buys two `package.json` files to keep in sync
and no isolation the project actually needs. `src/` stays, along with the `~/*`
path alias.

## Directory layout

```
src/
  routes/         TanStack Router file routes. Thin: route definition,
                  loader, and a render of the matching feature.
  features/       onboarding/ resume/ auth/ dashboard/ — components,
                  hooks and schemas colocated with the screen that uses them.
  components/ui/  shadcn primitives. Shared across features, stays put.
  lib/            tRPC client, auth client, utils.
  server/         Bun + Hono entry, tRPC routers, db, modules.
                  Mostly moves untouched.
```

`features/` is the part that pays off. `src/pages/onboarding/education/index.tsx`
is 292 lines and `src/pages/dashboard/index.tsx` is 380 largely because a Next
page has nowhere to put its pieces. As `features/onboarding/education/` the
form, its schema and its hook sit together and the route file is ten lines.

## Decisions

Settled before starting:

1. **Existing user rows are preserved, but passwords are reset.** User and
   profile rows survive the migration; bcrypt hashes are dropped and
   better-auth uses its default scrypt going forward. Existing users must go
   through a password reset. See [Open questions](#open-questions) — this
   implies a reset flow, which implies an email provider.
2. **PDF rendering moves server-side.** No `/pdf` route for puppeteer to visit;
   the server builds the resume HTML and hands it to `page.setContent()`.
3. **The dashboard drops streaming for `generateObject`.** `useChat` is
   replaced by a `resume.generate` tRPC mutation returning a zod-validated
   object.

Rationale for 2 and 3 is in the spike findings below.

## Spike findings

Four things were established by building and reverting a scaffold. They are the
reason the phases below are shaped the way they are.

### Puppeteer runs under Bun

This was the largest unknown, since a failure would have forced a Node sidecar
just for PDF generation. Verified empirically: `bun run` on a script importing
the project's `puppeteer` launched headless Chrome and produced a 9,582-byte
PDF. No sidecar needed.

Caveat: this only works against the project's own `node_modules` copy.
Resolving `puppeteer` from Bun's global cache pulls a newer version whose
matching Chrome build is not installed.

### The PDF feature is already broken on `development`

`src/pages/api/resume/pdf.ts` launches puppeteer and navigates to
`env.NEXTAUTH_URL + "/pdf?..."`, then patches roughly forty elements by id.
But `src/pages/pdf/index.tsx` — the template it navigates to — was deleted in
`2116929` ("feat: add resume editing functionality with dynamic paths"). The
route 404s today. Download is broken before the port begins, so any change here
is a fix rather than a regression.

The port does not restore that design. Having the server fetch its own public
URL means PDF generation depends on the app being externally reachable, breaks
under auth, and behaves differently in dev, CI and production. Instead the
server renders the resume HTML directly into `page.setContent()`. The cost is a
render function shared between the React template and the server; the ~180
lines of `page.$$eval` id-patching in `insertValuesOnPage` are deleted.

### The chat route cannot be ported as-is

It is built on `openai-edge` and `ai@2`'s `OpenAIStream` / `StreamingTextResponse`.
Current `ai` is v7, where `useChat` no longer manages input state and no longer
exposes `message.content` (messages are `parts` arrays).

The dashboard, however, never displays the stream: it returns `<p>Loading...</p>`
while `isLoading` is true and `JSON.parse`s the complete response once it
finishes. Streaming is pure overhead. The replacement is `generateObject` with a
zod schema, called from a normal tRPC mutation, which deletes:

- the bespoke `/api/resume/chat` route
- `parseContent` and its `try/catch` around `JSON.parse`
- the `FinishedParsed`, `EducationParsed`, `ExperienceParsed` types
- the "respond with RFC8259 compliant JSON without deviation" prompt hedging

and turns a hoped-for shape into an enforced one.

Version note: `ai@7` pairs with `@ai-sdk/openai@4` and `@ai-sdk/react@4`, not
the v1/v2 lines. Its peer range also requires `zod@^3.25.76`, up from the
current `3.22.4`.

### Auth is a schema migration, not a config swap

better-auth needs three new tables — `session`, `account`, `verification` — plus
`name`, `emailVerified`, `createdAt` and `updatedAt` on `user`, and a unique
constraint on `user.email`. Password hashes live in `account`, not on `user`.
All tables carry the existing `apply-ai_` prefix from `pgTableCreator`; the
Drizzle adapter is pointed at them explicitly via its `schema` option.

Two consequences worth stating early:

- `userRouter.create` disappears entirely. better-auth owns signup, so the
  profile row it currently creates in the same transaction moves to a
  `databaseHooks.user.create.after` hook. The invariant its comment describes —
  "a user without a profile can sign in but hits 'Profile not found' on every
  screen" — has to survive that move.
- The tRPC routers need no changes at all. They only ever read
  `ctx.session.user.id`, which better-auth's session also provides. Only the
  context factory changes.

## Phases

### Phase 1 — Config and dependencies

- Add `vite`, `@vitejs/plugin-react`, `@tanstack/react-router`,
  `@tanstack/router-plugin`, `hono`, `@hono/trpc-server`, `better-auth`.
- Upgrade tRPC 10 → 11, React Query 4 → 5, `ai` 2 → 7, zod 3.22 → 3.25.
- `vite.config.ts`: router plugin with `autoCodeSplitting`, the `~` alias, dev
  server on 3000 proxying `/trpc` and `/api` to Bun on 3001.
- `tsconfig.json`: `moduleResolution: "bundler"`, `jsx: "react-jsx"`,
  `types: ["bun", "vite/client"]`, drop `allowJs`/`checkJs`.
- Replace `src/env.mjs` (`@t3-oss/env-nextjs`) with `src/server/env.ts` — plain
  zod over `process.env`, parsed at import so a misconfigured deploy fails on
  boot. `NEXTAUTH_URL` → `APP_URL`, `NEXTAUTH_SECRET` → `BETTER_AUTH_SECRET`.
- `index.html` and `src/main.tsx` as the client entry.

React Query v5 is where the upgrade fallout lands at call sites: `cacheTime`
becomes `gcTime`, `onSuccess`/`onError` are gone from `useQuery`, and mutations
report `isPending` rather than `isLoading`.

### Phase 2 — Server

`src/server/index.ts`, a Hono app exported as a Bun server:

| Route              | Handler                                          |
| ------------------ | ------------------------------------------------ |
| `/api/auth/*`      | better-auth's `auth.handler`                     |
| `/api/resume/pdf`  | ported puppeteer route, server-rendered HTML     |
| `/trpc/*`          | `@hono/trpc-server` over the existing `appRouter` |
| `/*` (prod only)   | static `dist`, SPA fallback to `index.html`      |

`createTRPCContext` swaps its `CreateNextContextOptions` signature for
`FetchCreateContextFnOptions` and resolves the session with
`auth.api.getSession({ headers: req.headers })`. The transformer, error
formatter, `enforceUserIsAuthed` and the dev-only `addSleep` middleware all
carry over unchanged.

`src/server/db/index.ts` runs `migrate()` at import time. That is fine on the
Bun server but the module must never reach the client bundle — worth a check
once Vite is building, since `crud-schema.ts` is imported by both sides and
transitively pulls in `schema.ts`.

### Phase 3 — Auth migration

- Schema changes described above.
- Drizzle migration: create the three tables, add the `user` columns, add the
  unique index on `email`, drop `user.password`.
- Configure better-auth: `emailAndPassword.enabled`, min 8 / max 50 to match the
  existing `authorizeParams` bounds, Drizzle adapter, the profile-creation hook.
- `src/lib/auth-client.ts` via `createAuthClient`, replacing `next-auth/react`'s
  `useSession`, `signIn` and `signOut` in `layout.tsx`, `auth-modal.tsx` and
  `utils/useUser.tsx`.
- Password reset flow, since existing users are being reset.

`bcryptjs` and `@types/bcryptjs` can be dropped once the hashes are gone.

### Phase 4 — Routing

Eleven pages move to `src/routes/`. `middleware.ts` and its matcher become a
`beforeLoad` guard on a `_protected` layout route covering `/dashboard`,
`/resume` and `/onboarding/*`.

Swaps, across roughly twenty files:

| Next                                    | Replacement                          |
| --------------------------------------- | ------------------------------------ |
| `next/link`                             | `@tanstack/react-router` `Link`      |
| `next/router`, `next/navigation`        | `useNavigate`, `useRouterState`      |
| `next/head`, `components/app-head.tsx`  | `head` on the route definition       |
| `next/image`                            | `<img>`                              |
| `next/dynamic` in `no-ssr.tsx`          | deleted — `NoSSR` goes with it       |
| `_app.tsx`                              | `__root.tsx` + `main.tsx`            |

`layout.tsx` needs real attention rather than a mechanical swap: its
`ProtectedNavbar` and `Breadcrumbs` both branch on `router.pathname` string
comparisons against `appPath`. With a `_protected` layout route and per-step
onboarding routes, most of that branching is expressible as route structure.

`geist` is a Next-specific font loader and is replaced by a plain `@font-face`
declaration, which also removes the `GeistSans.variable` class threading in
`_app.tsx`.

### Phase 5 — Features

Each page's body moves into `src/features/<area>/`, leaving route files as a
route definition plus a render. This is where `onboarding/education` (292
lines) and `dashboard` (380) get broken up — both are well over the 100–125
line guideline, and both are long specifically because the page file was the
only place for their pieces to live.

The dashboard rewrite lands here: `useChat` out, `api.resume.generate`
mutation in, `parseContent` and the `*Parsed` types deleted.

### Phase 6 — Delete Next.js

Remove `next`, `next-auth`, `@t3-oss/env-nextjs`, `@trpc/next`, `openai-edge`,
`geist`, `eslint-config-next`, `bcryptjs`; delete `src/pages/`,
`src/middleware.ts`, `next.config.mjs`, `next-env.d.ts`. Update scripts to
`vite` and `bun --hot src/server/index.ts`, and settle on one package manager —
the repo currently has `package-lock.json` while Bun becomes the runtime.

## Effort

Phases 1–3 are load-bearing and roughly half the work. Phases 4–5 are mechanical
but touch nearly every file. Phase 6 is cleanup.

## Open questions

- **Password reset requires an email provider.** better-auth's reset flow sends
  a token by email. Either wire up a provider (Resend, Postmark) as part of
  Phase 3, or reset the affected users out of band and skip the flow for now.
  Needs a decision before Phase 3 starts.
- **`daisyui` and shadcn/ui are both installed.** Unrelated to the port, but the
  port touches every component file, so it is a cheap moment to drop whichever
  is unused.
- **Deployment target.** The current setup assumes Vercel (`VERCEL_URL`
  handling in `env.mjs` and `utils/api.ts`). A Bun server needs somewhere that
  runs a long-lived process, and puppeteer needs a Chrome binary available in
  that environment.
