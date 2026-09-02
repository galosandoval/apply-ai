import { expect, test } from "@playwright/test"
import { newAccount, signUp } from "./support"

/**
 * The one spec that is deliberately not pinned to English.
 *
 * Two ways into Spanish, and both have to work: asking for `/es` by URL, and
 * the switcher in the navbar. What a browser can see of the switcher is the
 * navigation — the other half, the write to `user.locale`, is only observable
 * in what a *new resume* is written in, so it is tested against the database in
 * `profile.test.ts` rather than through a generation here.
 */

test("/es renders the Spanish landing page", async ({ page }) => {
  await page.goto("/es")

  await expect(
    page.getByRole("heading", { name: "Creador de currículums con IA" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Comenzar" }).first()
  ).toBeVisible()
})

test("a Spanish reader stays in Spanish across a navigation", async ({
  page
}) => {
  await page.goto("/es")

  await page.getByRole("link", { name: "Privacidad" }).first().click()

  await expect(page).toHaveURL(/\/es\/privacy-policy\/?$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "Política de Privacidad" })
  ).toBeVisible()
})

test("a locale the app does not ship is not a page", async ({ page }) => {
  const response = await page.goto("/fr")

  expect(response?.status()).toBe(404)
})

test("the switcher takes a signed-out visitor to Spanish and back", async ({
  page
}) => {
  await page.goto("/")

  await page.getByLabel("Language", { exact: true }).selectOption("es")

  await expect(page).toHaveURL(/\/es\/?$/)
  await expect(
    page.getByRole("button", { name: "Comenzar" }).first()
  ).toBeVisible()

  await page.getByLabel("Idioma", { exact: true }).selectOption("en")

  await expect(page).toHaveURL(/localhost:\d+\/$/)
  await expect(
    page.getByRole("button", { name: "Get Started" }).first()
  ).toBeVisible()
})

test("switching keeps a signed-in user on the page they were on", async ({
  page
}) => {
  await signUp(page, newAccount())

  await page.getByLabel("Language", { exact: true }).selectOption("es")

  await expect(page).toHaveURL(/\/es\/onboarding\/?$/)
  await expect(page.getByLabel("Idioma", { exact: true })).toBeVisible()
})
