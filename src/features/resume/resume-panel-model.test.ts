import { describe, expect, it } from "vitest"
import {
  buildPanel,
  type PanelTranslate,
  type StructureActions
} from "./resume-panel-model"
import { type SavedResume } from "./resume-field-lens"

/**
 * How the panel edits an entry's body.
 *
 * The rest of the panel is generated from the shape registry and is covered
 * where that registry is; what is asserted here is the one thing this change
 * decided: a job's accomplishments are a markdown field rather than a list of
 * one-line inputs with add, remove and reorder buttons around it.
 */

const job = {
  id: "w1",
  name: "Analytical Engines",
  title: "Engineer",
  startDate: "1840",
  endDate: "1843",
  current: false,
  location: null,
  body: "- Wrote the first algorithm",
  position: 0,
  userId: null,
  resumeId: "r1"
}

const school = {
  id: "e1",
  name: "Home Tuition",
  degree: "Mathematics",
  startDate: "1830",
  endDate: "1835",
  current: false,
  location: null,
  gpa: null,
  body: "Studied under De Morgan",
  position: 0,
  userId: null,
  resumeId: "r1"
}

const resume: SavedResume = {
  id: "r1",
  profession: "Software Engineer",
  jobDescription: "",
  style: "standard",
  accent: "#000000",
  language: "en",
  userId: "u1",
  createdAt: new Date(),
  experience: [job],
  education: [school],
  contact: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    location: "London, UK",
    phone: "",
    linkedIn: "",
    portfolio: ""
  },
  sections: []
}

/** The key itself, so a label reads as the key it came from. */
const t: PanelTranslate = (key) => key

/** Nothing here presses a button; the operations only have to exist. */
const structure = {} as StructureActions

const panelFor = (rowId: string, list: "experience" | "education") =>
  buildPanel({
    resume,
    selected: { kind: "row", list, rowId },
    select: () => undefined,
    structure,
    t,
    contentT: t
  })

describe("the panel for one entry", () => {
  it.each([
    ["experience" as const, "w1"],
    ["education" as const, "e1"]
  ])("edits a %s body as markdown", (list, rowId) => {
    const body = panelFor(rowId, list).fields.find(
      (field) => field.path === `${list}.${rowId}.body`
    )

    expect(body?.input).toBe("markdown")
  })

  it("shows the body as it is stored, markers and all", () => {
    const body = panelFor("w1", "experience").fields.find(
      (field) => field.path === "experience.w1.body"
    )

    expect(body?.value).toBe("- Wrote the first algorithm")
  })

  /*
    A job used to own one list — its bullets — with an input, a remove and two
    move buttons per bullet. A bullet is a `- ` line inside the body now, so
    adding, removing and reordering one is typing, and the toolbar's list
    button is what puts the marker there.
  */
  it("gives an entry no list of its own", () => {
    expect(panelFor("w1", "experience").lists).toEqual([])
  })
})

/**
 * #71 put a boolean on the row, in a grammar whose every value is a string.
 * The panel is where that has to look like a checkbox rather than a text field
 * holding the word `true`.
 */
describe("the entry's current flag", () => {
  it("offers it as a checkbox rather than a line of text", () => {
    const field = panelFor("w1", "experience").fields.find(
      (candidate) => candidate.path === "experience.w1.current"
    )

    expect(field?.input).toBe("checkbox")
  })

  it("shows an unset flag as an unticked box", () => {
    const field = panelFor("w1", "experience").fields.find(
      (candidate) => candidate.path === "experience.w1.current"
    )

    expect(field?.value).toBe("")
  })

  it("shows a set flag as a ticked one", () => {
    const current = {
      ...resume,
      experience: [{ ...job, endDate: "", current: true }]
    }

    const field = buildPanel({
      resume: current,
      selected: { kind: "row", list: "experience", rowId: "w1" },
      select: () => undefined,
      structure,
      t,
      contentT: t
    })?.fields.find((candidate) => candidate.path === "experience.w1.current")

    expect(field?.value).toBe("true")
  })

  /*
    Ticking the box has to leave the row in a state the write schema accepts,
    and an entry carrying both a set flag and an end date is exactly what that
    schema refuses.
  */
  it("empties the end date when the box is ticked", () => {
    const field = panelFor("w1", "experience").fields.find(
      (candidate) => candidate.path === "experience.w1.current"
    )

    expect(field?.clears).toEqual({
      path: "experience.w1.endDate",
      value: "1843"
    })
  })

  it("leaves the end date alone while the box is unticked", () => {
    const field = panelFor("w1", "experience").fields.find(
      (candidate) => candidate.path === "experience.w1.endDate"
    )

    expect(field?.disabled).toBeFalsy()
  })

  it("disables the end date under a set flag", () => {
    const current = {
      ...resume,
      experience: [{ ...job, endDate: "", current: true }]
    }

    const field = buildPanel({
      resume: current,
      selected: { kind: "row", list: "experience", rowId: "w1" },
      select: () => undefined,
      structure,
      t,
      contentT: t
    })?.fields.find((candidate) => candidate.path === "experience.w1.endDate")

    expect(field?.disabled).toBe(true)
  })

  it("offers it on a school too", () => {
    const field = panelFor("e1", "education").fields.find(
      (candidate) => candidate.path === "education.e1.current"
    )

    expect(field?.input).toBe("checkbox")
  })
})
