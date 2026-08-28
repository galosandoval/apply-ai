import { describe, expect, it } from "vitest"
import { type ResumeDocumentData } from "~/components/resume-document"
import { resumeStyles } from "~/lib/resume-style"
import { renderResumeHtml, resumePdfDocument } from "./resume-html"

/**
 * Seam 3 — the markup the PDF is printed from.
 *
 * Assertions are on markup, never on PDF bytes: the browser engine is a black
 * box below this seam, and the properties that matter (single column, real
 * lists, contact URLs present as text) are all decided before Chromium runs.
 */

const data: ResumeDocumentData = {
  profession: "Software Engineer",
  contact: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    location: "London, UK",
    phone: "555-0100",
    linkedIn: "linkedin.com/in/ada",
    portfolio: "https://ada.dev"
  },
  experience: [
    {
      id: "w1",
      name: "Analytical Engines",
      title: "Engineer",
      startDate: "1840",
      endDate: "1843",
      bullets: ["Wrote the first algorithm", "Described a general computer"]
    }
  ],
  education: [
    {
      id: "e1",
      name: "Home Tuition",
      degree: "Mathematics",
      startDate: "1830",
      endDate: "1835",
      description: "Studied under De Morgan"
    }
  ]
}

/**
 * Every section shape a resume can hold, on one document.
 *
 * Including the two from the spec's reference shapes — a strengths block of
 * discrete marks and a hobbies row of icon-and-label pairs. A style that was
 * only ever looked at against experience and education breaks the first time
 * someone adds a section nobody tried, so every style is rendered against all
 * five rather than against the core three.
 */
const everyShape: ResumeDocumentData = {
  ...data,
  sections: [
    {
      id: "experience",
      kind: "experience",
      label: "Experience",
      componentType: "twoColumn",
      position: 0
    },
    {
      id: "education",
      kind: "education",
      label: "Education",
      componentType: "twoColumn",
      position: 1
    },
    {
      id: "skills",
      kind: "skills",
      label: "Skills",
      componentType: "groupedList",
      position: 2,
      content: {
        groups: [{ label: "Languages", items: ["TypeScript", "Go"] }]
      }
    },
    {
      id: "summary",
      kind: "custom",
      label: "Summary",
      componentType: "richText",
      position: 3,
      content: { markdown: "Wrote the **first** algorithm." }
    },
    {
      id: "strengths",
      kind: "custom",
      label: "Strengths",
      componentType: "tagList",
      position: 4,
      content: { tags: ["Analysis", "Notation"] }
    },
    {
      id: "hobbies",
      kind: "custom",
      label: "Hobbies",
      componentType: "iconList",
      position: 5,
      content: { icons: [{ icon: "music", text: "Harp" }] }
    },
    {
      id: "awards",
      kind: "custom",
      label: "Awards",
      componentType: "twoColumn",
      position: 6,
      content: { rows: [{ left: "1843", right: "Note G" }] }
    },
    {
      id: "languages",
      kind: "custom",
      label: "Languages",
      componentType: "list",
      position: 7,
      content: { items: ["English", "French"] }
    }
  ]
}

/**
 * The document's blocks, in order — what a page is filled with.
 *
 * Blocks are siblings rather than a tree, so one block's markup is everything
 * between its own opening tag and the next block's. The trailing `</div>` that
 * comes with that is not worth parsing away.
 */
function documentBlocks(html: string) {
  const opens = [
    ...html.matchAll(
      // `[^>]*` between the kind and the section rather than the two spelt
      // adjacent: the order and the editor-only mark sit between them, and a
      // block gaining an attribute should not silently stop being a block here.
      /<div class="([^"]*)" data-resume-block="([^"]*)" data-resume-block-kind="([^"]*)"[^>]*data-resume-section="([^"]*)">/g
    )
  ]

  return opens.map((open, index) => ({
    className: open[1] ?? "",
    key: open[2] ?? "",
    kind: open[3] ?? "",
    order: Number(/data-resume-block-order="(\d+)"/.exec(open[0])?.[1]),
    markup: html.slice(
      open.index + open[0].length,
      opens[index + 1]?.index ?? html.length
    )
  }))
}

