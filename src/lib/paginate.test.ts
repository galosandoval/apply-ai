import { describe, expect, it } from "vitest"
import { isSamePagination, type PaginationBlock, paginate } from "./paginate"

/**
 * The break policy, exercised without a browser.
 *
 * Every case here is a measurement the renderer would otherwise have had to
 * take by launching a page and looking at it. The heights are round numbers
 * because the function does not care what a centimetre is — it is handed
 * numbers that already agree with the CSS and decides only where the groups
 * end.
 */

const block = (
  key: string,
  height: number,
  overrides: Partial<Pick<PaginationBlock, "sectionId" | "kind">> = {}
): PaginationBlock => ({
  key,
  sectionId: overrides.sectionId ?? "experience",
  kind: overrides.kind ?? "content",
  height
})

const heading = (key: string, height: number, sectionId: string) =>
  block(key, height, { kind: "heading", sectionId })

const keysPerPage = (blocks: PaginationBlock[], contentHeight: number) =>
  paginate(blocks, { contentHeight }).pages.map((page) => page.blocks)

describe("paginate — greedy assignment", () => {
  it("keeps blocks that all fit on a single page", () => {
    const blocks = [block("a", 100), block("b", 100), block("c", 100)]

    expect(keysPerPage(blocks, 500)).toEqual([["a", "b", "c"]])
  })

  it("starts a new page with the first block that does not fit", () => {
    const blocks = [block("a", 100), block("b", 100), block("c", 100)]

    expect(keysPerPage(blocks, 250)).toEqual([["a", "b"], ["c"]])
  })

  it("fills a page exactly to its content height before breaking", () => {
    const blocks = [block("a", 100), block("b", 100), block("c", 100)]

    expect(keysPerPage(blocks, 200)).toEqual([["a", "b"], ["c"]])
  })

  /*
    The failure this whole area exists to have stopped: a block measured taller
    than the sheet it is drawn on used to disappear. It overflows instead, on a
    page of its own, where it is at least visible and reportable.
  */
  it("gives a block taller than a page its own page rather than dropping it", () => {
    const blocks = [block("a", 100), block("tall", 900), block("c", 100)]

    expect(keysPerPage(blocks, 400)).toEqual([["a"], ["tall"], ["c"]])
  })

  it("keeps every block it was handed", () => {
    const blocks = [
      block("a", 300),
      block("b", 900),
      block("c", 50),
      block("d", 250)
    ]

    const placed = keysPerPage(blocks, 400).flat()

    expect(placed).toEqual(["a", "b", "c", "d"])
  })
})

describe("paginate — the heading rule", () => {
  it("moves a heading that would end a page onto the next page with its section", () => {
    const blocks = [
      block("summary", 180, { sectionId: "summary" }),
      heading("experience-heading", 40, "experience"),
      block("experience-first", 120, { sectionId: "experience" })
    ]

    expect(keysPerPage(blocks, 250)).toEqual([
      ["summary"],
      ["experience-heading", "experience-first"]
    ])
  })

  it("leaves a heading in place when the block after it fits", () => {
    const blocks = [
      block("summary", 100, { sectionId: "summary" }),
      heading("experience-heading", 40, "experience"),
      block("experience-first", 60, { sectionId: "experience" })
    ]

    expect(keysPerPage(blocks, 250)).toEqual([
      ["summary", "experience-heading", "experience-first"]
    ])
  })

  /*
    Neither block is taller than the page; together they are. Something has to
    give, and a heading stranded at the foot of a sheet reads as a bug where an
    overflowing page reads as content that did not fit — which is the truth.
  */
  it("overflows rather than strand a heading that is the whole page", () => {
    const blocks = [
      heading("experience-heading", 200, "experience"),
      block("experience-first", 120, { sectionId: "experience" })
    ]

    expect(keysPerPage(blocks, 250)).toEqual([
      ["experience-heading", "experience-first"]
    ])
  })

  it("overflows rather than strand a heading whose block would fit alone", () => {
    const blocks = [
      block("summary", 200, { sectionId: "summary" }),
      heading("experience-heading", 40, "experience"),
      block("experience-first", 240, { sectionId: "experience" })
    ]

    expect(keysPerPage(blocks, 250)).toEqual([
      ["summary"],
      ["experience-heading", "experience-first"]
    ])
  })

  /*
    The one heading the rule cannot help: an empty section at the end of the
    document has no first block to travel with, so it stays where it landed.
  */
  it("leaves a heading with nothing after it where it is", () => {
    const blocks = [
      block("summary", 100, { sectionId: "summary" }),
      heading("experience-heading", 40, "experience")
    ]

    expect(keysPerPage(blocks, 250)).toEqual([
      ["summary", "experience-heading"]
    ])
  })

  it("never ends a page on a heading when a page of content precedes it", () => {
    const blocks = [
      block("a", 100, { sectionId: "summary" }),
      block("b", 100, { sectionId: "summary" }),
      heading("skills-heading", 40, "skills"),
      block("skills-list", 100, { sectionId: "skills" })
    ]

    const kindOf = new Map(blocks.map(({ key, kind }) => [key, kind]))
    const pages = paginate(blocks, { contentHeight: 250 }).pages
    const lastKinds = pages.map((page) => kindOf.get(page.blocks.at(-1) ?? ""))

    expect(lastKinds).not.toContain("heading")
  })
})

