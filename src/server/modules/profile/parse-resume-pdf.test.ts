import { afterEach, describe, expect, it, vi } from "vitest"
import {
  extractResumeFields,
  importedSections,
  parsedResumeSchema
} from "./parse-resume-pdf"

/**
 * The half of the import that turns text into fields.
 *
 * Only the transport is stubbed — `fetch` returns a completion, and what is
 * under test is what this module does with the JSON inside it. The router seam
 * in `profile.test.ts` stubs this whole function, so the caps and the leniency
 * below have nowhere else they could be asserted.
 */

/** One OpenAI completion carrying `payload` as its message content. */
function completionOf(payload: unknown) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content: JSON.stringify(payload) } }]
      })
  } as Response
}

function respondsWith(payload: unknown) {
  vi.spyOn(global, "fetch").mockResolvedValue(completionOf(payload))
}

const job = (name: string) => ({
  name,
  title: "Engineer",
  startDate: "2020",
  endDate: "2021",
  current: false,
  location: "",
  body: ""
})

const school = (name: string) => ({
  name,
  degree: "BSc",
  startDate: "2016",
  endDate: "2020",
  current: false,
  location: "",
  gpa: "",
  body: ""
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("extractResumeFields", () => {
  /**
   * #98. The cap is this module's, not the prompt's, precisely so that it can
   * be seen to have bitten: a model asked to return at most five jobs truncates
   * the history upstream, where nothing downstream can tell the user about it.
   */
  it("keeps the most recent history and says it capped the rest", async () => {
    respondsWith({
      experience: ["a", "b", "c", "d", "e", "f"].map(job),
      education: ["v", "w", "x", "y", "z"].map(school)
    })

    const parsed = await extractResumeFields("the resume's text layer")

    expect(parsed.experience.map((entry) => entry.name)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e"
    ])
    expect(parsed.education).toHaveLength(4)
    expect(parsed.truncated).toEqual({ experience: true, education: true })
  })

  it("reports nothing capped when nothing was", async () => {
    respondsWith({ experience: [job("a")], education: [school("z")] })

    const parsed = await extractResumeFields("the resume's text layer")

    expect(parsed.truncated).toEqual({ experience: false, education: false })
  })

  it("reads the email off the document", async () => {
    respondsWith({ email: "ada@analytical.engine" })

    const parsed = await extractResumeFields("the resume's text layer")

    expect(parsed.email).toBe("ada@analytical.engine")
  })
})

describe("the parsed schema stays lenient", () => {
  it("fills what a payload leaves out rather than refusing it", () => {
    const parsed = parsedResumeSchema.parse({ firstName: "Ada" })

    expect(parsed.firstName).toBe("Ada")
    expect(parsed.email).toBe("")
    expect(parsed.sections).toEqual([])
  })

  /**
   * A `sections` the model wrote as something other than a list is one reading
   * of the document lost. It must not also cost the user the jobs and the
   * schools that arrived in the same payload.
   */
  it("drops a malformed section list without dropping the import", () => {
    const parsed = parsedResumeSchema.parse({
      firstName: "Ada",
      experience: [job("Acme")],
      sections: "Profile, Hobbies"
    })

    expect(parsed.sections).toEqual([])
    expect(parsed.experience).toHaveLength(1)
  })

  it("keeps a section the model only half filled in", () => {
    const parsed = parsedResumeSchema.parse({
      sections: [{ heading: "Certifications" }]
    })

    expect(parsed.sections[0]).toEqual({
      heading: "Certifications",
      position: 0,
      entries: [],
      text: ""
    })
  })
})

describe("importedSections", () => {
  const parse = (sections: unknown[]) => parsedResumeSchema.parse({ sections })

  it("orders by the position the model reported, not the array", () => {
    const parsed = parse([
      { heading: "Hobbies", position: 2, entries: ["Chess"] },
      { heading: "Profile", position: 0, text: "Ships things." }
    ])

    expect(importedSections(parsed).map((section) => section.heading)).toEqual([
      "Profile",
      "Hobbies"
    ])
  })

  it("keeps the array's order where the model numbered two the same", () => {
    const parsed = parse([
      { heading: "Second", position: 0 },
      { heading: "First", position: 0 }
    ])

    expect(importedSections(parsed).map((section) => section.heading)).toEqual([
      "Second",
      "First"
    ])
  })

  it("reads entries as entries and a paragraph as prose", () => {
    const parsed = parse([
      { heading: "Hobbies", entries: ["Chess", "  ", "Bouldering"] },
      { heading: "Profile", position: 1, text: "Ships things." }
    ])

    expect(importedSections(parsed).map((section) => section.content)).toEqual([
      { type: "entries", entries: ["Chess", "Bouldering"] },
      { type: "prose", text: "Ships things." }
    ])
  })

  it("drops a section with nothing to recognise it by", () => {
    const parsed = parse([
      { heading: "   ", entries: ["Orphaned"] },
      { heading: "  Hobbies  ", position: 1, entries: ["Chess"] }
    ])

    // The surviving heading is trimmed, not otherwise touched: it is the user's
    // own text, and the label it is written with has to be what they typed.
    expect(importedSections(parsed).map((section) => section.heading)).toEqual([
      "Hobbies"
    ])
  })
})