describe("renderResumeHtml", async () => {
  const html = await renderResumeHtml(data)

  it("renders every bullet as a real list item inside a list", () => {
    expect(html).toMatch(/<ul[^>]*>/)
    expect(html).toContain("<li")
    expect(html).toContain("Wrote the first algorithm")
    expect(html).toContain("Described a general computer")
  })

  it("uses no tables — a single-column document parses in reading order", () => {
    expect(html).not.toMatch(/<table|<tr|<td/)
  })

  it("renders contact URLs as visible text, not only as link targets", () => {
    // The address has to survive into the PDF's text layer, which only carries
    // what was rendered — an `href` alone is invisible to a parser.
    expect(html).toContain(">linkedin.com/in/ada<")
    expect(html).toContain(">https://ada.dev<")
    expect(html).toContain(">ada@example.com<")
  })

  it("keeps a bare domain clickable by adding a scheme to the href", () => {
    expect(html).toContain('href="https://linkedin.com/in/ada"')
  })

  it("renders read-only — no inputs, no edit placeholders", () => {
    expect(html).not.toContain("<input")
    expect(html).not.toContain("<textarea")
  })

  it("does not clip content to one page", () => {
    expect(html).not.toContain("overflow-hidden")
    expect(html).not.toContain("29.7cm")
  })

  it("makes one bullet the unbreakable unit, not the whole job", () => {
    /*
      This replaces "marks each job and school as unbreakable across a page
      boundary", and the replacement is the point rather than a regression.
      Entry-level unbreakability is what forced a whole job onto the next sheet
      and wasted most of the one before it: a nine-bullet role either fit or
      moved entire. The block is the unit now, and it is deliberately smaller
      than an entry — a job may split between two of its own bullets.
    */
    const [first, second] = ["Wrote the first algorithm", "Described a general"]

    const holding = documentBlocks(html).find((block) =>
      block.markup.includes(first)
    )

    expect(holding?.className).toContain("break-inside-avoid")
    expect(holding?.markup).not.toContain(second)
  })

  // Skills is absent on purpose: this payload carries no sections, so it falls
  // back to the ones a new resume is created with — and Skills is a
  // content-bearing section now, so a payload with no content for it has no
  // skills to draw. The styled fixture below carries one and asserts it.
  it("renders the name, profession and every section it has content for", () => {
    expect(html).toContain("Ada Lovelace")
    expect(html).toContain("Software Engineer")
    expect(html).toContain("Analytical Engines")
    expect(html).toContain("Home Tuition")
  })
})

/**
 * The structural invariants, re-asserted per style.
 *
 * A style is exactly the kind of change that would quietly reintroduce a
 * sidebar, a layout table or a heading rendered as an image — and those are the
 * documented causes of parse failure this whole approach exists to avoid. The
 * three directions carry identity through type, so this is the test that says
 * they still only do that.
 */
