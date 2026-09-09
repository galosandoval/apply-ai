import { describe, expect, it } from "vitest"
import english from "../../messages/en.json"
import spanish from "../../messages/es.json"
import { type SectionCatalogTranslate } from "./section-catalog"
import {
  type ImportedSectionContent,
  resolveSectionHeading
} from "./section-heading"

/**
 * The import's one decision about shape, exercised the way `section-content` is
 * — values in, values out, no database and no React.
 *
 * The message files are read rather than stubbed: matching is on the *copy* a
 * user sees, so a test with its own invented labels would pass while a real
 * heading fell through to rich text. Both languages are exercised for the same
 * reason — a resolver that only worked on English would silently flatten every
 * Spanish import.
 */

/** `useTranslations("sectionCatalog")`, over the real message tree. */
function catalog(messages: typeof english): SectionCatalogTranslate {
  return (key) => {
    const value = key
      .split(".")
      .reduce<unknown>(
        (node, part) =>
          typeof node === "object" && node !== null
            ? (node as Record<string, unknown>)[part]
            : undefined,
        messages.sectionCatalog
      )

    return typeof value === "string" ? value : ""
  }
}

const t = catalog(english)
const es = catalog(spanish as typeof english)

const prose = (text: string): ImportedSectionContent => ({
  type: "prose",
  text
})

const entries = (...items: string[]): ImportedSectionContent => ({
  type: "entries",
  entries: items
})

describe("the motivating document's headings", () => {
  it("resolves Profile to a summary", () => {
    const resolved = resolveSectionHeading(
      "Profile",
      prose("Senior engineer with ten years on payments."),
      t
    )

    expect(resolved).toEqual({
      label: "Profile",
      presetId: "summary",
      kind: "custom",
      componentType: "richText",
      content: { markdown: "Senior engineer with ten years on payments." }
    })
  })

  it("resolves Certifications to dated entries", () => {
    const resolved = resolveSectionHeading(
      "Certifications",
      entries(
        "AWS Certified Solutions Architect — 2024",
        "Certified Scrum Master (2019)"
      ),
      t
    )

    expect(resolved.presetId).toBe("certificates")
    expect(resolved.componentType).toBe("twoColumn")
    expect(resolved.content).toEqual({
      rows: [
        { left: "AWS Certified Solutions Architect", right: "2024" },
        { left: "Certified Scrum Master", right: "2019" }
      ]
    })
  })

  it("resolves Hobbies to tags", () => {
    const resolved = resolveSectionHeading(
      "Hobbies",
      entries("Bouldering", "Chess, Cooking"),
      t
    )

    expect(resolved.presetId).toBe("hobbies")
    expect(resolved.componentType).toBe("tagList")
    expect(resolved.content).toEqual({
      tags: ["Bouldering", "Chess", "Cooking"]
    })
  })

  it("resolves Projects to its preset", () => {
    const resolved = resolveSectionHeading(
      "Projects",
      entries("Ledger rewrite — 2023"),
      t
    )

    expect(resolved.presetId).toBe("projects")
    expect(resolved.componentType).toBe("twoColumn")
  })

  it("resolves Strengths to its preset", () => {
    const resolved = resolveSectionHeading(
      "Strengths",
      entries("Mentoring", "Incident response"),
      t
    )

    expect(resolved.presetId).toBe("strengths")
    expect(resolved.componentType).toBe("tagList")
    expect(resolved.content).toEqual({
      tags: ["Mentoring", "Incident response"]
    })
  })
})

describe("skills keeps its own kind", () => {
  it("resolves Skills to the skills kind, not to a preset", () => {
    const resolved = resolveSectionHeading(
      "Skills",
      entries("Languages: TypeScript, Go", "Cloud: AWS"),
      t
    )

    expect(resolved).toEqual({
      label: "Skills",
      presetId: null,
      kind: "skills",
      componentType: "groupedList",
      content: {
        groups: [
          { label: "Languages", items: ["TypeScript", "Go"] },
          { label: "Cloud", items: ["AWS"] }
        ]
      }
    })
  })

  // A heading the user qualified is still the section a refresh has to find.
  it("resolves a qualified skills heading to the skills kind", () => {
    const resolved = resolveSectionHeading(
      "Technical Skills",
      entries("Cloud: AWS"),
      t
    )

    expect(resolved.kind).toBe("skills")
    expect(resolved.label).toBe("Technical Skills")
  })

  it("gives every other heading the custom kind", () => {
    expect(resolveSectionHeading("Hobbies", entries("Chess"), t).kind).toBe(
      "custom"
    )
    expect(resolveSectionHeading("Whatever", prose("Text"), t).kind).toBe(
      "custom"
    )
  })
})

