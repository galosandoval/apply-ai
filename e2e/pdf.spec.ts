import { expect, test } from "@playwright/test"
import { newAccount, signUp } from "./support"

/** Any valid `downloadPdfSchema` body — the assertion is about the response. */
const resume = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  profession: "Software Engineer",
  location: "London, UK",
  phone: "555-0100",
  linkedIn: "linkedin.com/in/ada",
  portfolio: "https://ada.dev",
  interests: "Mathematics",
  skills: [{ category: "Languages", all: "TypeScript, Go", position: 0 }],
  experience: [
    {
      name: "Analytical Engines",
      title: "Engineer",
      startDate: "1840",
      endDate: "1843",
      bullets: [
        "Wrote the first published algorithm for a machine",
        "Described a general-purpose computer decades early"
      ]
    }
  ],
  education: [
    {
      name: "Home Tuition",
      degree: "Mathematics",
      startDate: "1830",
      endDate: "1835"
    }
  ]
}

// Launching Chromium (and, in dev, compiling the route) runs past the default.
test.describe.configure({ timeout: 120_000 })

test("a signed-in user can download a PDF", async ({ page }) => {
  await signUp(page, newAccount())

  // `page.request` carries the session cookie; the bare `request` fixture does not.
  const response = await page.request.post("/api/resume/pdf", { data: resume })

  expect(response.status(), await response.text().catch(() => "")).toBe(200)
  expect(response.headers()["content-type"]).toContain("application/pdf")

  const body = await response.body()

  // Non-trivial: an empty or error-shaped response is a few hundred bytes.
  expect(body.byteLength).toBeGreaterThan(10_000)
  expect(body.subarray(0, 5).toString()).toBe("%PDF-")
})

test("the PDF route refuses a stranger", async ({ request }) => {
  const response = await request.post("/api/resume/pdf", { data: resume })

  expect(response.status()).toBe(401)
})
