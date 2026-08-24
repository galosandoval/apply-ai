import { describe, expect, it } from "vitest"
import {
  type ResumeDocumentData,
  type ResumeDocumentSection
} from "~/components/resume-document"
import { coreSectionDefaults } from "~/lib/section-content"
import { renderResumeHtml } from "./resume-html"

/**
 * Seam 3 — the document rendered to a static markup string.
 *
 * Fixtures in, a string out: no browser, no DOM, no interaction. What a caller
 * observes here is the markup, so that is what is asserted — never how a
 * component reached it.
 *
 * `resume-html.test.ts` covers the PDF shell and the structural invariants of
 * the default document; this file covers the section rendering system.
 */

const section = (
  overrides: Partial<ResumeDocumentSection> & Pick<ResumeDocumentSection, "id">
): ResumeDocumentSection => ({
  kind: "custom",
  label: "Section",
  componentType: "richText",
  position: 0,
  content: { markdown: "" },
  ...overrides
})

const baseData: Omit<ResumeDocumentData, "sections"> = {
  profession: "Software Engineer",
  contact: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    location: "London, UK",
    phone: "555-0100",
    linkedIn: "linkedin.com/in/ada",
    portfolio: "https://ada.dev"
  },
  skill: [
    { id: "s1", category: "Languages", all: "TypeScript, Go" },
    { id: "s2", category: "Tools", all: "Docker, Postgres" }
  ],
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

const withSections = (
  sections: ResumeDocumentSection[]
): ResumeDocumentData => ({
  ...baseData,
  sections
})

describe("core sections", () => {
  it("renders each core kind from its own typed rows", async () => {
    const html = await renderResumeHtml(
      withSections([
        section({
          id: "a",
          kind: "skills",
          label: "Skills",
          componentType: "list",
          position: 0,
          content: null
        }),
        section({
          id: "b",
          kind: "experience",
          label: "Experience",
          componentType: "twoColumn",
          position: 1,
          content: null
        }),
        section({
          id: "c",
          kind: "education",
          label: "Education",
          componentType: "twoColumn",
          position: 2,
          content: null
        })
      ])
    )

    expect(html).toContain("TypeScript")
    expect(html).toContain("Analytical Engines")
    expect(html).toContain("Home Tuition")
  })

  it("renders Experience as the same two-column shape a custom section gets", async () => {
    const core = await renderResumeHtml(
      withSections([
        section({
          id: "b",
          kind: "experience",
          label: "Experience",
          componentType: "twoColumn",
          position: 0,
          content: null
        })
      ])
    )

    const custom = await renderResumeHtml(
      withSections([
        section({
          id: "x",
          label: "Volunteering",
          componentType: "twoColumn",
          content: { rows: [{ left: "2020", right: "Food bank" }] }
        })
      ])
    )

    // The row wrapper is the shape. Both sections draw it, so a section the
    // user added looks like it belongs on the same document.
    const rowClass = /class="([^"]*resume-two-column-row[^"]*)"/

    expect(rowClass.exec(core)?.[1]).toBe(rowClass.exec(custom)?.[1])
  })

  it("renders Skills as labelled groups, one list item per skill", async () => {
    const html = await renderResumeHtml(
      withSections([
        section({
          id: "a",
          kind: "skills",
          label: "Skills",
          componentType: "list",
          position: 0,
          content: null
        })
      ])
    )

    expect(html).toContain("Languages")
    expect(html).toContain("Tools")

    // The stored line is one editable string, but a read-only document draws
    // each skill in it as its own mark — a long list has to be scannable, not a
    // run of commas.
    for (const skill of ["TypeScript", "Go", "Docker", "Postgres"]) {
      expect(html).toContain(`<li>${skill}</li>`)
    }
  })

  it("ignores content stored against a core section — its rows are its content", async () => {
    const html = await renderResumeHtml(
      withSections([
        section({
          id: "b",
          kind: "experience",
          label: "Experience",
          componentType: "twoColumn",
          content: { rows: [{ left: "hacked", right: "restructured" }] }
        })
      ])
    )

    expect(html).not.toContain("restructured")
    expect(html).toContain("Analytical Engines")
  })
})