describe("an unmatched heading falls back by content shape", () => {
  it("makes prose rich text", () => {
    const resolved = resolveSectionHeading(
      "Colophon",
      prose("Set in Times, printed on a Tuesday."),
      t
    )

    expect(resolved.presetId).toBe(null)
    expect(resolved.componentType).toBe("richText")
    expect(resolved.content).toEqual({
      markdown: "Set in Times, printed on a Tuesday."
    })
  })

  it("makes a list of short strings a tag list", () => {
    const resolved = resolveSectionHeading(
      "Colophon",
      entries("Letterpress", "Bookbinding"),
      t
    )

    expect(resolved.presetId).toBe(null)
    expect(resolved.componentType).toBe("tagList")
    expect(resolved.content).toEqual({ tags: ["Letterpress", "Bookbinding"] })
  })

  it("makes a list of sentences a list", () => {
    const resolved = resolveSectionHeading(
      "Colophon",
      entries(
        "Rebuilt the press from parts found in a barn.",
        "Taught the craft to eleven apprentices over four winters."
      ),
      t
    )

    expect(resolved.presetId).toBe(null)
    expect(resolved.componentType).toBe("list")
    expect(resolved.content).toEqual({
      items: [
        "Rebuilt the press from parts found in a barn.",
        "Taught the craft to eleven apprentices over four winters."
      ]
    })
  })

  it("makes dated entries two columns", () => {
    const resolved = resolveSectionHeading(
      "Colophon",
      entries("Set the Gutenberg reprint — 2018", "Bound the folio | 2021"),
      t
    )

    expect(resolved.presetId).toBe(null)
    expect(resolved.componentType).toBe("twoColumn")
    expect(resolved.content).toEqual({
      rows: [
        { left: "Set the Gutenberg reprint", right: "2018" },
        { left: "Bound the folio", right: "2021" }
      ]
    })
  })

  it("makes an empty section rich text rather than nothing", () => {
    const resolved = resolveSectionHeading("Colophon", entries(), t)

    expect(resolved.componentType).toBe("richText")
    expect(resolved.content).toEqual({ markdown: "" })
  })
})

describe("the user's heading survives every path", () => {
  const paths: [string, ImportedSectionContent][] = [
    ["Profile", prose("A paragraph.")],
    ["Certifications", entries("AWS — 2024")],
    ["Hobbies", entries("Chess")],
    ["Skills", entries("Cloud: AWS")],
    ["Colophon", prose("A paragraph.")],
    ["Colophon", entries("Letterpress")],
    ["Colophon", entries("A whole sentence about the press it was set on.")],
    ["Colophon", entries("Bound the folio — 2021")]
  ]

  it.each(paths)("keeps %s verbatim", (heading, content) => {
    expect(resolveSectionHeading(heading, content, t).label).toBe(heading)
  })

  // The heading is the user's text in the document's own language. A resolver
  // that wrote the preset's label instead would rename a Spanish resume's
  // sections into English the moment it matched one.
  it("does not translate a heading it matched", () => {
    const resolved = resolveSectionHeading(
      "Pasatiempos",
      entries("Ajedrez"),
      es
    )

    expect(resolved.presetId).toBe("hobbies")
    expect(resolved.label).toBe("Pasatiempos")
  })

  it("matches a Spanish heading against Spanish copy, untranslated", () => {
    const resolved = resolveSectionHeading("Perfil", prose("Un párrafo."), es)

    expect(resolved.presetId).toBe("summary")
    expect(resolved.label).toBe("Perfil")
  })

  it("keeps a heading whose case and spacing are the document's", () => {
    expect(
      resolveSectionHeading("  CERTIFICATIONS  ", entries("AWS — 2024"), t)
    ).toMatchObject({ label: "  CERTIFICATIONS  ", presetId: "certificates" })
  })
})

describe("a document is not written in its reader's language", () => {
  it("does not match a heading against a language it was not written in", () => {
    expect(
      resolveSectionHeading("Pasatiempos", entries("Ajedrez"), t)
    ).toMatchObject({ presetId: null, label: "Pasatiempos" })
  })

  it("matches a heading in whichever of the given languages wrote it", () => {
    const languages = [t, es]

    expect(
      resolveSectionHeading("Pasatiempos", entries("Ajedrez"), languages)
        .presetId
    ).toBe("hobbies")
    expect(
      resolveSectionHeading("Hobbies", entries("Chess"), languages).presetId
    ).toBe("hobbies")
  })

  // Both are the skills section as far as one heading can tell. Which one the
  // account keeps is the writer's call, made where the siblings are visible.
  it("gives every heading that names skills the skills kind", () => {
    expect(
      resolveSectionHeading("Soft Skills", entries("Mentoring"), t).kind
    ).toBe("skills")
    expect(
      resolveSectionHeading("Technical Skills", entries("Go"), t).kind
    ).toBe("skills")
  })
})

