import { type Page } from "playwright-core"
import {
  type ResumeDocumentData,
  resumeMeasurementContract
} from "~/components/resume-document"
import { printCss } from "~/generated/print-css"
import {
  measureResumeDocument,
  type ResumeMeasurement
} from "~/lib/measure-resume-document"
import { paginate } from "~/lib/paginate"
import { launchPrintBrowser } from "./launch-print-browser"
import { resumePdfDocument } from "./resume-html"

/**
 * The print's first pass: the continuous flow, drawn and measured.
 *
 * Exported because a test drives it against a real browser — the measurement
 * reaches Chromium as source over CDP, and whether it survives that trip is
 * the one thing neither `paginate`'s arithmetic nor the markup string can say.
 * A test that spelt this sequence itself would go on passing while the print it
 * stands for changed underneath it.
 *
 * `null` when there is no document to measure, which is not the same answer as
 * a document that measured as empty.
 */
export async function measurePrintedFlow(
  page: Page,
  data: ResumeDocumentData
): Promise<ResumeMeasurement | null> {
  await page.setContent(await resumePdfDocument(data, printCss), {
    waitUntil: "load"
  })

  // The faces are inline, so nothing is fetched — but `font-display: swap`
  // still renders one frame in the fallback, and both the measurement and
  // `page.pdf` will happily take that frame. This is the wait for the real face
  // to be in use, and it has to happen before the heights are read: a document
  // measured in the fallback breaks in the wrong place.
  await page.evaluate(() => document.fonts.ready)

  return page.evaluate(measureResumeDocument, resumeMeasurementContract)
}

/**
 * Prints a resume to PDF.
 *
 * The markup is rendered here and handed to `page.setContent`, so the browser
 * never navigates: no round trip, no session to forward, and no requirement
 * that the server be able to reach its own public URL.
 *
 * It is handed markup twice, and that is the point. The first document is the
 * continuous flow, which the browser lays out so it can be measured; the second
 * is the same document dealt onto sheets by the same `paginate` the editor
 * calls, from measurements taken by the same `measureResumeDocument`. So the
 * PDF consumes the assignment the preview showed rather than one Chromium
 * arrived at on its own, and the two cannot drift apart. The cost is one extra
 * `setContent` inside a browser that is already launched.
 *
 * Throws rather than falls back when there is nothing to measure: printing the
 * flow instead would hand the user the very document this route exists to stop
 * producing, and it would do it silently.
 *
 * The margin comes with the sheets. Each page element carries the style's page
 * padding on all four sides, so `page.pdf` is asked for a zero margin on all
 * four — which is what gives page two the margins page one used to get for free
 * from the document's own padding.
 *
 * Where the browser comes from is `launch-print-browser.ts`'s problem — it
 * differs per host, and nothing else here does.
 *
 * `printCss` carries the sheet and its faces as one string, compiled at build
 * time — see `scripts/build-print-css.ts`. Nothing is read from disk here, so
 * printing does not care what the host's filesystem looks like.
 */
export async function renderResumePdf(data: ResumeDocumentData) {
  const browser = await launchPrintBrowser()

  try {
    const page = await browser.newPage()
    const measurement = await measurePrintedFlow(page, data)

    /*
      Nothing to measure is not a document this route can print. The markup it
      just set always contains the document element, so a null here is the
      measurer failing to reach the DOM at all — and the only thing left to
      print is the unpaginated flow, which is precisely the bug this route was
      changed to fix: every page after the first hard against the paper edge.

      A failed download the user can see and retry is the better answer. Printed
      anyway, it is a resume that looks wrong to whoever the user sent it to,
      with nothing but a server log to say so.
    */
    if (!measurement) {
      throw new Error(
        "renderResumePdf: the document measured as nothing — refusing to print an unpaginated resume."
      )
    }

    const { pages } = paginate(measurement.blocks, {
      contentHeight: measurement.contentHeight
    })

    await page.setContent(await resumePdfDocument(data, printCss, pages), {
      waitUntil: "load"
    })

    await page.evaluate(() => document.fonts.ready)

    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" }
    })
  } finally {
    await browser.close()
  }
}
