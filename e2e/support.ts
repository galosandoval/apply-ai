import { expect, type Page } from "@playwright/test"

export type Account = { email: string; password: string }

/**
 * Pins a page to English before its first navigation.
 *
 * `playwright.config.ts` already sets the context's `Accept-Language`, which
 * settles a fresh run. This settles the rest: the cookie outranks
 * `Accept-Language` and the switcher writes it, so no earlier visit to `/es`
 * in the same context can leave a later navigation on a Spanish page being
 * searched for English accessible names.
 */
export async function pinEnglish(page: Page) {
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: "en", domain: "localhost", path: "/" }
  ])
}

/** Unique per run: sign-up fails on a duplicate email, as it should. */
export function newAccount(): Account {
  return {
    email: `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`,
    password: "correct-horse-battery"
  }
}

/** Signs up through the real modal. better-auth signs the new user straight in. */
export async function signUp(page: Page, account: Account) {
  await pinEnglish(page)
  await page.goto("/")
  await page.getByRole("button", { name: "Get Started" }).first().click()

  await page.getByLabel("Email").fill(account.email)
  await page.getByLabel("Password", { exact: true }).fill(account.password)
  await page.getByLabel("Confirm Password").fill(account.password)
  await page.getByRole("button", { name: "Create Account" }).click()

  await expect(page).toHaveURL(/\/onboarding\/?$/, { timeout: 30_000 })

  return account
}
