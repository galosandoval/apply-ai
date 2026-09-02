import { expect, test } from "@playwright/test"
import { newAccount, signUp } from "./support"

/** Any valid `downloadPdfSchema` body — the assertion is about the response. */
const resume = {
  profession: "Software Engineer",
  contact: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    location: "London, UK",
    phone: "555-0100",
    linkedIn: "linkedin.com/in/ada",
    portfolio: "https://ada.dev"
  },
  skill: [{ category: "Languages", all: "TypeScript, Go" }],
  experience: [
    {
      name: "Analytical Engines",
      title: "Engineer",
      startDate: "1840",
      endDate: "1843",
      body: "- Wrote the first published algorithm for a machine\n- Described a general-purpose computer decades early"
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

/**
 * The same resume, long enough that no assignment can fit it on one sheet.
 *
 * As long as the schema allows and no longer: five roles of eight full-length
 * accomplishments is the most a payload may carry, which is comfortably past
 * one page and still a body the route accepts.
 *
 * Below Chromium the bytes are a black box, so what this can assert is that a
 * document which has to break still comes back a valid PDF, and a larger one
 * than the single-page print. Where the breaks land and what margin each page
 * carries are facts about markup, asserted at the markup seam in
 * `resume-html.test.ts` and in the browser in `pdf-pagination.test.ts`.
 */
const longResume = {
  ...resume,
  experience: Array.from({ length: 5 }, (_, index) => ({
    name: `Analytical Engines ${index + 1}`,
    title: "Senior Engineer, Distributed Computation",
    startDate: `${1840 + index}`,
    endDate: `${1841 + index}`,
    body: Array.from(
      { length: 8 },
      (_, bullet) =>
        `- Described a general-purpose machine operating on symbols rather than only on numbers, and wrote the notes that became the first published algorithm for one — accomplishment ${bullet + 1}`
    ).join("\n")
  }))
}

test("a document too long for one page still downloads as a PDF", async ({
  page
}) => {
  await signUp(page, newAccount())

  const response = await page.request.post("/api/resume/pdf", {
    data: longResume
  })

  expect(response.status(), await response.text().catch(() => "")).toBe(200)
  expect(response.headers()["content-type"]).toContain("application/pdf")

  const body = await response.body()

  expect(body.subarray(0, 5).toString()).toBe("%PDF-")

  // Plausible for a multi-page print: a one-page resume clears 10KB, and this
  // one carries several times its content.
  expect(body.byteLength).toBeGreaterThan(20_000)
})

test("the PDF route refuses a stranger", async ({ request }) => {
  const response = await request.post("/api/resume/pdf", { data: resume })

  expect(response.status()).toBe(401)
})
