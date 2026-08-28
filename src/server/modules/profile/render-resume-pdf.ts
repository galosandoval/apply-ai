import { type ResumeDocumentData } from "~/components/resume-document"
import { printCss } from "~/generated/print-css"
import { launchPrintBrowser } from "./launch-print-browser"
import { resumePdfDocument } from "./resume-html"

/**
 * Prints a resume to PDF.
 *
 * The markup is rendered here and handed to `page.setContent`, so the browser
 * never navigates: no round trip, no session to forward, and no requirement
 * that the server be able to reach its own public URL.
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

    await page.setContent(await resumePdfDocument(data, printCss), {
      waitUntil: "load"
    })

    // The faces are inline, so nothing is fetched — but `font-display: swap`
    // still renders one frame in the fallback, and `page.pdf` will happily
    // print that frame. This is the wait for the real face to be in use.
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
