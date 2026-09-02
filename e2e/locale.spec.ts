import { expect, test } from "@playwright/test"

/**
 * The one spec that is deliberately not pinned to English.
 *
 * Both halves of the way in, in a single walk: the switcher navigates, and the
 * page it lands on is Spanish. Asking for `/es` by URL, the `/fr` 404 and the
 * Spanish legal pages are routing behaviour step 01 already settled — worth
 * re-checking by hand after a routing change, not worth a browser each on
 * every run. The other half of the switcher, the write to `user.locale`, is
 * only observable in what a *new resume* is written in, so it is tested
 * against the database in `profile.test.ts` rather than through a generation
 * here.
 */

test("the switcher takes a visitor to Spanish and back", async ({ page }) => {
  await page.goto("/")

  await page.getByLabel("Language", { exact: true }).selectOption("es")

  await expect(page).toHaveURL(/\/es\/?$/)
  await expect(
    page.getByRole("heading", { name: "Creador de currículums con IA" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Comenzar" }).first()
  ).toBeVisible()

  await page.getByLabel("Idioma", { exact: true }).selectOption("en")

  await expect(page).toHaveURL(/localhost:\d+\/$/)
  await expect(
    page.getByRole("button", { name: "Get Started" }).first()
  ).toBeVisible()
})
