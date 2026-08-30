import { chromium, type Page } from "playwright-core"

/**
 * Whether a browser is here to print in — the guard both real-browser suites
 * open with.
 *
 * Skipping is a local convenience, and only that. The sheet is not what can be
 * missing — `pretest` generates it, so it is always there. Chromium is:
 * `playwright-core` ships no browser, and a checkout that has never run `npx
 * playwright install` should skip rather than fail for the wrong reason.
 *
 * But a suite that silently asserts nothing is worse than no suite, and these
 * are the only tests standing between the print and a document nobody looked
 * at. So `REQUIRE_PDF_TESTS=1` — set by `npm run test:pdf`, and worth setting
 * in CI — turns the skip into a failure.
 *
 * Shared rather than spelt per suite: two copies drift, and the copy that
 * quietly stops honouring `REQUIRE_PDF_TESTS` is a suite CI thinks it is
 * running.
 */
export async function hasPrintBrowser(suite: string): Promise<boolean> {
  const available = await chromium
    .launch()
    .then((browser) => browser.close())
    .then(() => true)
    .catch(() => false)

  if (!available && process.env.REQUIRE_PDF_TESTS === "1") {
    throw new Error(
      "REQUIRE_PDF_TESTS=1 but no browser launched — run `npx playwright install chromium`."
    )
  }

  if (!available) {
    console.warn(
      `${suite}: skipped, no Chromium. \`npx playwright install chromium\` enables it.`
    )
  }

  return available
}

/**
 * One browser, one page, closed however the case ends.
 *
 * The lifecycle is here rather than in each case because every hand-rolled
 * `try/finally` is another chance to leak a Chromium into the suite's run, and
 * a suite that leaks one is a suite whose next case starts slower and whose CI
 * box eventually stops answering.
 *
 * Shared with `hasPrintBrowser` for the same reason that one is shared: two
 * copies drift, and the copy that stops closing is the one nobody reads.
 */
export async function inPrintBrowser<T>(
  run: (page: Page) => Promise<T>
): Promise<T> {
  const browser = await chromium.launch()

  try {
    return await run(await browser.newPage())
  } finally {
    await browser.close()
  }
}