describe("paginate — continued sections", () => {
  it("reports the section a page continues", () => {
    const blocks = [
      heading("experience-heading", 40, "experience"),
      block("bullet-1", 100, { sectionId: "experience" }),
      block("bullet-2", 100, { sectionId: "experience" })
    ]

    const pages = paginate(blocks, { contentHeight: 150 }).pages

    expect(pages).toEqual([
      { blocks: ["experience-heading", "bullet-1"], continuedFrom: null },
      { blocks: ["bullet-2"], continuedFrom: "experience" }
    ])
  })

  /*
    A resume breaks mid-entry far more often than it breaks between entries, so
    two bullets of one job landing on different sheets is the ordinary case, not
    the edge one.
  */
  it("splits a section between two bullets of the same entry", () => {
    const blocks = [
      heading("experience-heading", 40, "experience"),
      block("acme-role", 60, { sectionId: "experience" }),
      block("acme-bullet-1", 60, { sectionId: "experience" }),
      block("acme-bullet-2", 60, { sectionId: "experience" })
    ]

    const result = paginate(blocks, { contentHeight: 170 })

    expect(result).toEqual({
      pages: [
        {
          blocks: ["experience-heading", "acme-role", "acme-bullet-1"],
          continuedFrom: null
        },
        { blocks: ["acme-bullet-2"], continuedFrom: "experience" }
      ]
    })
  })

  it("reports nothing for a page whose first block starts its section", () => {
    const blocks = [
      block("summary", 200, { sectionId: "summary" }),
      heading("skills-heading", 40, "skills"),
      block("skills-list", 60, { sectionId: "skills" })
    ]

    const pages = paginate(blocks, { contentHeight: 220 }).pages

    expect(pages[1]?.continuedFrom).toBeNull()
  })

  it("reports the first page's section as continued from nothing", () => {
    const blocks = [block("only", 10, { sectionId: "summary" })]

    expect(paginate(blocks, { contentHeight: 100 }).pages[0]).toEqual({
      blocks: ["only"],
      continuedFrom: null
    })
  })

  /*
    A section whose id has already been seen is not necessarily continued — a
    page that opens with the section's own heading opens the section, whatever
    came before it.
  */
  it("reports nothing for a page led by its section's own heading", () => {
    const blocks = [
      block("languages", 200, { sectionId: "skills" }),
      heading("skills-heading", 40, "skills"),
      block("skills-list", 100, { sectionId: "skills" })
    ]

    const pages = paginate(blocks, { contentHeight: 250 }).pages

    expect(pages[1]?.continuedFrom).toBeNull()
  })

  it("reports a continued section that has no heading of its own", () => {
    const blocks = [
      block("contact-1", 100, { sectionId: "contact" }),
      block("contact-2", 100, { sectionId: "contact" })
    ]

    const pages = paginate(blocks, { contentHeight: 150 }).pages

    expect(pages[1]?.continuedFrom).toBe("contact")
  })

  /*
    The renderer redraws the heading at the top of a continued page, so that
    heading is real height on a real page. Budgeted as though it were not there,
    every continued page comes out one heading too full — and a page too full is
    an overflow the user sees, which is the failure this whole area exists to
    have stopped.
  */
  it("charges a continued page for the heading redrawn on it", () => {
    const blocks = [
      heading("h", 50, "experience"),
      ...[1, 2, 3, 4, 5, 6].map((n) => block(`b${n}`, 80))
    ]

    // 250 fits the heading and two bullets, or three bullets on their own. A
    // continued page gets two, because the repeated heading takes the third
    // bullet's room.
    expect(keysPerPage(blocks, 250)).toEqual([
      ["h", "b1", "b2"],
      ["b3", "b4"],
      ["b5", "b6"]
    ])
  })

  it("charges nothing to a page that opens a section of its own", () => {
    const blocks = [
      heading("summary-heading", 50, "summary"),
      block("summary", 150, { sectionId: "summary" }),
      heading("skills-heading", 50, "skills"),
      ...[1, 2].map((n) => block(`skill-${n}`, 100, { sectionId: "skills" }))
    ]

    // The second page starts its own section, so nothing is redrawn above it
    // and all 250 of its height is content.
    expect(keysPerPage(blocks, 250)).toEqual([
      ["summary-heading", "summary"],
      ["skills-heading", "skill-1", "skill-2"]
    ])
  })

  it("charges nothing for a continued section drawn without a heading", () => {
    const blocks = [1, 2, 3, 4].map((n) =>
      block(`contact-${n}`, 100, { sectionId: "contact" })
    )

    // No heading to repeat is no height to reserve: both pages hold two.
    expect(keysPerPage(blocks, 250)).toEqual([
      ["contact-1", "contact-2"],
      ["contact-3", "contact-4"]
    ])
  })
})

