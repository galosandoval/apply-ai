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

/**
 * One block's markup, found by something it says.
 *
 * Blocks are siblings rather than a tree, so splitting on the marker gives one
 * chunk per block, each running to where the next one starts.
 */
const blockSaying = (html: string, said: string) =>
  html.split('data-resume-block="').find((chunk) => chunk.includes(said)) ?? ""

describe("core sections", () => {
  it("renders each core kind from its own typed rows", async () => {
    const html = await renderResumeHtml(
      withSections([
        section({
          id: "a",
          kind: "skills",
          label: "Skills",
          componentType: "groupedList",
          position: 0,
          content: {
            groups: [
              { label: "Languages", items: ["TypeScript", "Go"] },
              { label: "Tools", items: ["Docker", "Postgres"] }
            ]
          }
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
          componentType: "groupedList",
          position: 0,
          content: {
            groups: [
              { label: "Languages", items: ["TypeScript", "Go"] },
              { label: "Tools", items: ["Docker", "Postgres"] }
            ]
          }
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

    // Skills is content-bearing now, and this payload has no content for it —
    // so it draws nothing at all, the way any empty section does outside the
    // editor. What the fallback still owes is the order and the labels of the
    // sections that do have something to draw.
    const positions = coreSectionDefaults
      .filter((core) => core.kind !== "skills")
      .map((core) => html.indexOf(`>${core.label}<`))

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
          componentType: "groupedList",
          position: 1,
          content: {
            groups: [{ label: "Languages", items: ["TypeScript", "Go"] }]
          }
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

/** Each block's opening tag, in document order. */
const blockTags = (html: string) =>
  [...html.matchAll(/<div[^>]*data-resume-block="[^"]*"[^>]*>/g)].map(
    ([tag]) => tag
  )

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

  /*
    The placeholder and the heading over it are editor furniture: the print has
    neither. Measured, they would charge a page for height the PDF never draws,
    and the editor would announce a page count the document does not have — the
    one fact a stack of sheets exists to tell the truth about.
  */
  it("marks a placeholder and its heading as drawn for the editor only", async () => {
    const html = await renderResumeHtml(empty, { isEditor: true })

    const marked = blockTags(html).filter((tag) =>
      tag.includes('data-resume-editor-only="true"')
    )

    // The section's heading and its placeholder, and not the header above them.
    expect(marked).toHaveLength(2)
    expect(marked[0]).toContain('data-resume-block-kind="heading"')
    expect(marked[1]).toContain('data-resume-block-kind="paragraph"')
  })

  it("marks nothing editor-only in a section that has content", async () => {
    const filled = withSections([
      section({
        id: "r",
        label: "Summary",
        componentType: "richText",
        content: { markdown: "Something worth reading." }
      })
    ])

    const html = await renderResumeHtml(filled, { isEditor: true })

    expect(blockTags(html).length).toBeGreaterThan(0)
    expect(html).not.toContain("data-resume-editor-only")
  })
})

describe("page mode and reflow mode", () => {
  const data = withSections([
    section({
      id: "a",
      kind: "skills",
      label: "Skills",
      componentType: "groupedList",
      position: 0,
      content: {
        groups: [{ label: "Languages", items: ["TypeScript", "Go"] }]
      }
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

/**
 * The document as a block list.
 *
 * A block is the smallest run of the document that is never cut — it is
 * assigned whole to one page or not at all. Asserted here through the markup,
 * which is what a caller can observe: the key and the kind each block carries
 * are in the rendered document because that is where they have to be read
 * from, in the editor's DOM and in the PDF's browser.
 */
describe("the block list", () => {
  const everySection = (summary: string) =>
    withSections([
      section({
        id: "a",
        kind: "skills",
        label: "Skills",
        componentType: "groupedList",
        position: 0,
        content: {
          groups: [{ label: "Languages", items: ["TypeScript", "Go"] }]
        }
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
      }),
      section({
        id: "r",
        label: "Summary",
        componentType: "richText",
        position: 3,
        content: { markdown: summary }
      }),
      section({
        id: "g",
        label: "Strengths",
        componentType: "tagList",
        position: 4,
        content: { tags: ["Curious"] }
      }),
      section({
        id: "i",
        label: "Hobbies",
        componentType: "iconList",
        position: 5,
        content: { icons: [{ icon: "music", text: "Piano" }] }
      })
    ])

  const data = everySection("First.\n\nSecond.")

  /** Every block's key, in document order. */
  const keysOf = (html: string) =>
    [...html.matchAll(/data-resume-block="([^"]*)"/g)].map(([, key]) => key)

  it("flattens the document into an ordered list covering every block kind", async () => {
    const html = await renderResumeHtml(data)

    const kinds = [...html.matchAll(/data-resume-block-kind="([^"]*)"/g)].map(
      ([, kind]) => kind
    )

    expect(kinds[0]).toBe("header")
    expect(new Set(kinds)).toEqual(
      new Set([
        "header",
        "heading",
        "entry",
        "bullet",
        "description",
        "paragraph",
        "listGroup",
        "tagRow",
        "iconRow"
      ])
    )
  })

  it("keys each block by its section and its position within it", async () => {
    const html = await renderResumeHtml(data)

    // Experience: its heading, the one job's identity line, its two bullets.
    expect(keysOf(html).filter((key) => key?.startsWith("b:"))).toEqual([
      "b:0",
      "b:1",
      "b:2",
      "b:3"
    ])
  })

  it("keeps a key stable across a re-render and an edit elsewhere", async () => {
    const first = keysOf(await renderResumeHtml(data))
    const again = keysOf(await renderResumeHtml(data))

    expect(again).toEqual(first)

    // A measured height is worth nothing if the block it was taken from is
    // renumbered by an edit two sections away. Position *within the section*
    // is what buys that.
    const edited = keysOf(
      await renderResumeHtml(everySection("A longer\n\nsummary\n\nentirely."))
    )

    const inExperience = (keys: (string | undefined)[]) =>
      keys.filter((key) => key?.startsWith("b:"))

    expect(inExperience(edited)).toEqual(inExperience(first))
  })

  it("keeps an employer, its role and its dates in one block", async () => {
    const html = await renderResumeHtml(data)
    const identity = blockSaying(html, "Analytical Engines")

    // An employer separated from its dates by a sheet of paper is the one
    // split that says something false about the document.
    expect(identity).toContain("1840")
    expect(identity).toContain("Engineer")

    // And the bullets are their own blocks, so the job may split below here.
    expect(identity).not.toContain("Wrote the first algorithm")
  })

  it("puts the unbreakable mark on the block, not on the job or the school", async () => {
    const html = await renderResumeHtml(data)

    // `break-inside-avoid` on an entry is what made a nine-bullet job move
    // whole to the next sheet. The entry row keeps its layout and loses the
    // instruction; every block wrapper carries it instead.
    expect(html).not.toMatch(
      /class="resume-two-column-row[^"]*break-inside-avoid/
    )
    expect(html).toMatch(/class="break-inside-avoid[^"]*" data-resume-block=/)
  })

  it("gives the block the spacing a parent used to own", async () => {
    // Two jobs, so there is an inter-entry gap for a block to own in the
    // first place — with one entry per section the only gap is the section's.
    const html = await renderResumeHtml({
      ...data,
      experience: [
        ...data.experience,
        {
          id: "w2",
          name: "Difference Engines",
          title: "Analyst",
          startDate: "1836",
          endDate: "1840",
          bullets: ["Read the notes"]
        }
      ]
    })

    // A parent cannot space two children that end up on different sheets, so
    // no parent is left holding the rhythm between entries or between groups.
    expect(html).not.toMatch(/class="[^"]*space-y-/)

    // The gap after a section, and the gap before the next entry, belong to
    // the blocks that close them.
    expect(html).toMatch(
      /class="[^"]*pb-resume-section[^"]*" data-resume-block=/
    )
    expect(html).toMatch(/class="[^"]*pb-resume-entry[^"]*" data-resume-block=/)
  })
})

describe("structural invariants", () => {
  const data = withSections([
    section({
      id: "a",
      kind: "skills",
      label: "Skills",
      componentType: "groupedList",
      position: 0,
      content: {
        groups: [{ label: "Languages", items: ["TypeScript", "Go"] }]
      }
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

/**
 * A skills group as a stacked unit: the category, a rule beside it, then the
 * skills on the line below.
 *
 * The shape a labelled group draws as is what makes a long skills section
 * scannable — categories reading down the page, each one's skills wrapping
 * across the full content width rather than starting wherever the longest
 * category name happens to end.
 */
describe("a labelled list group", () => {
  const skills = withSections([
    section({
      id: "a",
      kind: "skills",
      label: "Skills",
      componentType: "groupedList",
      position: 0,
      content: {
        groups: [
          { label: "Languages", items: ["TypeScript", "Go"] },
          { label: "Tools", items: ["Docker", "Postgres"] }
        ]
      }
    })
  ])

  it("gives the category its own line, opened by a mark", async () => {
    const group = blockSaying(await renderResumeHtml(skills), "Languages")

    // The mark comes first and the category reads off it, the way a bullet
    // opens a list item.
    expect(group).toMatch(
      /<hr[^>]*class="[^"]*resume-group-mark[^"]*"\s*\/?>\s*<h3[^>]*>Languages/
    )

    // Its own mark, not the section rule stretched across the line: a fixed
    // length the eye runs down, saying the same thing beside every category —
    // and one every style draws, including the one that has no rules.
    expect(group).not.toMatch(/<hr[^>]*class="[^"]*resume-rule/)
    expect(group).not.toMatch(/<hr[^>]*class="[^"]*flex-1/)
  })

  it("puts the skills on the line below, wrapping across the full width", async () => {
    const group = blockSaying(await renderResumeHtml(skills), "Languages")

    const mark = group.indexOf("<hr")
    const list = group.indexOf("<ul")

    expect(mark).toBeGreaterThan(-1)
    expect(list).toBeGreaterThan(group.indexOf("Languages"))
    expect(group.slice(list)).toMatch(/<ul[^>]*class="[^"]*flex-wrap/)

    // Still one list item per skill: discrete things, not a run of commas.
    expect(group).toContain("<li>TypeScript</li>")
    expect(group).toContain("<li>Go</li>")
  })

  it("keeps a category with its own skills and away from the next group", async () => {
    const html = await renderResumeHtml(skills)

    // One block, category and skills together — a category on one sheet and
    // the skills it names on the next is a heading for nothing.
    expect(blockSaying(html, "Languages")).not.toContain("Tools")

    // And the group carries a gap after itself, so the categories read as
    // separate groups rather than as one run of lines.
    expect(html).toMatch(
      /class="[^"]*pb-resume-entry[^"]*" data-resume-block="[^"]*" data-resume-block-kind="listGroup"/
    )
  })

  it("leaves a flat list with no label as plain bulleted items", async () => {
    const html = await renderResumeHtml(
      withSections([
        section({
          id: "l",
          label: "Languages spoken",
          componentType: "list",
          position: 0,
          content: { items: ["English", "French"] }
        })
      ])
    )

    const group = blockSaying(html, "English")

    expect(group).toContain("list-disc")
    expect(group).not.toContain("<h3")
    expect(group).not.toContain("<hr")
  })
})
