import { expect, test } from "@playwright/test"
import { newAccount, signUp } from "./support"

/**
 * Seam 4 — deliberately thin. Three flows exist because the App Router move
 * touched every route file and the auth swap replaced sign-in outright: the two
 * changes most likely to produce something that compiles and does not run.
 */

test("signing up lands on onboarding", async ({ page }) => {
  await signUp(page, newAccount())

  await expect(page).toHaveURL(/\/onboarding/)
})

test("signing in reaches the dashboard", async ({ page, context }) => {
  const account = newAccount()

  await signUp(page, account)
  await context.clearCookies()

  await page.goto("/")
  await page.getByRole("button", { name: "Login" }).first().click()
  await page.getByLabel("Email").fill(account.email)
  await page.getByLabel("Password").fill(account.password)
  await page.getByRole("button", { name: "Log In" }).click()

  await expect(page).toHaveURL(/\/dashboard/)
})

test("a signed-out visitor cannot reach the dashboard", async ({ page }) => {
  await page.goto("/dashboard")

  await expect(page).toHaveURL("/")
})
