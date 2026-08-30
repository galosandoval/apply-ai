import { chromium, type Browser } from "playwright-core"

/**
 * Opens the browser the print runs in.
 *
 * `playwright-core` ships no browser, so where one comes from is a property of
 * the host, and this is the only place that knows which host it is running on:
 *
 * - **Vercel.** The runtime has no browser at all. `@sparticuz/chromium` is a
 *   Lambda-compatible build, shipped in the function bundle and unpacked to
 *   `/tmp` on the first print of a cold instance.
 * - **A dev machine.** `npx playwright install chromium` puts one where
 *   `launch()` already looks. Nothing to configure.
 * - **A hosted browser.** Set `BROWSER_WS_ENDPOINT` and the print connects out
 *   instead of launching. This is the escape hatch if the bundle ever outgrows
 *   Vercel's 250MB limit, and it is only viable because `setContent` never
 *   navigates — a remote browser needs no route back to this server.
 *
 * Whichever it is, the caller gets a `Browser` and closes it the same way.
 */
export async function launchPrintBrowser(): Promise<Browser> {
  const endpoint = process.env.BROWSER_WS_ENDPOINT

  if (endpoint) {
    return chromium.connectOverCDP(endpoint)
  }

  if (!process.env.VERCEL) {
    return chromium.launch()
  }

  const sparticuz = (await import("@sparticuz/chromium")).default

  // Skips unpacking swiftshader — ~40MB of software GL that a text-and-rules
  // page never touches, paid for on every cold start.
  sparticuz.setGraphicsMode = false

  return chromium.launch({
    executablePath: await sparticuz.executablePath(),
    args: sparticuz.args
  })
}
