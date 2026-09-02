import { describe, expect, it } from "vitest"
import { invalid } from "~/lib/validation-message"
import {
  insertExperienceSchema,
  insertSkillsSchema,
  MAX_BULLETS,
  maxSkills,
  MIN_BULLETS
} from "./crud-schema"

/**
 * The messages are keys rather than sentences — the schemas are shared with the
 * server and have no locale to write in, so what they produce is resolved where
 * it is drawn. See `~/lib/validation-message`.
 *
 * The bullets `superRefine` is the only non-trivial validator here: it counts
 * *filled* bullets rather than array entries, because onboarding edits them as
 * one line-separated textarea and a blank line is a user mid-typing.
 */

const job = (bullets: string[]) => ({
  experience: [
    {
      name: "Acme Corp",
      title: "Engineer",
      startDate: "2020",
      endDate: "2022",
      bullets
    }
  ]
})

const filled = (count: number) =>
  Array.from({ length: count }, (_, index) => `Accomplishment number ${index}`)

describe("bullets", () => {
  it("accepts the minimum number of filled bullets", () => {
    expect(
      insertExperienceSchema.safeParse(job(filled(MIN_BULLETS))).success
    ).toBe(true)
  })

  it("accepts the maximum number of filled bullets", () => {
    expect(
      insertExperienceSchema.safeParse(job(filled(MAX_BULLETS))).success
    ).toBe(true)
  })

  it("ignores blank lines when counting", () => {
    const withBlanks = [...filled(MIN_BULLETS), "", "   "]

    expect(insertExperienceSchema.safeParse(job(withBlanks)).success).toBe(true)
  })

  it("rejects fewer than the minimum", () => {
    const result = insertExperienceSchema.safeParse(
      job(filled(MIN_BULLETS - 1))
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      invalid("bulletsMin", { count: MIN_BULLETS })
    )
  })

  it("rejects more than the maximum", () => {
    const result = insertExperienceSchema.safeParse(
      job(filled(MAX_BULLETS + 1))
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      invalid("bulletsMax", { count: MAX_BULLETS })
    )
  })

  it("rejects a bullet that is too short", () => {
    const result = insertExperienceSchema.safeParse(
      job([...filled(2), "short"])
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      invalid("bulletTooShort", { count: 6 })
    )
  })

  it("rejects a bullet that is too long", () => {
    const result = insertExperienceSchema.safeParse(
      job([...filled(2), "x".repeat(301)])
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      invalid("bulletTooLong", { count: 300 })
    )
  })

  it("reports the issue on the array, not on one bullet", () => {
    const result = insertExperienceSchema.safeParse(job([]))

    expect(result.error?.issues[0]?.path).toEqual(["experience", 0, "bullets"])
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
