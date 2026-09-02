import { expect, test } from "@playwright/test"

/**
 * The one spec that is deliberately not pinned to English.
 *
 * There is no language picker in the interface, by decision — the URL is the
 * switch. So this walks in through `/es` and checks that the Spanish build is
 * reachable, renders its own copy, and keeps the locale across a navigation
 * rather than dropping back into English on the first internal link.
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
