import { createId } from "@paralleldrive/cuid2"
import { asc, eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { callerFor } from "~/server/api/test-caller"
import { resume, section, user } from "~/server/db/schema"
import {
  connectTestDatabase,
  disconnectTestDatabase,
  resetTestDatabase,
  testDatabaseUrl,
  type TestDatabase
} from "~/server/db/test-database"

/**
 * The sections the account is the master copy of, driven through
 * `appRouter.createCaller(ctx)` against a real database.
 *
 * The same router the resume editor calls, with the resume left out of the
 * input — so what is under test is that one service answers to both owners, and
 * that a section id from somewhere else finds nothing rather than being edited.
 *
 * Requires `TEST_DATABASE_URL`. See `.env.example`.
 */

const hasTestDatabase = !!testDatabaseUrl

if (!hasTestDatabase) {
  console.warn(
    "\n  ⚠ TEST_DATABASE_URL is not set — skipping the account section tests.\n"
  )
}

let db: TestDatabase

/** Two accounts, so "another account's section" is a real row. */
async function seed() {
  const owner = createId()
  const stranger = createId()

  await db.insert(user).values([
    { id: owner, email: `${owner}@test.dev`, name: "Owner" },
    { id: stranger, email: `${stranger}@test.dev`, name: "Stranger" }
  ])

  return { owner, stranger }
}

/** What the backfill leaves behind for an account with a full profile. */
async function backfill(userId: string) {
  await db.insert(section).values([
    {
      id: createId(),
      userId,
      kind: "skills",
      label: "Skills",
      componentType: "groupedList",
      position: 0
    },
    {
      id: createId(),
      userId,
      kind: "experience",
      label: "Experience",
      componentType: "twoColumn",
      position: 1
    },
    {
      id: createId(),
      userId,
      kind: "education",
      label: "Education",
      componentType: "twoColumn",
      position: 2
    }
  ])
}

describe.skipIf(!hasTestDatabase)("account sections", () => {
  let fixture: Awaited<ReturnType<typeof seed>>

  beforeAll(async () => {
    db = await connectTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestDatabase()
  })

  beforeEach(async () => {
    await resetTestDatabase(db)
    fixture = await seed()
  })

  /** The account's sections as the profile reads them. */
  async function read(userId: string) {
    return (await callerFor(db, userId).profile.read()).sections
  }

  describe("an account with no sections of its own", () => {
    it("reads as the set a resume is created with", async () => {
      const sections = await read(fixture.owner)

      expect(sections.map((row) => row.kind)).toEqual([
        "skills",
        "experience",
        "education"
      ])
      expect(sections.map((row) => row.label)).toEqual([
        "Skills",
        "Experience",
        "Education"
      ])
      expect(sections.map((row) => row.position)).toEqual([0, 1, 2])
    })

    it("stands them in rather than writing them", async () => {
      await read(fixture.owner)

      const rows = await db
        .select()
        .from(section)
        .where(eq(section.userId, fixture.owner))

      expect(rows).toEqual([])
    })
  })

  describe("editing", () => {
    it("adds a section at the end of the account's own list", async () => {
      await backfill(fixture.owner)

      const caller = callerFor(db, fixture.owner)
      const { sectionId } = await caller.section.add({
        onAccount: true,
        label: "Certificates",
        componentType: "list"
      })

      const sections = await read(fixture.owner)
      const added = sections.at(-1)

      expect(added?.id).toBe(sectionId)
      expect(added?.kind).toBe("custom")
      expect(added?.position).toBe(3)
      expect(added?.content).toEqual({ items: [] })
      // The account's own row, not a resume's snapshot of one.
      expect(added?.userId).toBe(fixture.owner)
      expect(added?.resumeId).toBeNull()
    })

    it("writes the heading in the account's language", async () => {
      await db
        .update(user)
        .set({ locale: "es" })
        .where(eq(user.id, fixture.owner))

      const caller = callerFor(db, fixture.owner)

      await caller.section.add({
        onAccount: true,
        label: "Projects",
        presetId: "projects",
        componentType: "twoColumn"
      })

      expect((await read(fixture.owner)).at(-1)?.label).toBe("Proyectos")
    })

    it("renames a section", async () => {
      await backfill(fixture.owner)

      const caller = callerFor(db, fixture.owner)
      const experience = (await read(fixture.owner))[1]

      await caller.section.rename({
        onAccount: true,
        sectionId: experience!.id,
        label: "Work History"
      })

      const sections = await read(fixture.owner)

      expect(sections[1]?.label).toBe("Work History")
      // Renaming changes the heading, never what the section is.
      expect(sections[1]?.kind).toBe("experience")
    })

    it("removes a section", async () => {
      await backfill(fixture.owner)

      const caller = callerFor(db, fixture.owner)
      const education = (await read(fixture.owner))[2]

      await caller.section.remove({ onAccount: true, sectionId: education!.id })

      expect((await read(fixture.owner)).map((row) => row.kind)).toEqual([
        "skills",
        "experience"
      ])
    })

    it("reorders them", async () => {
      await backfill(fixture.owner)

      const caller = callerFor(db, fixture.owner)
      const [skills, experience, education] = await read(fixture.owner)

      await caller.section.reorder({
        onAccount: true,
        sectionIds: [education!.id, experience!.id, skills!.id]
      })

      const sections = await read(fixture.owner)

      expect(sections.map((row) => row.kind)).toEqual([
        "education",
        "experience",
        "skills"
      ])
      expect(sections.map((row) => row.position)).toEqual([0, 1, 2])
    })

    it("refuses a reorder that does not list every section", async () => {
      await backfill(fixture.owner)

      const caller = callerFor(db, fixture.owner)
      const sections = await read(fixture.owner)

      await expect(
        caller.section.reorder({
          onAccount: true,
          sectionIds: [sections[0]!.id]
        })
      ).rejects.toThrow(/every section/i)

      expect((await read(fixture.owner)).map((row) => row.kind)).toEqual([
        "skills",
        "experience",
        "education"
      ])
    })

    it("sets a custom section's content", async () => {
      const caller = callerFor(db, fixture.owner)
      const { sectionId } = await caller.section.add({
        onAccount: true,
        label: "Certificates",
        componentType: "list"
      })

      await caller.section.setContent({
        onAccount: true,
        sectionId,
        content: { items: ["AWS Certified", "CKA"] }
      })

      expect((await read(fixture.owner)).at(-1)?.content).toEqual({
        items: ["AWS Certified", "CKA"]
      })
    })

    it("refuses content on a core section, as it does on a resume", async () => {
      await backfill(fixture.owner)

      const caller = callerFor(db, fixture.owner)
      const experience = (await read(fixture.owner))[1]

      await expect(
        caller.section.setContent({
          onAccount: true,
          sectionId: experience!.id,
          content: { markdown: "restructured" }
        })
      ).rejects.toThrow(/core section/i)
    })
  })

  describe("ownership", () => {
    it("finds nothing for a section belonging to another account", async () => {
      await backfill(fixture.stranger)

      const theirs = (await read(fixture.stranger))[0]
      const caller = callerFor(db, fixture.owner)

      await expect(
        caller.section.rename({
          onAccount: true,
          sectionId: theirs!.id,
          label: "leaked"
        })
      ).rejects.toThrow(/section not found/i)

      await expect(
        caller.section.remove({ onAccount: true, sectionId: theirs!.id })
      ).rejects.toThrow(/section not found/i)

      await expect(
        caller.section.setContent({
          onAccount: true,
          sectionId: theirs!.id,
          content: { items: [] }
        })
      ).rejects.toThrow(/section not found/i)

      expect((await read(fixture.stranger)).map((row) => row.label)).toEqual([
        "Skills",
        "Experience",
        "Education"
      ])
    })

    it("refuses an input that claims both owners, or neither", async () => {
      const caller = callerFor(db, fixture.owner)

      // A client that lost its `resumeId` while the resume loaded must not
      // land on the master copy every resume is drawn from.
      await expect(
        caller.section.add({ label: "Certificates", componentType: "list" })
      ).rejects.toThrow(/not both/i)

      const resumeId = createId()

      await db
        .insert(resume)
        .values({ id: resumeId, profession: "Engineer", userId: fixture.owner })

      await expect(
        caller.section.add({
          resumeId,
          onAccount: true,
          label: "Certificates",
          componentType: "list"
        })
      ).rejects.toThrow(/not both/i)

      expect(await db.select().from(section)).toEqual([])
    })

    it("cannot reach a resume's section through the account", async () => {
      const resumeId = createId()

      await db
        .insert(resume)
        .values({ id: resumeId, profession: "Engineer", userId: fixture.owner })

      const snapshot = {
        id: createId(),
        resumeId,
        kind: "custom",
        label: "Summary",
        componentType: "richText",
        position: 0
      }

      await db.insert(section).values(snapshot)

      const caller = callerFor(db, fixture.owner)

      // The same user owns both, so what refuses this is the owner scope and
      // nothing else: a resume's section is not the account's to edit.
      await expect(
        caller.section.remove({ onAccount: true, sectionId: snapshot.id })
      ).rejects.toThrow(/section not found/i)

      const rows = await db
        .select()
        .from(section)
        .where(eq(section.resumeId, resumeId))
        .orderBy(asc(section.position))

      expect(rows).toHaveLength(1)
    })
  })
})
