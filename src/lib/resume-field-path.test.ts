import { describe, expect, it } from "vitest"
import {
  formatResumeFieldPath,
  parseResumeFieldPath,
  withRow
} from "./resume-field-path"

/**
 * The 32 assertions recorded in `docs/editable-resume.md`, ported verbatim, plus
 * the branches spec B added: the resume's own contact and skills, and sections.
 *
 * Every edit path in the app routes through this parser, and it is the only
 * thing between a client-supplied string and a column write — so a regression
 * here writes a user's edit to the wrong column.
 *
 * The rejected list below is the proof that spec B *extended* the grammar
 * rather than replacing it: every shape that was refused before is still
 * refused, `email` and `skills.0.all` included. Contact and skills became
 * editable by getting addresses of their own (`contact.email`,
 * `skill.<row>.all`), not by opening up the ones that were closed.
 */

describe("parseResumeFieldPath — accepted paths", () => {
  it("addresses the resume's own profession", () => {
    expect(parseResumeFieldPath("profession")).toEqual({
      section: "resume",
      kind: "column",
      column: "profession"
    })
  })

  it.each(["name", "title", "startDate", "endDate"] as const)(
    "addresses experience.%s",
    (column) => {
      expect(parseResumeFieldPath(`experience.0.${column}`)).toEqual({
        section: "experience",
        kind: "column",
        row: "0",
        column
      })
    }
  )

  it.each(["name", "degree", "startDate", "endDate", "description"] as const)(
    "addresses education.%s",
    (column) => {
      expect(parseResumeFieldPath(`education.0.${column}`)).toEqual({
        section: "education",
        kind: "column",
        row: "0",
        column
      })
    }
  )

  it("addresses a single bullet by index", () => {
    expect(parseResumeFieldPath("experience.0.bullets.2")).toEqual({
      section: "experience",
      kind: "bullet",
      row: "0",
      bulletIndex: 2
    })
  })

  it("accepts a row id in place of an index", () => {
    expect(parseResumeFieldPath("experience.abc123.title")).toEqual({
      section: "experience",
      kind: "column",
      row: "abc123",
      column: "title"
    })
  })

  it.each([
    "fullName",
    "email",
    "location",
    "phone",
    "linkedIn",
    "portfolio"
  ] as const)("addresses contact.%s", (column) => {
    expect(parseResumeFieldPath(`contact.${column}`)).toEqual({
      section: "contact",
      kind: "column",
      column
    })
  })

  it.each(["category", "all"] as const)("addresses skill.%s", (column) => {
    expect(parseResumeFieldPath(`skill.0.${column}`)).toEqual({
      section: "skill",
      kind: "column",
      row: "0",
      column
    })
  })
})

describe("parseResumeFieldPath — sections", () => {
  it("addresses a section's label", () => {
    expect(parseResumeFieldPath("section.sec1.label")).toEqual({
      section: "section",
      kind: "label",
      row: "sec1"
    })
  })

  /**
   * Each content shape belongs to exactly one component type, so the path alone
   * says which component the write is for — and the server can refuse a write
   * whose shape isn't the one the section actually renders.
   */
  const contentPaths = {
    "section.sec1.content.markdown": {
      componentType: "richText",
      field: "markdown"
    },
    "section.sec1.content.items.2": { componentType: "list", index: 2 },
    "section.sec1.content.tags.0": { componentType: "tagList", index: 0 },
    "section.sec1.content.rows.1.left": {
      componentType: "twoColumn",
      index: 1,
      side: "left"
    },
    "section.sec1.content.rows.1.right": {
      componentType: "twoColumn",
      index: 1,
      side: "right"
    },
    "section.sec1.content.icons.0.icon": {
      componentType: "iconList",
      index: 0,
      field: "icon"
    },
    "section.sec1.content.icons.0.text": {
      componentType: "iconList",
      index: 0,
      field: "text"
    }
  }

  it.each(Object.keys(contentPaths))("addresses %s", (path) => {
    expect(parseResumeFieldPath(path)).toEqual({
      section: "section",
      kind: "content",
      row: "sec1",
      content: contentPaths[path as keyof typeof contentPaths]
    })
  })

  describe("rejected section paths", () => {
    const rejected = [
      // A user cannot restructure a section — only its label is writable, and
      // its order goes through a reorder, not a string write.
      "section.sec1.kind",
      "section.sec1.componentType",
      "section.sec1.position",
      "section.sec1.resumeId",
      "section.sec1.id",
      // The content object itself, and a container within it
      "section.sec1.content",
      "section.sec1.content.rows",
      "section.sec1.content.rows.0",
      "section.sec1.content.icons.0",
      // A field that belongs to no component type
      "section.sec1.content.blocks.0",
      "section.sec1.content.rows.0.middle",
      "section.sec1.content.icons.0.href",
      "section.sec1.content.markdown.0",
      // Malformed indices — `Number("")` is 0, so a trailing dot would
      // otherwise coerce into a write to element 0
      "section.sec1.content.items.",
      "section.sec1.content.items.x",
      "section.sec1.content.items.-1",
      "section.sec1.content.rows.x.left",
      // Malformed section ids and arity
      "section",
      "section.sec1",
      "section..label",
      "section.sec1.label.0"
    ]

    it.each(rejected)("rejects %j", (path) => {
      expect(parseResumeFieldPath(path)).toBeNull()
    })
  })
})

