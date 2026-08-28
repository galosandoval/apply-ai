import { expect, type Page } from "@playwright/test"

export type Account = { email: string; password: string }

/** Unique per run: sign-up fails on a duplicate email, as it should. */
export function newAccount(): Account {
  return {
    email: `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`,
    password: "correct-horse-battery"
  }
}

/** Signs up through the real modal. better-auth signs the new user straight in. */
export async function signUp(page: Page, account: Account) {
  await page.goto("/")
  await page.getByRole("button", { name: "Get Started" }).first().click()

  await page.getByLabel("Email").fill(account.email)
  await page.getByLabel("Password", { exact: true }).fill(account.password)
  await page.getByLabel("Confirm Password").fill(account.password)
  await page.getByRole("button", { name: "Create Account" }).click()

  await expect(page).toHaveURL(/\/onboarding/, { timeout: 30_000 })

  return account
}