describe("a document with no sections of its own", () => {
  it("falls back to exactly the sections a new resume is created with", async () => {
    // An unsaved draft and a PDF payload carry none. They must render what the
    // resume will render once it is saved, or the two drift — which is the
    // whole reason both sides read one list.
    const html = await renderResumeHtml(baseData)

    const positions = coreSectionDefaults.map((core) =>
      html.indexOf(`>${core.label}<`)
    )

    expect(positions.every((at) => at > -1)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })
})

describe("a section whose content disagrees with its component", () => {
  it("draws nothing rather than half a section", async () => {
    const html = await renderResumeHtml(
      withSections([
        section({
          id: "g",
          label: "Strengths",
          componentType: "tagList",
          // A rich-text payload on a tag-list section.
          content: { markdown: "not a tag list" }
        })
      ])
    )

    expect(html).not.toContain("Strengths")
    expect(html).not.toContain("not a tag list")
  })

  it("draws nothing for a component type that does not exist", async () => {
    const html = await renderResumeHtml(
      withSections([
        section({ id: "z", label: "Mystery", componentType: "carousel" })
      ])
    )

    expect(html).not.toContain("Mystery")
  })
})

describe("section order and labels", () => {
  it("draws sections in position order, not in the order of the array", async () => {
    const html = await renderResumeHtml(
      withSections([
        section({
          id: "c",
          kind: "education",
          label: "Education",
          componentType: "twoColumn",
          position: 2,
          content: null
        }),
        section({
          id: "a",
          kind: "skills",
          label: "Skills",
          componentType: "list",
          position: 1,
          content: null
        }),
        section({
          id: "b",
          kind: "experience",
          label: "Experience",
          componentType: "twoColumn",
          position: 0,
          content: null
        })
      ])
    )

    expect(html.indexOf("Experience")).toBeLessThan(html.indexOf("Skills"))
    expect(html.indexOf("Skills")).toBeLessThan(html.indexOf("Education"))
  })

  it("shows the name the user gave a section, not its kind", async () => {
    const html = await renderResumeHtml(
      withSections([
        section({
          id: "b",
          kind: "experience",
          label: "Work History",
          componentType: "twoColumn",
          content: null
        })
      ])
    )

    expect(html).toContain("Work History")
  })
})

describe("rich text", () => {
  const render = (markdown: string) =>
    renderResumeHtml(
      withSections([
        section({
          id: "r",
          label: "Summary",
          componentType: "richText",
          content: { markdown }
        })
      ])
    )

  it("renders bold, links and bullet lists from the constrained subset", async () => {
    const html = await render(
      "I am **fast** and [reachable](https://ada.dev).\n\n- Ships\n- Tests"
    )

    expect(html).toContain("<strong>fast</strong>")
    expect(html).toContain('href="https://ada.dev"')
    expect(html).toContain(">reachable<")
    expect(html).toMatch(/<ul[^>]*>/)
    expect(html).toContain("Ships")
    expect(html).toContain("Tests")
  })

  it("escapes everything outside the subset rather than emitting it as markup", async () => {
    const html = await render("Beware <script>alert(1)</script> & co")

    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("&amp; co")
  })

  it("refuses a link scheme that is not a link", async () => {
    const html = await render("[click](javascript:alert(1))")

    expect(html).not.toContain("javascript:")
    // The text survives — a refused link is not a lost sentence.
    expect(html).toContain("click")
  })
})

describe("the other component shapes", () => {
  it("renders both columns of a two-column section", async () => {
    const html = await renderResumeHtml(
      withSections([
        section({
          id: "t",
          label: "Volunteering",
          componentType: "twoColumn",
          content: {
            rows: [{ left: "2019 - 2021", right: "Ran the local food bank" }]
          }
        })
      ])
    )

    expect(html).toContain("2019 - 2021")
    expect(html).toContain("Ran the local food bank")
  })

  it("renders a list as real list items", async () => {
    const html = await renderResumeHtml(
      withSections([
        section({
          id: "l",
          label: "Certificates",
          componentType: "list",
          content: { items: ["AWS Architect", "CKAD"] }
        })
      ])
    )

    expect(html).toMatch(/<ul[^>]*>/)
    expect(html).toContain("AWS Architect")
    expect(html).toContain("CKAD")
  })

  it("renders one mark per tag with the label present as text", async () => {
    const html = await renderResumeHtml(
      withSections([
        section({
          id: "g",
          label: "Strengths",
          componentType: "tagList",
          content: { tags: ["Curious", "Rigorous", "Calm"] }
        })
      ])
    )

    expect(html.match(/resume-tag-item/g)?.length).toBe(3)
    expect(html).toContain("Curious")
    expect(html).toContain("Rigorous")
    expect(html).toContain("Calm")
  })

  it("renders an icon list as inline SVG with the label always in text", async () => {
    const html = await renderResumeHtml(
      withSections([
        section({
          id: "i",
          label: "Hobbies",
          componentType: "iconList",
          content: {
            icons: [
              { icon: "music", text: "Piano" },
              { icon: "not-a-real-icon", text: "Cycling" }
            ]
          }
        })
      ])
    )

    expect(html).toContain("<svg")
    expect(html).not.toContain("<img")
    // An icon is decoration: the label says the same thing in text, and an
    // unknown icon key costs the label nothing.
    expect(html).toContain("Piano")
    expect(html).toContain("Cycling")
  })
})

describe("empty sections", () => {
  const empty = withSections([
    section({
      id: "r",
      label: "Summary",
      componentType: "richText",
      content: { markdown: "" }
    })
  ])

  it("renders nothing in the document", async () => {
    const html = await renderResumeHtml(empty)

    expect(html).not.toContain("Summary")
  })

  it("renders a visible placeholder in the editor", async () => {
    const html = await renderResumeHtml(empty, { isEditor: true })

    expect(html).toContain("Summary")
    expect(html).toContain("resume-section-placeholder")
  })
})

describe("page mode and reflow mode", () => {
  const data = withSections([
    section({
      id: "a",
      kind: "skills",
      label: "Skills",
      componentType: "list",
      position: 0,
      content: null
    }),
    section({
      id: "b",
      kind: "experience",
      label: "Experience",
      componentType: "twoColumn",
      position: 1,
      content: null
    }),
    section({
      id: "g",
      label: "Strengths",
      componentType: "tagList",
      position: 2,
      content: { tags: ["Curious"] }
    }),
    section({
      id: "r",
      label: "Summary",
      componentType: "richText",
      position: 3,
      content: { markdown: "A **short** summary." }
    })
  ])

  const textOf = (html: string) =>
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()

  it("says exactly the same thing in both modes", async () => {
    const page = await renderResumeHtml(data, { mode: "page" })
    const reflow = await renderResumeHtml(data, { mode: "reflow" })

    expect(textOf(reflow)).toBe(textOf(page))
  })

  it("drops the fixed page in reflow so the text is not scaled down", async () => {
    const reflow = await renderResumeHtml(data, { mode: "reflow" })

    expect(reflow).toContain("resume-reflow")
    expect(reflow).not.toContain("w-resume-page")
  })
})

describe("structural invariants", () => {
  const data = withSections([
    section({
      id: "a",
      kind: "skills",
      label: "Skills",
      componentType: "list",
      position: 0,
      content: null
    }),
    section({
      id: "b",
      kind: "experience",
      label: "Experience",
      componentType: "twoColumn",
      position: 1,
      content: null
    }),
    section({
      id: "i",
      label: "Hobbies",
      componentType: "iconList",
      position: 2,
      content: { icons: [{ icon: "music", text: "Piano" }] }
    })
  ])

  it("uses no tables", async () => {
    expect(await renderResumeHtml(data)).not.toMatch(/<table|<tr|<td|<th[\s>]/)
  })

  it("puts no multi-column container at the page level", async () => {
    const html = await renderResumeHtml(data)

    // The two-column *row* is fine — it is a row of one entry, and reading
    // order is preserved. A column split of the page itself is what breaks a
    // parser, so nothing at the document level may declare one.
    expect(html).not.toMatch(/columns\s*:/)
    expect(html).not.toContain("column-count")
    expect(html).not.toMatch(/class="[^"]*resume-page[^"]*(grid-cols|flex-row)/)
  })

  it("keeps contact URLs in the text, not only in an href", async () => {
    const html = await renderResumeHtml(data)

    expect(html).toContain(">linkedin.com/in/ada<")
    expect(html).toContain(">https://ada.dev<")
    expect(html).toContain(">ada@example.com<")
  })

  it("keeps an entry off a page boundary", async () => {
    expect(await renderResumeHtml(data)).toContain("break-inside-avoid")
  })

  it("keeps a section heading with the content it introduces", async () => {
    // A heading that strands at the foot of a page introduces nothing. The
    // heading and its rule are one unbreakable block that the following content
    // may not be separated from.
    const html = await renderResumeHtml(data)

    expect(html).toMatch(
      /class="[^"]*break-inside-avoid break-after-avoid[^"]*"/
    )
  })

  it("names the page only in page mode", async () => {
    // `resume-page` is the marker an assertion about the A4 document hangs off.
    // Reflow is not that document, so it does not answer to that name.
    // The whole class, not the token utilities that share its prefix —
    // `px-resume-page-x` is a spacing step and says nothing about the mode.
    const pageMarker = /resume-page(?![-\w])/

    expect(await renderResumeHtml(data, { mode: "reflow" })).not.toMatch(
      pageMarker
    )
    expect(await renderResumeHtml(data, { mode: "page" })).toMatch(pageMarker)
  })

  it("renders read-only markup — no inputs anywhere", async () => {
    const html = await renderResumeHtml(data, { isEditor: true })

    expect(html).not.toContain("<input")
    expect(html).not.toContain("<textarea")
  })

  /**
   * Selection is an editor concern. The editor draws the same component, so
   * nothing about what is selected — or that anything *can* be — may reach a
   * render made without it. A selection outline in a finished PDF is not a
   * cosmetic bug; it is the document saying something it does not mean.
   */
  describe("selection", () => {
    it("emits no click targets", async () => {
      const html = await renderResumeHtml(data, { isEditor: true })

      expect(html).not.toContain('role="button"')
      expect(html).not.toContain("tabindex")
      expect(html).not.toContain("aria-pressed")
    })

    it("emits no selection outline", async () => {
      const html = await renderResumeHtml(data, { isEditor: true })

      expect(html).not.toMatch(/\boutline(-\w+)?\b/)
      expect(html).not.toContain("cursor-pointer")
    })
  })
})