describe("content is shaped for the component the preset picked", () => {
  it("bullets a list into rich text", () => {
    const resolved = resolveSectionHeading(
      "Summary",
      entries("Ten years on payments.", "Two of them on call."),
      t
    )

    expect(resolved.componentType).toBe("richText")
    expect(resolved.content).toEqual({
      markdown: "- Ten years on payments.\n- Two of them on call."
    })
  })

  it("splits prose into the lines a list draws", () => {
    const resolved = resolveSectionHeading(
      "Achievements",
      prose("- Shipped the thing\n- Shipped the other thing"),
      t
    )

    expect(resolved.componentType).toBe("list")
    expect(resolved.content).toEqual({
      items: ["Shipped the thing", "Shipped the other thing"]
    })
  })

  it("gives an undated entry the whole left column", () => {
    const resolved = resolveSectionHeading(
      "Awards",
      entries("Employee award"),
      t
    )

    expect(resolved.content).toEqual({
      rows: [{ left: "Employee award", right: "" }]
    })
  })

  it("reads a written date range into the right column", () => {
    const resolved = resolveSectionHeading(
      "Licenses",
      entries("Professional Engineer, Mar 2021 – Present"),
      t
    )

    expect(resolved.content).toEqual({
      rows: [{ left: "Professional Engineer", right: "Mar 2021 – Present" }]
    })
  })

  it("gives an icon list the text and leaves the icon to the user", () => {
    const resolved = resolveSectionHeading(
      "Social media",
      entries("github.com/me"),
      t
    )

    expect(resolved.componentType).toBe("iconList")
    expect(resolved.content).toEqual({
      icons: [{ icon: "", text: "github.com/me" }]
    })
  })

  // A document says "Fluent", not "80" — so the level is the neutral one a new
  // meter starts at, and the user moves it.
  it("gives a meter the name and a neutral level", () => {
    const resolved = resolveSectionHeading(
      "Languages",
      entries("Spanish — Native", "German"),
      t
    )

    expect(resolved.componentType).toBe("meter")
    expect(resolved.content).toEqual({
      meters: [
        { label: "Spanish", level: 50 },
        { label: "German", level: 50 }
      ]
    })
  })

  // A resume that writes one skill per line is writing a list of skills, not a
  // page of empty headings.
  it("gathers one-per-line skills into a single group", () => {
    const resolved = resolveSectionHeading(
      "Skills",
      entries("TypeScript", "Go", "Postgres"),
      t
    )

    expect(resolved.content).toEqual({
      groups: [{ label: "", items: ["TypeScript", "Go", "Postgres"] }]
    })
  })

  it("reads two groups written on one line", () => {
    const resolved = resolveSectionHeading(
      "Skills",
      entries("Front-end: React, TypeScript; Back-end: Go"),
      t
    )

    expect(resolved.content).toEqual({
      groups: [
        { label: "Front-end", items: ["React", "TypeScript"] },
        { label: "Back-end", items: ["Go"] }
      ]
    })
  })

  it("cuts tags on the document's own separators", () => {
    const resolved = resolveSectionHeading(
      "Hobbies",
      entries("Chess • Cooking | Bouldering, Running"),
      t
    )

    expect(resolved.content).toEqual({
      tags: ["Chess", "Cooking", "Bouldering", "Running"]
    })
  })

  it("keeps a second date in the date column rather than in the title", () => {
    const resolved = resolveSectionHeading(
      "Certifications",
      entries(
        "AWS SAA, Amazon Web Services, Issued Mar 2024, Expires Mar 2027"
      ),
      t
    )

    expect(resolved.content).toEqual({
      rows: [
        {
          left: "AWS SAA, Amazon Web Services, Issued",
          right: "Mar 2024, Expires Mar 2027"
        }
      ]
    })
  })

  it("reads a line that opens with its date", () => {
    const resolved = resolveSectionHeading(
      "Certifications",
      entries("2024 — AWS Certified Developer"),
      t
    )

    expect(resolved.content).toEqual({
      rows: [{ left: "AWS Certified Developer", right: "2024" }]
    })
  })

  it("keeps a hyphen inside a meter's name", () => {
    const resolved = resolveSectionHeading(
      "Graphs",
      entries("Front-end", "Spanish - Native"),
      t
    )

    expect(resolved.content).toEqual({
      meters: [
        { label: "Front-end", level: 50 },
        { label: "Spanish", level: 50 }
      ]
    })
  })

  it("files an ungrouped skills line under no category", () => {
    const resolved = resolveSectionHeading(
      "Skills",
      entries("TypeScript, Go, Postgres"),
      t
    )

    expect(resolved.content).toEqual({
      groups: [{ label: "", items: ["TypeScript", "Go", "Postgres"] }]
    })
  })

  it("drops blank entries rather than writing empty rows", () => {
    const resolved = resolveSectionHeading(
      "Hobbies",
      entries("Chess", "   ", ""),
      t
    )

    expect(resolved.content).toEqual({ tags: ["Chess"] })
  })
})
