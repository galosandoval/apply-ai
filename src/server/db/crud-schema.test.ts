import { describe, expect, it } from "vitest"
import { invalid } from "~/lib/validation-message"
import {
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
