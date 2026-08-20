import { describe, expect, it } from "vitest"
import {
  insertExperienceSchema,
  insertSkillsSchema,
  maxBullets,
  maxSkills,
  minBullets
} from "./crud-schema"

/**
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
    expect(insertExperienceSchema.safeParse(job(filled(minBullets))).success).toBe(
      true
    )
  })

  it("accepts the maximum number of filled bullets", () => {
    expect(insertExperienceSchema.safeParse(job(filled(maxBullets))).success).toBe(
      true
    )
  })

  it("ignores blank lines when counting", () => {
    const withBlanks = [...filled(minBullets), "", "   "]

    expect(insertExperienceSchema.safeParse(job(withBlanks)).success).toBe(true)
  })

  it("rejects fewer than the minimum", () => {
    const result = insertExperienceSchema.safeParse(job(filled(minBullets - 1)))

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      `Write at least ${minBullets} accomplishments`
    )
  })

  it("rejects more than the maximum", () => {
    const result = insertExperienceSchema.safeParse(job(filled(maxBullets + 1)))

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      `Write at most ${maxBullets} accomplishments`
    )
  })

  it("rejects a bullet that is too short", () => {
    const result = insertExperienceSchema.safeParse(job([...filled(2), "short"]))

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      "Each accomplishment must be more than 6 characters"
    )
  })

  it("rejects a bullet that is too long", () => {
    const result = insertExperienceSchema.safeParse(
      job([...filled(2), "x".repeat(301)])
    )

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      "Each accomplishment must be less than 300 characters"
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
