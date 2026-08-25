import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { chromium, type Page } from "playwright-core"
import { describe, expect, it } from "vitest"
import { type ResumeDocumentData } from "~/components/resume-document"
import { type ResumeStyle } from "~/lib/resume-style"
import { embedFonts } from "./embed-fonts"
import { resumePdfDocument } from "./resume-html"

/**
 * What the print actually renders in — the one thing markup assertions cannot
 * see.
 *
 * Everything else about the document is decided before Chromium runs, so it is
 * tested against the markup string. This is not: the PDF used to render in a
 * system fallback while the preview showed the real face, and nothing about the
 * markup said so. So this drives the same `about:blank` page the PDF route
 * drives and asks the browser what it ended up using.
 *
 * These are not pixel assertions and this is not a screenshot suite — the
 * design is meant to change. What is asserted is that each style's chosen face
 * is embedded and in use, and that the page fetched nothing to get it.
 */

const compiledCssRoots = [
  join(process.cwd(), ".next", "static", "css"),
  join(process.cwd(), ".next", "static", "chunks")
]

/** The built stylesheet, or `null` when the project has not been built. */
async function compiledCss() {
  const sheets: string[] = []

  for (const root of compiledCssRoots) {
    let names: string[]

    try {
      names = await readdir(root)
    } catch {
      continue
    }

    for (const name of names.filter((entry) => entry.endsWith(".css"))) {
      sheets.push(await readFile(join(root, name), "utf8"))
    }
  }

  return sheets.length ? embedFonts(sheets.join("\n")) : null
}

const css = await compiledCss()

const data: ResumeDocumentData = {
  profession: "Software Engineer",
  contact: {
    fullName: "Augusta Ada King-Noel, Countess of Lovelace",
    email: "ada@example.com",
    location: "London",
    phone: "",
    linkedIn: "",
    portfolio: ""
  },
  skill: [{ id: "s1", category: "Languages", all: "TypeScript, Go" }],
  experience: [
    {
      id: "w1",
      name: "The Analytical Engine Programming and Mechanical Computation Society",
      title: "Senior Principal Engineer, Distributed Systems",
      // The longest shape a date range takes, which is what decides whether
      // the column a style chose is wide enough.
      startDate: "September 2016",
      endDate: "December 2018",
      bullets: [
        "Wrote the first algorithm, and then described in some detail a general-purpose computing machine capable of operating on symbols rather than only on numbers."
      ]
    }
  ],
  education: []
}

/**
 * The face each direction is set in, and whether it draws rules.
 *
 * Named here rather than read back out of the CSS: a test that derives its
 * expectation from the thing it is testing asserts only that the file parses.
 */
const expected: Record<ResumeStyle, { family: string; drawsRules: boolean }> = {
  classic: { family: "Source Serif 4 Variable", drawsRules: true },
  standard: { family: "Geist Variable", drawsRules: true },
  modern: { family: "Manrope Variable", drawsRules: false }
}

// A built stylesheet is what the PDF route reads too — without one there is
// nothing to print, and skipping says so rather than failing for the wrong
// reason.
describe.skipIf(!css)("the printed document", () => {
  it.each(Object.entries(expected))(
    "renders %s in its own embedded face, fetching nothing",
    async (style, { family, drawsRules }) => {
      const browser = await chromium.launch()

      try {
        const page = await browser.newPage()
        const requested: string[] = []

        page.on("request", (request) => requested.push(request.url()))

        await page.setContent(
          await resumePdfDocument({ ...data, style }, css!),
          { waitUntil: "load" }
        )
        await page.evaluate(() => document.fonts.ready)

        const seen = await page.evaluate((wanted: string) => {
          const document_ = document.querySelector(".resume-document")!
          const rule = document.querySelector("hr")!

          return {
            fontFamily: getComputedStyle(document_).fontFamily,
            ruleHeight: getComputedStyle(rule).height,
            loaded: [...document.fonts].some(
              (face) => face.family === wanted && face.status === "loaded"
            )
          }
        }, family)

        // The face the style asks for is first in the stack, and the browser
        // really has it — not the metric-matched fallback behind it.
        expect(seen.fontFamily.startsWith(`"${family}"`)).toBe(true)
        expect(seen.loaded, `${family} did not load`).toBe(true)

        // No rule at all is Modern's whole departure, and Tailwind's preflight
        // gives every `hr` a 1px border that would quietly undo it.
        expect(seen.ruleHeight === "0px").toBe(!drawsRules)

        // The print has no origin and no network. A single request here means a
        // face resolved to a URL instead of to the bytes inlined beside it, and
        // the PDF would render in whatever the system had.
        expect(requested.filter((url) => !url.startsWith("about:"))).toEqual([])

        // Nothing runs off the paper. The date column is a fixed width the
        // style chooses, and a range too long for it used to sit on top of the
        // employer name instead of wrapping — a bug only the browser can see,
        // because the markup for it is identical either way.
        expect(await overflowing(page)).toEqual([])
      } finally {
        await browser.close()
      }
    },
    30_000
  )
})

/**
 * The sizes and spacing a style actually renders at.
 *
 * The one measurement that catches a whole class of silent failure: a `var()`
 * inside a custom property is substituted where it is *declared*, so a derived
 * scale written on `:root` freezes at `:root`'s values and inherits that way.
 * Every overlay's `--resume-text-base`, ratio and rhythm did nothing, and all
 * three styles rendered at identical sizes — while the stylesheet read as
 * though they did not. Nothing about the markup or the CSS source says so; only
 * a browser does.
 */
async function measure(page: Page, style: ResumeStyle, sheet: string) {
  await page.setContent(await resumePdfDocument({ ...data, style }, sheet), {
    waitUntil: "load"
  })
  await page.evaluate(() => document.fonts.ready)

  return page.evaluate(() => ({
    body: parseFloat(
      getComputedStyle(document.querySelector(".resume-document")!).fontSize
    ),
    name: parseFloat(getComputedStyle(document.querySelector("h1")!).fontSize),
    section: parseFloat(
      getComputedStyle(document.querySelector("section")!).paddingBottom
    )
  }))
}

describe.skipIf(!css)("the type scale", () => {
  it("moves with the style rather than being fixed on the root", async () => {
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()
      const classic = await measure(page, "classic", css!)
      const standard = await measure(page, "standard", css!)
      const modern = await measure(page, "modern", css!)

      // Classic is set larger because a serif reads smaller at the same size.
      expect(classic.body).toBeGreaterThan(standard.body)

      // Modern's whole rhythm is more generous, and its name is a display size.
      expect(modern.section).toBeGreaterThan(standard.section)
      expect(modern.name).toBeGreaterThan(standard.name)

      // And no two directions land on the same document.
      const shapes = [classic, standard, modern].map((at) => JSON.stringify(at))

      expect(new Set(shapes).size).toBe(3)
    } finally {
      await browser.close()
    }
  }, 30_000)
})

/**
 * Anything drawn wider than the element that contains it.
 *
 * Reported by text rather than by count, so a failure says which entry ran off
 * the page. One pixel of slack for sub-pixel layout rounding.
 */
function overflowing(page: {
  evaluate: <T>(fn: (arg: number) => T, arg: number) => Promise<T>
}) {
  return page.evaluate((slack: number) => {
    const inside = [...document.querySelectorAll<HTMLElement>(".resume-page *")]

    return inside
      .filter((element) => element.scrollWidth > element.clientWidth + slack)
      .map((element) => element.textContent?.slice(0, 60) ?? "")
  }, 1)
}
