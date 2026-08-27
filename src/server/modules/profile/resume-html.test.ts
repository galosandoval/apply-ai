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
      /<div class="([^"]*)" data-resume-block="([^"]*)" data-resume-block-kind="([^"]*)">/g
    )
  ]

  return opens.map((open, index) => ({
    className: open[1] ?? "",
    key: open[2] ?? "",
    kind: open[3] ?? "",
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
})