describe("parseResumeFieldPath — rejected paths", () => {
  const rejected = [
    // Not a path at all
    "",
    "profession.0",
    // Columns the resume does not own
    "email",
    "userId",
    "profileId",
    "resumeId",
    "skills.0.all",
    // Non-whitelisted columns on a known section
    "experience.0.location",
    "experience.0.profileId",
    "education.0.gpa",
    "education.0.location",
    // The bullets array itself, rather than one bullet
    "experience.0.bullets",
    // Wrong arity
    "experience",
    "experience.0",
    "education.0",
    "experience.0.bullets.0.1",
    // Malformed bullet indices — `Number("")` is 0, so a trailing dot would
    // otherwise coerce into a write to bullet 0
    "experience.0.bullets.",
    "experience.0.bullets.x",
    "experience.0.bullets.-1",
    // Education has no bullets
    "education.0.bullets.0",
    // Unknown section, and an empty row token
    "unknown.0.name",
    "experience..name",
    // Contact and skills are the resume's own now, but only these columns of
    // them: the owning keys and the ordering are still not string writes.
    "contact",
    "contact.userId",
    "contact.resumeId",
    "contact.id",
    "contact.email.0",
    "skill",
    "skill.0",
    "skill.0.position",
    "skill.0.userId",
    "skill..all"
  ]

  it.each(rejected)("rejects %j", (path) => {
    expect(parseResumeFieldPath(path)).toBeNull()
  })
})

describe("index → id → reparse round trip", () => {
  it("swaps an index for a row id and parses back to the same target", () => {
    const fromTemplate = parseResumeFieldPath("experience.1.name")
    expect(fromTemplate).not.toBeNull()

    const forWrite = withRow(fromTemplate!, "cuid-of-job-2")
    const path = formatResumeFieldPath(forWrite)

    expect(path).toBe("experience.cuid-of-job-2.name")
    expect(parseResumeFieldPath(path)).toEqual(forWrite)
  })

  it("round trips a bullet path", () => {
    const target = parseResumeFieldPath("experience.0.bullets.3")!
    const path = formatResumeFieldPath(withRow(target, "cuid-of-job-1"))

    expect(path).toBe("experience.cuid-of-job-1.bullets.3")
    expect(parseResumeFieldPath(path)).toEqual({
      section: "experience",
      kind: "bullet",
      row: "cuid-of-job-1",
      bulletIndex: 3
    })
  })

  it("leaves a resume-level target unchanged when re-rowed", () => {
    const target = parseResumeFieldPath("profession")!

    expect(withRow(target, "anything")).toEqual(target)
    expect(formatResumeFieldPath(target)).toBe("profession")
  })

  it("leaves a contact target unchanged when re-rowed", () => {
    const target = parseResumeFieldPath("contact.email")!

    expect(withRow(target, "anything")).toEqual(target)
    expect(formatResumeFieldPath(target)).toBe("contact.email")
  })

  it("swaps a skill index for a row id", () => {
    const target = parseResumeFieldPath("skill.2.all")!
    const path = formatResumeFieldPath(withRow(target, "cuid-of-skill-3"))

    expect(path).toBe("skill.cuid-of-skill-3.all")
    expect(parseResumeFieldPath(path)).toEqual({
      section: "skill",
      kind: "column",
      row: "cuid-of-skill-3",
      column: "all"
    })
  })

  it.each([
    "section.sec1.label",
    "section.sec1.content.markdown",
    "section.sec1.content.items.2",
    "section.sec1.content.tags.0",
    "section.sec1.content.rows.1.right",
    "section.sec1.content.icons.0.icon"
  ])("round trips %s", (path) => {
    const target = parseResumeFieldPath(path)!

    expect(formatResumeFieldPath(target)).toBe(path)
  })
})
