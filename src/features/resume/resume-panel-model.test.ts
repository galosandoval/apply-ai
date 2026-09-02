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