describe("paginate — degenerate input", () => {
  it("returns no pages for no blocks", () => {
    expect(paginate([], { contentHeight: 500 })).toEqual({ pages: [] })
  })

  /*
    A zero content height is what the renderer hands over on its first pass,
    before the sheet has been laid out and measured. One block per page is
    wrong-looking but drawable, and the next measurement corrects it.
  */
  it("gives each block its own page when nothing fits", () => {
    const blocks = [block("a", 100), block("b", 100)]

    expect(keysPerPage(blocks, 0)).toEqual([["a"], ["b"]])
  })

  it("treats a negative content height as a page that holds nothing", () => {
    expect(keysPerPage([block("a", 100), block("b", 100)], -50)).toEqual([
      ["a"],
      ["b"]
    ])
  })

  it("treats an unmeasured height as no height at all", () => {
    const blocks = [
      block("a", Number.NaN),
      block("b", Number.NaN),
      block("c", Number.NaN)
    ]

    expect(keysPerPage(blocks, 100)).toEqual([["a", "b", "c"]])
  })

  /*
    The renderer measures, paginates, draws, and measures again. If the same
    heights ever produced a different grouping, that loop would never settle.
  */
  it("yields the same pages for the same input", () => {
    const blocks = [
      heading("h", 40, "experience"),
      block("a", 120),
      block("b", 120),
      block("c", 900)
    ]

    const first = paginate(blocks, { contentHeight: 250 })
    const second = paginate(blocks, { contentHeight: 250 })

    expect(first).toEqual(second)
  })

  it("does not mutate the blocks it is handed", () => {
    const blocks = [heading("h", 40, "experience"), block("a", 120)]
    const before = structuredClone(blocks)

    paginate(blocks, { contentHeight: 100 })

    expect(blocks).toEqual(before)
  })
})

/*
  The renderer measures the document it just drew, so it re-paginates far more
  often than the answer actually changes: every keystroke, every hover over a
  style button. Storing an assignment that agrees with the one held would
  re-render the document for nothing, which is the flicker this comparison
  exists to have stopped.
*/
describe("isSamePagination", () => {
  const page = (blocks: string[], continuedFrom: string | null = null) => ({
    blocks,
    continuedFrom
  })

  it("holds a fresh result equal to the one it was computed from", () => {
    const blocks = [heading("h", 40, "experience"), block("a", 120)]
    const first = paginate(blocks, { contentHeight: 300 })
    const second = paginate(blocks, { contentHeight: 300 })

    expect(isSamePagination(first.pages, second.pages)).toBe(true)
  })

  it("separates assignments with a different number of pages", () => {
    expect(isSamePagination([page(["a"])], [page(["a"]), page(["b"])])).toBe(
      false
    )
  })

  it("separates assignments that put a block on a different page", () => {
    const left = [page(["a", "b"]), page(["c"])]
    const right = [page(["a"]), page(["b", "c"])]

    expect(isSamePagination(left, right)).toBe(false)
  })

  it("separates a page that continues a section from one that starts it", () => {
    expect(isSamePagination([page(["a"], "experience")], [page(["a"])])).toBe(
      false
    )
  })

  it("separates two pages continued from different sections", () => {
    expect(
      isSamePagination([page(["a"], "experience")], [page(["a"], "education")])
    ).toBe(false)
  })

  /*
    Order is the assignment. Two pages holding the same keys in a different
    order is a document that reads differently, not the same one.
  */
  it("separates pages whose blocks are in a different order", () => {
    expect(isSamePagination([page(["a", "b"])], [page(["b", "a"])])).toBe(false)
  })

  it("holds two empty assignments equal", () => {
    expect(isSamePagination([], [])).toBe(true)
  })
})
