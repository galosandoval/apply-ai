import { defineConfig, devices } from "@playwright/test"

/**
 * Its own port. 3000 is often already taken by something else, and
 * `reuseExistingServer` would then run the whole suite against that.
 */
const port = process.env.PLAYWRIGHT_PORT ?? "3100"

/**
 * Exported because `support.ts` pins the locale cookie against it. A cookie is
 * scoped to a host, and a second copy of that host in the helpers is one that
 * silently stops matching the moment this moves.
 */
export const baseURL = `http://localhost:${port}`

/**
 * Three flows only — sign up, sign in, download a PDF. These exist because the
 * App Router move and the auth swap are the two changes most likely to produce
 * something that compiles and does not run.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    /**
     * Pins the suite to English. Every selector below is an English accessible
     * name, and next-intl negotiates a locale from `Accept-Language` when
     * nothing else has decided one — so a machine set to Spanish would send
     * `/` to `/es` and fail these specs for a reason that has nothing to do
     * with what they test. `locale.spec.ts` is the exception: it asks for
     * `/es` on purpose, by URL and through the switcher.
     */
    locale: "en-US",
    trace: "on-first-retry"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ],
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
        command: `npm run dev -- --port ${port}`,
        env: { APP_URL: baseURL },
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      }
})
