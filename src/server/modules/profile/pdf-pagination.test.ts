import { chromium } from "playwright-core"
import { describe, expect, it } from "vitest"
import {
  type ResumeDocumentData,
  resumeMeasurementContract
} from "~/components/resume-document"
import { printCss as css } from "~/generated/print-css"
import { measureResumeDocument } from "~/lib/measure-resume-document"
import { paginate } from "~/lib/paginate"
import { hasPrintBrowser } from "./print-test-support"
import { resumePdfDocument } from "./resume-html"

/**
 * The measurement pass the print runs, in the browser it runs it in.
 *
 * `paginate` is proved against its own arithmetic and the markup is proved
 * against a string; neither can say whether the heights fed to the one and the
 * sheets drawn by the other survive being shipped into Chromium. That is what
 * this is for. `measureResumeDocument` reaches the browser as source over CDP,
 * with no module graph on the far side, so a single reference to anything
 * outside itself comes back as an empty measurement and a resume that prints
 * as one overflowing page — which is exactly what it used to do.
 */

const hasBrowser = await hasPrintBrowser("pdf-pagination.test.ts")

const contact = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  location: "London",
  phone: "",
  linkedIn: "",
  portfolio: ""
}

/** One page's worth, comfortably. */
const short: ResumeDocumentData = {
  profession: "Software Engineer",
  contact,
  experience: [
    {
      id: "w1",
      name: "Analytical Engines",
      title: "Engineer",
      startDate: "1840",
      endDate: "1843",
      bullets: ["Wrote the first algorithm published for a machine"]
    }
  ],
  education: []
}

/** More than one page's worth, by a wide enough margin to be no judgement call. */
const long: ResumeDocumentData = {
  ...short,
  experience: Array.from({ length: 12 }, (_, index) => ({
    id: `w${index}`,
    name: `Analytical Engines ${index + 1}`,
    title: "Senior Engineer, Distributed Computation",
    startDate: `${1840 + index}`,
    endDate: `${1841 + index}`,
    bullets: Array.from(
      { length: 6 },
      (_, bullet) =>
        `Described a general-purpose machine operating on symbols rather than only on numbers, note ${bullet + 1}`
    )
  }))
}

/** What the route does between its two `setContent` calls, over one document. */
async function assign(data: ResumeDocumentData) {
  const browser = await chromium.launch()

  try {
    const page = await browser.newPage()

    await page.setContent(await resumePdfDocument(data, css), {
      waitUntil: "load"
    })
    await page.evaluate(() => document.fonts.ready)

    const measurement = await page.evaluate(
      measureResumeDocument,
      resumeMeasurementContract
    )

    return { measurement, browser, page }
  } catch (error) {
    await browser.close()
    throw error
  }
}

describe.skipIf(!hasBrowser)("the print's measurement pass", () => {
  it("reads every block of the drawn document", async () => {
    const { measurement, browser } = await assign(short)

    try {
      expect(measurement).not.toBeNull()

      // Every block the flow drew, with a real height and a real identity: an
      // empty list is what a measurement that failed to reach the DOM returns,
      // and it paginates to nothing rather than to an error.
      expect(measurement!.blocks.length).toBeGreaterThan(3)
      expect(measurement!.contentHeight).toBeGreaterThan(0)

      for (const block of measurement!.blocks) {
        expect(block.key).not.toBe("")
        expect(block.sectionId).not.toBe("")
        expect(block.height).toBeGreaterThan(0)
      }
    } finally {
      await browser.close()
    }
  }, 30_000)

  it("prints a document that fits on one sheet as one sheet", async () => {
    const { measurement, browser } = await assign(short)

    try {
      const { pages } = paginate(measurement!.blocks, {
        contentHeight: measurement!.contentHeight
      })

      expect(pages).toHaveLength(1)
    } finally {
      await browser.close()
    }
  }, 30_000)

  it("breaks a longer document onto sheets that each carry the margin", async () => {
    const { measurement, browser, page } = await assign(long)

    try {
      const { pages } = paginate(measurement!.blocks, {
        contentHeight: measurement!.contentHeight
      })

      expect(pages.length).toBeGreaterThan(1)

      await page.setContent(await resumePdfDocument(long, css, pages), {
        waitUntil: "load"
      })
      await page.evaluate(() => document.fonts.ready)

      const sheets = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("[data-resume-page]")].map(
          (sheet) => {
            const style = getComputedStyle(sheet)

            return {
              top: Number.parseFloat(style.paddingTop),
              bottom: Number.parseFloat(style.paddingBottom),
              left: Number.parseFloat(style.paddingLeft),
              right: Number.parseFloat(style.paddingRight)
            }
          }
        )
      )

      expect(sheets).toHaveLength(pages.length)

      // The margin is the sheet's own padding on every page, not page one's
      // head start from the document's padding — which is the whole bug.
      for (const sheet of sheets) {
        expect(sheet.top).toBeGreaterThan(0)
        expect(sheet).toEqual(sheets[0])
      }
    } finally {
      await browser.close()
    }
  }, 60_000)
})