describe.each(resumeStyles)("the %s style", (style) => {
  const render = (data: ResumeDocumentData) =>
    renderResumeHtml({ ...data, style })

  it("puts the document in its own overlay class and nothing else", async () => {
    const html = await render(data)

    expect(html).toContain(`resume-style-${style}`)

    // One overlay at a time: two on the same element is a document whose
    // values depend on which rule the stylesheet happens to declare last.
    for (const other of resumeStyles.filter((name) => name !== style)) {
      expect(html).not.toContain(`resume-style-${other}`)
    }
  })

  it("uses no table for layout", async () => {
    expect(await render(everyShape)).not.toMatch(/<table|<tr|<td|<th[\s>]/)
  })

  it("renders no text as an image", async () => {
    const html = await render(everyShape)

    expect(html).not.toContain("<img")
    // The icon set is inline SVG and decorative — the label beside it always
    // says the same thing in text — so it is hidden from anything reading the
    // document rather than being content only a person can see.
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/)
  })

  it("stays one column — no multi-column page container", async () => {
    const html = await render(everyShape)

    expect(html).not.toMatch(/\bcolumns-\d|\bcolumn-count|\bgrid-cols-[2-9]/)
  })

  it("keeps contact details in the document, not in a header or footer", async () => {
    const html = await render(everyShape)

    expect(html).not.toMatch(/<header|<footer|<aside/)
    expect(html).toContain(">ada@example.com<")
  })

  it("draws every section shape", async () => {
    const html = await render(everyShape)

    for (const text of [
      "Analytical Engines",
      "Home Tuition",
      "TypeScript",
      "first",
      "Analysis",
      "Harp",
      "Note G",
      "French"
    ]) {
      expect(html).toContain(text)
    }
  })

  it("holds up with nothing on it", async () => {
    const empty: ResumeDocumentData = {
      profession: "",
      contact: {
        fullName: "",
        email: "",
        location: "",
        phone: "",
        linkedIn: "",
        portfolio: ""
      },
      experience: [],
      education: []
    }

    const html = await render(empty)

    expect(html).toContain(`resume-style-${style}`)
    // Empty sections are nothing at all outside the editor — a finished PDF
    // with three headings over three blanks is worse than a short one.
    expect(html).not.toContain("Nothing here yet")
  })

  /*
    The invariants are re-asserted over a stack of pages, not only over the
    flow. Pagination adds an element between the document and its blocks — the
    one place a sidebar, a layout table or a header region could reappear
    without any section changing at all.
  */
  it("holds its structure when the document is a stack of pages", async () => {
    const styled = { ...everyShape, style }
    const keys = documentBlocks(await renderResumeHtml(styled)).map(
      (block) => block.key
    )
    const half = Math.ceil(keys.length / 2)

    const html = await renderResumeHtml(styled, {
      pages: [
        { blocks: keys.slice(0, half), continuedFrom: null },
        { blocks: keys.slice(half), continuedFrom: null }
      ]
    })

    expect(html).not.toMatch(/<table|<tr|<td|<th[\s>]/)
    expect(html).not.toMatch(/\bcolumns-\d|\bcolumn-count|\bgrid-cols-[2-9]/)
    expect(html).not.toContain("<img")
    expect(html).not.toMatch(/<header|<footer|<aside/)
    expect(html).toContain(">ada@example.com<")
  })

  it("keeps a very long entry inside the document rather than beside it", async () => {
    const html = await render({
      ...data,
      contact: {
        ...data.contact,
        fullName: "Augusta Ada King-Noel, Countess of Lovelace"
      },
      experience: [
        {
          ...data.experience[0]!,
          name: "The Analytical Engine Programming and Mechanical Computation Society of Great Britain",
          bullets: ["Wrote ".repeat(120).trim()]
        }
      ]
    })

    // `min-w-0` on the content column is what lets a flex child shrink below
    // its content width; without it a long unbroken run pushes the column wider
    // than the page and the date column off the edge of the paper.
    expect(html).toContain("min-w-0")
    expect(html).toContain("Countess of Lovelace")
  })
})

