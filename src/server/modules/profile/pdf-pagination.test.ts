import { chromium, type Page } from "playwright-core"
import { describe, expect, it } from "vitest"
import { type ResumeDocumentData } from "~/components/resume-document"
import { printCss as css } from "~/generated/print-css"
import { paginate } from "~/lib/paginate"
import { hasPrintBrowser } from "./print-test-support"
import { measurePrintedFlow } from "./render-resume-pdf"
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

/**
 * One browser, one page, closed however the case ends.
 *
 * The lifecycle is here rather than in each case because three `try/finally`
 * blocks are three chances to leak a Chromium into the suite's run.
 */
async function inPrintBrowser<T>(run: (page: Page) => Promise<T>): Promise<T> {
  const browser = await chromium.launch()

  try {
    return await run(await browser.newPage())
  } finally {
    await browser.close()
  }
}

/**
 * The route's own measure pass, driven against a real browser.
 *
 * `measurePrintedFlow` rather than the same three calls spelt again: a test
 * that re-enacted the sequence would go on passing while the print it stands
 * for changed underneath it, which is the drift this whole change exists to
 * stop.
 */
async function measured(page: Page, data: ResumeDocumentData) {
  const measurement = await measurePrintedFlow(page, data)

  // Not an assertion about the document: a null measurement is the browser
  // failing to run the measurer at all, and every case below would then be
  // asserting against the wrong thing.
  expect(measurement, "the browser measured no document").not.toBeNull()

  return measurement!
}

describe.skipIf(!hasBrowser)("the print's measurement pass", () => {
  it("reads every block of the drawn document", async () => {
    const measurement = await inPrintBrowser((page) => measured(page, short))

    // Every block the flow drew, with a real height and a real identity: an
    // empty list is what a measurement that failed to reach the DOM returns,
    // and it paginates to nothing rather than to an error.
    expect(measurement.blocks.length).toBeGreaterThan(3)
    expect(measurement.contentHeight).toBeGreaterThan(0)

    for (const block of measurement.blocks) {
      expect(block.key).not.toBe("")
      expect(block.sectionId).not.toBe("")
      expect(block.height).toBeGreaterThan(0)
    }
  }, 30_000)

  it("prints a document that fits on one sheet as one sheet", async () => {
    const measurement = await inPrintBrowser((page) => measured(page, short))

    const { pages } = paginate(measurement.blocks, {
      contentHeight: measurement.contentHeight
    })

    expect(pages).toHaveLength(1)
  }, 30_000)

  it("breaks a longer document onto sheets that each carry the margin", async () => {
    const sheets = await inPrintBrowser(async (page) => {
      const measurement = await measured(page, long)

      const { pages } = paginate(measurement.blocks, {
        contentHeight: measurement.contentHeight
      })

      expect(pages.length).toBeGreaterThan(1)

      await page.setContent(await resumePdfDocument(long, css, pages), {
        waitUntil: "load"
      })
      await page.evaluate(() => document.fonts.ready)

      const drawn = await page.evaluate(() =>
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

      expect(drawn).toHaveLength(pages.length)

      return drawn
    })

    // The margin is the sheet's own padding on every page, not page one's head
    // start from the document's padding — which is the whole bug.
    for (const sheet of sheets) {
      expect(sheet.top).toBeGreaterThan(0)
      expect(sheet).toEqual(sheets[0])
    }
  }, 60_000)
})
