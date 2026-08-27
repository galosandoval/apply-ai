import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  ResumeDocument,
  type ResumeDocumentData
} from "~/components/resume-document"

/**
 * What the editor's document adds that the PDF's does not: click targets.
 *
 * Everything else about the markup is asserted at seam 3, over
 * `renderResumeHtml`, which renders read-only and therefore emits none of
 * this. Selection is drawn here instead, because it is the one thing the
 * block list made harder rather than easier: a job is several blocks now, and
 * what the user selected is one job.
 */

const data: ResumeDocumentData = {
  profession: "Software Engineer",
  contact: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    location: "London, UK",
    phone: "",
    linkedIn: "",
    portfolio: ""
  },
  skill: [{ id: "s1", category: "Languages", all: "TypeScript, Go" }],
  experience: [
    {
      id: "w1",
      name: "Analytical Engines",
      title: "Engineer",
      startDate: "1840",
      endDate: "1843",
      bullets: ["Wrote the first algorithm", "Described a general computer"]
    },
    {
      id: "w2",
      name: "Difference Engines",
      title: "Analyst",
      startDate: "1836",
      endDate: "1840",
      bullets: ["Read the notes"]
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
  ],
  sections: [
    {
      id: "r",
      kind: "custom",
      label: "Summary",
      componentType: "richText",
      position: 0,
      content: { markdown: "A short summary.\n\nAnd a second paragraph." }
    },
    {
      id: "b",
      kind: "experience",
      label: "Experience",
      componentType: "twoColumn",
      position: 1
    }
  ]
}

const render = () =>
  renderToStaticMarkup(
    <ResumeDocument
      data={data}
      isEditor
      selection={{ selected: null, onSelect: () => undefined }}
    />
  )

/** Each click target, and everything inside it. */
function clickTargets(html: string) {
  return [...html.matchAll(/<div class="[^"]*cursor-pointer[^"]*"[^>]*>/g)].map(
    (open, index, opens) =>
      html.slice(
        open.index,
        opens[index + 1]?.index ?? html.lastIndexOf("</div>")
      )
  )
}

describe("selection", () => {
  it("draws one click target around every block of one entry", () => {
    const targets = clickTargets(render())

    // An outline per block is five stacked boxes where the user selected one
    // job. The run of blocks that select the same thing is what the editor
    // draws around — which is what an entry looked like before it was a list.
    const job = targets.find((target) => target.includes("Analytical Engines"))

    expect(job).toContain("Wrote the first algorithm")
    expect(job).toContain("Described a general computer")

    // And it stops at the entry it is: the next job is its own target.
    expect(job).not.toContain("Difference Engines")
  })

  it("gives each entry a target of its own", () => {
    const targets = clickTargets(render())

    expect(targets.filter((target) => target.includes("Engines"))).toHaveLength(
      2
    )
  })

  it("selects a section through its own content, not just its heading", () => {
    const summary = clickTargets(render()).find((target) =>
      target.includes("Summary")
    )

    // A rich-text section is edited *through* the section panel — a box around
    // the heading alone stops at the rule while the panel edits the text under
    // it. Clicking the text used to fall through and clear the selection.
    expect(summary).toContain("A short summary.")
    expect(summary).toContain("And a second paragraph.")
  })

  it("keeps an entry's own target out of its section's", () => {
    const heading = clickTargets(render()).find((target) =>
      target.includes("Experience")
    )

    // The innermost target still wins: a job answers for its own blocks, so
    // the section heading does not swallow them.
    expect(heading).not.toContain("Analytical Engines")
  })

  it("holds the gap between entries outside the target it follows", () => {
    // An outline is drawn outside the padding and inside the margin. Held as
    // padding, the selection box would end a rhythm step below the content.
    const job = clickTargets(render()).find((target) =>
      target.includes("Analytical Engines")
    )

    expect(job).toMatch(/^<div class="[^"]*mb-resume-entry/)
    expect(job).not.toMatch(/^<div class="[^"]*pb-resume-entry/)
  })
})