describe("resumePdfDocument", () => {
  it("inlines the stylesheet it is given", async () => {
    const document = await resumePdfDocument(data, ".text-10pt{font-size:10pt}")

    expect(document).toContain("<!DOCTYPE html>")
    expect(document).toContain(".text-10pt{font-size:10pt}")
    expect(document).toContain("Ada Lovelace")
  })

  it("references no external stylesheet — the print has no network", async () => {
    const document = await resumePdfDocument(data, "")

    expect(document).not.toContain("<link")
    expect(document).not.toContain("<script")
  })

  /*
    The two documents one print renders: the flow it measures, then the sheets
    it prints. That the sheets carry the margin is asserted over the markup a
    few describes down — this is only that the assignment gets there at all,
    which is the whole of what the route adds to the page it prints.
  */
  it("prints the continuous flow when it has nothing to assign", async () => {
    const document = await resumePdfDocument(data, "")

    expect(document).not.toContain("data-resume-page")
  })

  it("prints the assignment it is given, as sheets", async () => {
    const keys = documentBlocks(await renderResumeHtml(data)).map(
      (block) => block.key
    )
    const at = Math.ceil(keys.length / 2)

    const document = await resumePdfDocument(data, "", [
      { blocks: keys.slice(0, at), continuedFrom: null },
      { blocks: keys.slice(at), continuedFrom: null }
    ])

    expect([...document.matchAll(/data-resume-page="/g)]).toHaveLength(2)
  })
})

/**
 * The document as a stack of pages — what an assignment turns the markup into.
 *
 * The assignment is built by hand here rather than by measuring anything:
 * `paginate` decides where a break lands and is tested against its own
 * arithmetic, and what this file is for is what the markup does once it has
 * been told. Hand-built assignments also buy the cases a measurement would
 * struggle to produce on demand — a job split between two of its own bullets,
 * a page that opens mid-section.
 */
describe("a paginated document", async () => {
  const keys = documentBlocks(await renderResumeHtml(data)).map(
    (block) => block.key
  )

  /** The block keys of one section, in document order. */
  const inSection = (sectionId: string) =>
    keys.filter((key) => key.startsWith(`${sectionId}:`))

  /** Everything up to the first block of `sectionId`, then everything after. */
  function splitAt(sectionId: string, position: number) {
    const at = keys.indexOf(`${sectionId}:${position}`)

    return [keys.slice(0, at), keys.slice(at)]
  }

  /** The page elements of a rendered document, in order. */
  function pageElements(html: string) {
    const opens = [
      ...html.matchAll(/<div class="([^"]*)" data-resume-page="[^>]*>/g)
    ]

    return opens.map((open, index) => ({
      className: open[1] ?? "",
      openTag: open[0],
      markup: html.slice(
        open.index + open[0].length,
        opens[index + 1]?.index ?? html.length
      )
    }))
  }

  /** The experience section, split between two of one job's own bullets. */
  const splitJob = splitAt("experience", 3)

  const twoPages = [
    { blocks: splitJob[0] ?? [], continuedFrom: null },
    { blocks: splitJob[1] ?? [], continuedFrom: "experience" }
  ]

  it("draws one page element per assigned page", async () => {
    const html = await renderResumeHtml(data, { pages: twoPages })

    expect(pageElements(html)).toHaveLength(2)

    for (const page of pageElements(html)) {
      expect(page.className).toContain("resume-page")
      expect(page.openTag).not.toContain("data-resume-page-unassigned")
    }
  })

  it("puts each block on the page it was assigned to", async () => {
    const [first, second] = pageElements(
      await renderResumeHtml(data, { pages: twoPages })
    )

    expect(first?.markup).toContain("Ada Lovelace")
    expect(first?.markup).not.toContain("Home Tuition")
    expect(second?.markup).toContain("Home Tuition")
    expect(second?.markup).not.toContain("Ada Lovelace")
  })

  it("renders the continuous flow when it is given no assignment", async () => {
    const html = await renderResumeHtml(data)

    expect(pageElements(html)).toHaveLength(0)
    expect(html).toContain("Ada Lovelace")
    expect(html).toContain("Home Tuition")
  })

  it("draws each page as a whole sheet with its margins inside it", async () => {
    const [page] = pageElements(
      await renderResumeHtml(data, { pages: twoPages })
    )

    // A4 in both dimensions, from the same tokens the width always came from,
    // with the print margin on all four sides and the paper's own background
    // and corners — the sheet is the page rather than a box drawn on one.
    for (const utility of [
      "w-resume-page",
      "h-resume-page",
      "px-resume-page-x",
      "py-resume-page-y",
      "bg-resume-paper",
      "rounded-resume-page"
    ]) {
      expect(page?.className).toContain(utility)
    }
  })

  it("never clips a page — a block too tall for one overflows visibly", async () => {
    const html = await renderResumeHtml(data, { pages: twoPages })

    expect(html).not.toContain("overflow-hidden")
    expect(html).not.toContain("overflow-clip")
  })

  /*
    Nothing hidden is only half of it. Sheets are opaque and adjacent, so a
    block too tall for its page would paint *under* the next sheet's background
    and be exactly as invisible as `overflow-hidden` would have made it — the
    clipping arrived at by paint order instead. The stack is ordered in reverse
    so the overflow lands on top of the page below, where the user can see it.
  */
  it("stacks the sheets in reverse so an overflow paints over the next page", async () => {
    const pages = pageElements(
      await renderResumeHtml(data, { pages: twoPages })
    )

    const order = pages.map((page) =>
      Number(/--resume-page-order:\s*(\d+)/.exec(page.openTag)?.[1])
    )

    expect(order).toHaveLength(2)

    for (const [index, z] of order.entries()) {
      expect(z, `page ${index} has no z-index`).not.toBeNaN()
    }

    expect(order[0]).toBeGreaterThan(order[1] ?? 0)
  })

  /*
    The order blocks are *drawn* in is the assignment's, and an assignment is
    always one edit behind the document: a block added since belongs to no page
    and lands on the leftover sheet at the end, past every section that follows
    it. A measurement taken in drawn order would file it there, the next
    measurement would agree with the first, and the document would hold the
    wrong order until the editor was remounted. So each block carries where it
    sits in the document — which is a thing the paper cannot say.
  */
  it("numbers a block by its place in the document, not its place on the paper", async () => {
    const stranded = inSection("experience")[1] ?? ""

    const html = await renderResumeHtml(data, {
      pages: [
        { blocks: keys.filter((key) => key !== stranded), continuedFrom: null }
      ]
    })

    const drawn = documentBlocks(html)

    // Drawn last, on the sheet the assignment did not name...
    expect(drawn.at(-1)?.key).toBe(stranded)

    // ...and numbered where the document has it, so sorting puts it back.
    expect([...drawn].sort((a, b) => a.order - b.order).map((b) => b.key)) //
      .toEqual(keys)
  })

  it("opens a continued page with the heading of the section it continues", async () => {
    const [, second] = pageElements(
      await renderResumeHtml(data, { pages: twoPages })
    )

    expect(second?.markup).toContain("Experience")
    expect(second?.markup).toMatch(/data-resume-continued="true"/)
  })

  it("marks that heading apart from a real second section of the name", async () => {
    const html = await renderResumeHtml(data, { pages: twoPages })

    // The title text is untouched: the distinction is carried in the markup so
    // that a parser can tell a repeat from a section, and so a style could
    // later letter it differently without editing the user's own section name.
    expect(html).not.toContain("continued)")

    const headings = documentBlocks(html).filter(
      (block) => block.kind === "heading"
    )

    // The real heading is a block of the document and appears once; the repeat
    // carries no block key at all, so measurement cannot mistake it for one.
    expect(
      headings.filter((block) => block.key === inSection("experience")[0])
    ).toHaveLength(1)
  })

  it("keeps a bullet a real list item when a job spans two pages", async () => {
    const [, second] = pageElements(
      await renderResumeHtml(data, { pages: twoPages })
    )

    expect(second?.markup).toContain("Described a general computer")
    expect(second?.markup).toMatch(/<ul[^>]*>\s*<li/)
  })

  it("draws what the assignment left out rather than losing it", async () => {
    // An assignment measures the document as it was a moment ago, so a block
    // added since is a block no page claims. It gets a sheet rather than being
    // dropped — the same choice the overflowing page is.
    const html = await renderResumeHtml(data, {
      pages: [{ blocks: splitJob[0] ?? [], continuedFrom: null }]
    })

    expect(pageElements(html)).toHaveLength(2)
    expect(pageElements(html)[1]?.markup).toContain("Home Tuition")

    // Marked, because it is not one of the pages that were assigned: a parser
    // counting the assignment against the markup would otherwise find one page
    // more than it asked for and no way to tell which one it was.
    expect(pageElements(html)[0]?.openTag).not.toContain(
      "data-resume-page-unassigned"
    )
    expect(pageElements(html)[1]?.openTag).toContain(
      'data-resume-page-unassigned="true"'
    )
  })

  it("leaves the phone alone — reflow is one flow, not a stack of pages", async () => {
    const html = await renderResumeHtml(data, {
      mode: "reflow",
      pages: twoPages
    })

    expect(pageElements(html)).toHaveLength(0)
    expect(html).toContain("resume-reflow")
  })
})
