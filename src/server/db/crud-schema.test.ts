import { describe, expect, it } from "vitest"
import { invalid } from "~/lib/validation-message"
import {
  downloadPdfSchema,
  insertEducationSchema,
  insertExperienceSchema,
  insertSkillsSchema,
  maxBodyLength,
  maxSkills
} from "./crud-schema"

/**
 * The messages are keys rather than sentences — the schemas are shared with the
 * server and have no locale to write in, so what they produce is resolved where
 * it is drawn. See `~/lib/validation-message`.
 *
 * The body is the only non-trivial validator here. It used to be a `bullets`
 * array with a count, a per-bullet minimum and a per-bullet maximum; it is one
 * markdown string now, so what is left to assert is that a job has to say
 * something and that what it says is bounded. How the user divides it between
 * prose and `- ` lines is theirs to decide, and is deliberately not checked.
 */

const job = (body: string) => ({
  experience: [
    {
      name: "Acme Corp",
      title: "Engineer",
      startDate: "2020",
      endDate: "2022",
      body
    }
  ]
})

const school = (body: string) => ({
  education: [
    {
      name: "Somewhere University",
      degree: "Mathematics",
      startDate: "2016",
      endDate: "2020",
      body
    }
  ]
})

describe("an entry's body", () => {
  it("accepts a body of bullets", () => {
    const body = "- Shipped the thing\n- Shipped the other thing"

    expect(insertExperienceSchema.safeParse(job(body)).success).toBe(true)
  })

  it("accepts prose, and prose mixed with bullets", () => {
    expect(
      insertExperienceSchema.safeParse(job("Two sentences of it.")).success
    ).toBe(true)

    expect(
      insertExperienceSchema.safeParse(job("Led the team.\n\n- And shipped it"))
        .success
    ).toBe(true)
  })

  it("rejects a job with nothing under it", () => {
    const result = insertExperienceSchema.safeParse(job("   "))

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      invalid("minChars", { count: 6 })
    )
    expect(result.error?.issues[0]?.path).toEqual(["experience", 0, "body"])
  })

  it("rejects a body past the cap", () => {
    const result = insertExperienceSchema.safeParse(
      job("x".repeat(maxBodyLength + 1))
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      invalid("maxChars", { count: maxBodyLength })
    )
  })

  // A school with nothing to add is a school, where a job with nothing under
  // it is a job the resume says nothing about.
  it("lets a school leave its body empty", () => {
    expect(insertEducationSchema.safeParse(school("")).success).toBe(true)
  })
})

describe("skills", () => {
  const skill = (position: number) => ({
    category: "Languages",
    all: "TypeScript, Go",
    position
  })

  it("accepts up to the maximum number of categories", () => {
    const skills = Array.from({ length: maxSkills }, (_, i) => skill(i))

    expect(insertSkillsSchema.safeParse({ skills }).success).toBe(true)
  })

  it("rejects more than the maximum", () => {
    const skills = Array.from({ length: maxSkills + 1 }, (_, i) => skill(i))

    expect(insertSkillsSchema.safeParse({ skills }).success).toBe(false)
  })

  it("rejects an empty list", () => {
    expect(insertSkillsSchema.safeParse({ skills: [] }).success).toBe(false)
  })
})

/**
 * #71: the date columns stop being free text of any 3–50 characters and become
 * the ISO subset, and "still here" stops being something a user types into the
 * end-date box.
 *
 * The end date is the interesting half. It is required — an entry with no
 * dates is an entry nothing can be sorted, counted or gap-checked by — *unless*
 * the entry is current, in which case it must be absent rather than merely
 * ignored: a row carrying both is a row two readers disagree about.
 */

const dated = (dates: {
  startDate: string
  endDate: string
  current?: boolean
}) => ({
  experience: [
    { name: "Acme Corp", title: "Engineer", body: "- Shipped it", ...dates }
  ]
})

const schooled = (dates: {
  startDate: string
  endDate: string
  current?: boolean
}) => ({
  education: [
    { name: "Somewhere University", degree: "Mathematics", body: "", ...dates }
  ]
})

describe("an entry's dates", () => {
  it.each(["2017", "2017-09", "2017-09-04"])("accepts %s", (startDate) => {
    expect(
      insertExperienceSchema.safeParse(dated({ startDate, endDate: "2021-05" }))
        .success
    ).toBe(true)
  })

  it.each(["Sept 2017", "Present", "2017-13", "2017/09", ""])(
    "refuses %s as a start date",
    (startDate) => {
      const result = insertExperienceSchema.safeParse(
        dated({ startDate, endDate: "2021-05" })
      )

      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(invalid("dateFormat"))
    }
  )

  /*
    The end date is a union of "" and the pattern, so it is worth pinning that a
    bad value still reports the pattern's own message rather than a union error
    the form would render as "Invalid input".
  */
  it("refuses the word a user used to type into the end-date box", () => {
    const result = insertExperienceSchema.safeParse(
      dated({ startDate: "2017-09", endDate: "Present" })
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(invalid("dateFormat"))
  })

  it("requires an end date on an entry that is not current", () => {
    const result = insertExperienceSchema.safeParse(
      dated({ startDate: "2017-09", endDate: "" })
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(invalid("endDateRequired"))
  })

  it("accepts an absent end date when the entry is current", () => {
    expect(
      insertExperienceSchema.safeParse(
        dated({ startDate: "2017-09", endDate: "", current: true })
      ).success
    ).toBe(true)
  })

  it("refuses an end date on an entry that is current", () => {
    const result = insertExperienceSchema.safeParse(
      dated({ startDate: "2017-09", endDate: "2021-05", current: true })
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(invalid("endDateNotCurrent"))
  })

  it("holds a school to the same rules", () => {
    expect(
      insertEducationSchema.safeParse(
        schooled({ startDate: "May 2016", endDate: "2020-05" })
      ).success
    ).toBe(false)

    expect(
      insertEducationSchema.safeParse(
        schooled({ startDate: "2016-09", endDate: "", current: true })
      ).success
    ).toBe(true)
  })
})

/**
 * Printing is not writing.
 *
 * The download payload is the document the user is looking at, and the #71
 * migration deliberately left a date it could not read on the resume rather
 * than blanking it. Holding the print to the write schema's date rules would
 * mean a resume that renders on screen and 400s on download — the user
 * punished for a value the app itself decided to keep.
 */
describe("the download payload", () => {
  const payload = (dates: {
    startDate: string
    endDate: string
    current?: boolean
  }) => ({
    profession: "Engineer",
    contact: {
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      location: "London, UK"
    },
    experience: [
      { name: "Acme", title: "Engineer", body: "- Shipped it", ...dates }
    ],
    education: []
  })

  it("prints a resume whose dates the migration could not read", () => {
    const result = downloadPdfSchema.safeParse(
      payload({ startDate: "2018 - 2020 (contract)", endDate: "Present" })
    )

    expect(result.success).toBe(true)
  })

  it("prints an entry with no end date and no flag", () => {
    expect(
      downloadPdfSchema.safeParse(payload({ startDate: "2017", endDate: "" }))
        .success
    ).toBe(true)
  })

  it("still refuses a payload that is not a resume", () => {
    expect(
      downloadPdfSchema.safeParse({ profession: "Engineer" }).success
    ).toBe(false)
  })
})
