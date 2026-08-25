import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { chromium } from "playwright-core"
import { type ResumeDocumentData } from "~/components/resume-document"
import { embedFonts } from "./embed-fonts"
import { resumePdfDocument } from "./resume-html"

/**
 * Prints a resume to PDF.
 *
 * The markup is rendered here and handed to `page.setContent`, so the browser
 * never navigates: no round trip, no session to forward, and no requirement
 * that the server be able to reach its own public URL.
 */
export async function renderResumePdf(data: ResumeDocumentData) {
  const css = await readCompiledCss()

  const browser = await chromium.launch()

  try {
    const page = await browser.newPage()

    await page.setContent(await resumePdfDocument(data, css), {
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

let cachedCss: string | null = null

/**
 * The app's compiled Tailwind, read off the built stylesheet.
 *
 * Hand-maintaining a copy of the utilities the template uses is how the two
 * drift; this reads whatever the build emitted. Next writes its CSS chunks
 * under `.next/static`, in dev and in a production build alike.
 */
async function readCompiledCss() {
  // Only cached in production: in dev the chunk list changes as you edit.
  if (cachedCss !== null && process.env.NODE_ENV === "production") {
    return cachedCss
  }

  // Read at runtime from the build output, not bundled — the bundler has no
  // way to know what the build will emit. The `turbopackIgnore` comments below
  // sit on the path each `fs` call resolves: without them Turbopack sees an
  // unanalyzable path and traces the entire project into the server bundle.
  const staticRoot = join(process.cwd(), ".next", "static")

  const roots = [join(staticRoot, "css"), join(staticRoot, "chunks")]

  const sheets: string[] = []

  for (const root of roots) {
    let entries: string[]

    try {
      entries = await readdir(/* turbopackIgnore: true */ root)
    } catch {
      continue
    }

    for (const entry of entries.filter((name) => name.endsWith(".css"))) {
      sheets.push(
        await readFile(join(/* turbopackIgnore: true */ root, entry), "utf8")
      )
    }
  }

  if (!sheets.length) {
    throw new Error(
      "No compiled stylesheet under .next/static — run `next build` (or load a page in dev) before printing a PDF."
    )
  }

  // Fonts are embedded before the sheet is cached, so the expensive part —
  // reading and base64-encoding half a megabyte of variable fonts — happens
  // once per process rather than once per print.
  cachedCss = await embedFonts(sheets.join("\n"))

  return cachedCss
}
