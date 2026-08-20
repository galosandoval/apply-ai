import { describe, expect, it } from "vitest"
import { type ResumeDocumentData } from "~/components/resume-document"
import { renderResumeHtml, resumePdfDocument } from "./resume-html"

/**
 * Seam 3 — the markup the PDF is printed from.
 *
 * Assertions are on markup, never on PDF bytes: the browser engine is a black
 * box below this seam, and the properties that matter (single column, real
 * lists, contact URLs present as text) are all decided before Chromium runs.
 */

const data: ResumeDocumentData = {
  fullName: "Ada Lovelace",
  profession: "Software Engineer",
  email: "ada@example.com",
  location: "London, UK",
  phone: "555-0100",
  linkedIn: "linkedin.com/in/ada",
  portfolio: "https://ada.dev",
  skills: [{ id: "s1", category: "Languages", all: "TypeScript, Go", position: 0 }],
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

  it("marks each job and school as unbreakable across a page boundary", () => {
    expect(html).toContain("break-inside-avoid")
  })

  it("renders the name, profession and every section", () => {
    expect(html).toContain("Ada Lovelace")
    expect(html).toContain("Software Engineer")
    expect(html).toContain("Analytical Engines")
    expect(html).toContain("Home Tuition")
    expect(html).toContain("TypeScript, Go")
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
