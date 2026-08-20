import { defineConfig, devices } from "@playwright/test"

/**
 * Its own port. 3000 is often already taken by something else, and
 * `reuseExistingServer` would then run the whole suite against that.
 */
const port = process.env.PLAYWRIGHT_PORT ?? "3100"
const baseURL = `http://localhost:${port}`

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
