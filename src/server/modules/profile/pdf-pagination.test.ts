import { type Page } from "playwright-core"
import { describe, expect, it } from "vitest"
import { type ResumeDocumentData } from "~/components/resume-document"
import { printCss as css } from "~/generated/print-css"
import { paginate } from "~/lib/paginate"
import { hasPrintBrowser, inPrintBrowser } from "./print-test-support"
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
 * The route's own measure pass, driven against a real browser.
 *
 * `measurePrintedFlow` rather than the same three calls spelt again: a test
 * that re-enacted the sequence would go on passing while the print it stands
 * for changed underneath it, which is the drift this whole change exists to
 * stop.
 */
async function measureOrFail(page: Page, data: ResumeDocumentData) {
  const measurement = await measurePrintedFlow(page, data)

  // Not an assertion about the document: a null measurement is the browser
  // failing to run the measurer at all, and every case below would then be
  // asserting against the wrong thing.
  expect(measurement, "the browser measured no document").not.toBeNull()

  return measurement!
}

describe.skipIf(!hasBrowser)("the print's measurement pass", () => {
  it("reads every block of the drawn document", async () => {
    const measurement = await inPrintBrowser((page) =>
      measureOrFail(page, short)
    )

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
    const measurement = await inPrintBrowser((page) =>
      measureOrFail(page, short)
    )

    const { pages } = paginate(measurement.blocks, {
      contentHeight: measurement.contentHeight
    })

    expect(pages).toHaveLength(1)
  }, 30_000)

  it("breaks a longer document onto the sheets the assignment asked for", async () => {
    const { drawn, assigned } = await inPrintBrowser(async (page) => {
      const measurement = await measureOrFail(page, long)

      const { pages } = paginate(measurement.blocks, {
        contentHeight: measurement.contentHeight
      })

      expect(pages.length).toBeGreaterThan(1)

      await page.setContent(await resumePdfDocument(long, css, pages), {
        waitUntil: "load"
      })
      await page.evaluate(() => document.fonts.ready)

      return { drawn: await sheetsOf(page), assigned: pages }
    })

    // The sheets are the assignment, block for block and in order. Counting
    // them is not enough: a renderer that drew the right number of pages and
    // dealt the blocks itself would pass that and still be the drift this
    // change exists to stop. The heading a continued page repeats carries no
    // block key, so it does not appear here — see `ContinuedHeading`.
    expect(drawn.map((sheet) => sheet.keys)).toEqual(
      assigned.map((page) => page.blocks)
    )

    // The margin is the sheet's own padding on every page, not page one's head
    // start from the document's padding — which is the whole bug.
    //
    // Asserted against the resolved page-space tokens rather than against
    // "greater than zero": the preview draws its sheets from those same tokens,
    // so a padding that stopped answering to them is the preview and the print
    // disagreeing, and a token that regressed to a hairline would pass a
    // non-zero test while printing a resume with no margins at all.
    const { x, y } = drawn[0]!.pageSpace

    expect(y).toBeGreaterThan(0)
    expect(x).toBeGreaterThan(0)

    // To the pixel rather than exactly: the padding is resolved by layout and
    // the token by a probe, and the two round the same `calc` independently.
    for (const sheet of drawn) {
      expect(sheet.padding.top).toBeCloseTo(y, 0)
      expect(sheet.padding.bottom).toBeCloseTo(y, 0)
      expect(sheet.padding.left).toBeCloseTo(x, 0)
      expect(sheet.padding.right).toBeCloseTo(x, 0)
    }
  }, 60_000)
})

/**
 * Every sheet as drawn: what it padded itself by, and which blocks it holds.
 *
 * The page-space tokens come back resolved beside the padding, measured the way
 * `measureResumeDocument` resolves its own token — a box of that height, put
 * into the document that declares it and asked how tall it came out. A custom
 * property read off `getComputedStyle` is handed back as its unsubstituted
 * `calc`, and comparing padding against a number written here instead would be
 * a second copy of the page's geometry: exactly the drift this suite exists to
 * catch, reintroduced in the test.
 */
function sheetsOf(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".resume-document")!

    function resolve(token: string): number {
      const probe = document.createElement("div")

      probe.style.position = "absolute"
      probe.style.visibility = "hidden"
      probe.style.width = "0"
      probe.style.height = `var(${token})`

      root.append(probe)

      const height = probe.getBoundingClientRect().height

      probe.remove()

      return height
    }

    const pageSpace = {
      x: resolve("--resume-space-page-x"),
      y: resolve("--resume-space-page-y")
    }

    return [
      ...document.querySelectorAll<HTMLElement>("[data-resume-page]")
    ].map((sheet) => {
      const style = getComputedStyle(sheet)

      return {
        pageSpace,
        padding: {
          top: Number.parseFloat(style.paddingTop),
          bottom: Number.parseFloat(style.paddingBottom),
          left: Number.parseFloat(style.paddingLeft),
          right: Number.parseFloat(style.paddingRight)
        },
        keys: [
          ...sheet.querySelectorAll<HTMLElement>("[data-resume-block]")
        ].map((block) => block.dataset.resumeBlock ?? "")
      }
    })
  })
}
