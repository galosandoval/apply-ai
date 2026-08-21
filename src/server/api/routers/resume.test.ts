import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import { asc, eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { appRouter } from "~/server/api/root"
import { type CreateResumeInput } from "~/server/modules/resume/resume.schema"
import {
  connectTestDatabase,
  disconnectTestDatabase,
  resetTestDatabase,
  testDatabaseUrl,
  type TestDatabase
} from "~/server/db/test-database"
import { contact, resume, school, section, skill, user, work } from "~/server/db/schema"

/**
 * The 17 assertions recorded in `docs/editable-resume.md`, ported verbatim.
 *
 * Driven through `appRouter.createCaller(ctx)` against a real database — the
 * highest seam that still covers input validation, ownership and the resulting
 * rows in one pass. Nothing below it (repositories, services, query builders)
 * gets its own tests.
 *
 * Requires `TEST_DATABASE_URL`. See `.env.example`.
 */

const hasTestDatabase = !!testDatabaseUrl

if (!hasTestDatabase) {
  // Skipped silently, a green run would read as "the router is covered".
  console.warn(
    "\n  ⚠ TEST_DATABASE_URL is not set — skipping the router integration tests." +
      "\n    Ownership checks and field writes are NOT covered by this run." +
      "\n    See .env.example.\n"
  )
}

let db: TestDatabase

/** Two users, so "another user's resume" is a real row and not a made-up id. */
async function seed() {
  const owner = { userId: createId() }
  const stranger = { userId: createId() }

  for (const who of [owner, stranger]) {
    await db.insert(user).values({
      id: who.userId,
      email: `${who.userId}@test.dev`,
      name: "Test User"
    })
  }

  const resumeId = createId()
  const otherResumeId = createId()

  await db.insert(resume).values([
    { id: resumeId, profession: "Engineer", userId: owner.userId },
    { id: otherResumeId, profession: "Other", userId: owner.userId }
  ])

  const jobId = createId()
  const otherResumesJobId = createId()
  const schoolId = createId()

  await db.insert(work).values([
    {
      id: jobId,
      resumeId,
      name: "Acme",
      title: "Engineer",
      startDate: "2020",
      endDate: "2022",
      bullets: ["first bullet", "second bullet", "third bullet"]
    },
    {
      id: otherResumesJobId,
      resumeId: otherResumeId,
      name: "Other Co",
      title: "Engineer",
      startDate: "2020",
      endDate: "2022",
      bullets: ["untouched"]
    }
  ])

  await db.insert(school).values({
    id: schoolId,
    resumeId,
    name: "State University",
    degree: "BSc",
    startDate: "2016",
    endDate: "2020"
  })

  // The account's master copy: what a new resume is seeded from, and the thing
  // that must not reach back into a resume already saved. `resumeId` null is
  // the only difference between these rows and a snapshot.
  await db.insert(skill).values({
    id: createId(),
    userId: owner.userId,
    category: "Languages",
    all: ["TypeScript", "Go"],
    position: 0
  })

  await db.insert(contact).values({
    id: createId(),
    userId: owner.userId,
    location: "London, UK",
    phone: "555-0100",
    linkedIn: "linkedin.com/in/owner",
    portfolio: "owner.dev"
  })

  return {
    owner,
    stranger,
    resumeId,
    otherResumeId,
    jobId,
    otherResumesJobId,
    schoolId
  }
}

/** A draft the way the preview submits one: whole document, nothing missing. */
function draft(overrides: Partial<CreateResumeInput> = {}): CreateResumeInput {
  return {
    profession: "Software Engineer",
    jobDescription: "Senior TypeScript engineer, remote",
    contact: {
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      location: "London, UK",
      phone: "555-0100",
      linkedIn: "linkedin.com/in/ada",
      portfolio: "ada.dev"
    },
    skill: [
      { category: "Languages", all: "TypeScript, Go" },
      { category: "Databases", all: "Postgres" }
    ],
    experience: [
      {
        name: "Analytical Engines",
        title: "Engineer",
        startDate: "2020",
        endDate: "2022",
        bullets: ["Wrote the first algorithm", "Described a general computer"]
      },
      {
        name: "Difference Engines",
        title: "Engineer",
        startDate: "2018",
        endDate: "2020",
        bullets: ["Built the thing", "Then built the other thing"]
      }
    ],
    education: [
      {
        name: "Home Tuition",
        degree: "Mathematics",
        startDate: "1830",
        endDate: "1835"
      },
      {
        name: "Somerville College",
        degree: "Analysis",
        startDate: "1835",
        endDate: "1838"
      }
    ],
    ...overrides
  }
}

type Seed = Awaited<ReturnType<typeof seed>>

/**
 * A caller with the session a better-auth cookie would have produced. Only
 * `user.id` is read by any procedure, so the rest is the minimum the type wants.
 */
function callerFor(userId: string | null) {
  if (!userId) return appRouter.createCaller({ db, session: null })

  const now = new Date()

  return appRouter.createCaller({
    db,
    session: {
      user: {
        id: userId,
        name: "Test User",
        email: `${userId}@test.dev`,
        emailVerified: false,
        image: null,
        createdAt: now,
        updatedAt: now
      },
      session: {
        id: createId(),
        token: createId(),
        userId,
        expiresAt: new Date(now.getTime() + 60_000),
        createdAt: now,
        updatedAt: now
      }
    }
  })
}

describe.skipIf(!hasTestDatabase)("resume router", () => {
  let fixture: Seed

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

  describe("updateField — writes land on the right column", () => {
    it("writes the resume's own profession", async () => {
      await callerFor(fixture.owner.userId).resume.updateField({
        resumeId: fixture.resumeId,
        path: "profession",
        value: "Staff Engineer"
      })

      const [row] = await db
        .select()
        .from(resume)
        .where(eq(resume.id, fixture.resumeId))

      expect(row?.profession).toBe("Staff Engineer")
    })

    it("writes an experience column", async () => {
      await callerFor(fixture.owner.userId).resume.updateField({
        resumeId: fixture.resumeId,
        path: `experience.${fixture.jobId}.title`,
        value: "Principal Engineer"
      })

      const [row] = await db
        .select()
        .from(work)
        .where(eq(work.id, fixture.jobId))

      expect(row?.title).toBe("Principal Engineer")
      expect(row?.name).toBe("Acme")
    })

    it("writes an education column", async () => {
      await callerFor(fixture.owner.userId).resume.updateField({
        resumeId: fixture.resumeId,
        path: `education.${fixture.schoolId}.degree`,
        value: "MSc"
      })

      const [row] = await db
        .select()
        .from(school)
        .where(eq(school.id, fixture.schoolId))

      expect(row?.degree).toBe("MSc")
    })

    it("replaces exactly one bullet", async () => {
      await callerFor(fixture.owner.userId).resume.updateField({
        resumeId: fixture.resumeId,
        path: `experience.${fixture.jobId}.bullets.1`,
        value: "rewritten"
      })

      const [row] = await db
        .select()
        .from(work)
        .where(eq(work.id, fixture.jobId))

      expect(row?.bullets).toEqual([
        "first bullet",
        "rewritten",
        "third bullet"
      ])
    })
  })

  describe("updateField — rejected paths", () => {
    /** Keyed by name so a failure names the shape that got through. */
    const rejected: Record<string, (seedData: Seed) => string> = {
      "a column on another table": () => "email",
      "a shared section": () => "skills.0.all",
      "the owning key": () => "userId",
      "the resume's own id": () => "resumeId",
      "the bullets array itself": (s) => `experience.${s.jobId}.bullets`,
      "an out-of-range bullet index": (s) => `experience.${s.jobId}.bullets.9`,
      "a non-numeric bullet index": (s) => `experience.${s.jobId}.bullets.x`,
      "a trailing-dot bullet index": (s) => `experience.${s.jobId}.bullets.`,
      "an unknown section": (s) => `nonsense.${s.jobId}.name`
    }

    it.each(Object.keys(rejected))("rejects %s", async (name) => {
      await expect(
        callerFor(fixture.owner.userId).resume.updateField({
          resumeId: fixture.resumeId,
          path: rejected[name]!(fixture),
          value: "should not land"
        })
      ).rejects.toBeInstanceOf(TRPCError)
    })

    it("leaves the row untouched when the path is rejected", async () => {
      await expect(
        callerFor(fixture.owner.userId).resume.updateField({
          resumeId: fixture.resumeId,
          path: `experience.${fixture.jobId}.bullets.9`,
          value: "should not land"
        })
      ).rejects.toThrow()

      const [row] = await db
        .select()
        .from(work)
        .where(eq(work.id, fixture.jobId))

      expect(row?.bullets).toEqual([
        "first bullet",
        "second bullet",
        "third bullet"
      ])
    })
  })

  describe("updateField — ownership", () => {
    it("rejects a row belonging to another resume", async () => {
      await expect(
        callerFor(fixture.owner.userId).resume.updateField({
          resumeId: fixture.resumeId,
          path: `experience.${fixture.otherResumesJobId}.title`,
          value: "leaked"
        })
      ).rejects.toThrow(/not found/i)

      const [row] = await db
        .select()
        .from(work)
        .where(eq(work.id, fixture.otherResumesJobId))

      expect(row?.title).toBe("Engineer")
    })

    it("rejects another user's resume", async () => {
      await expect(
        callerFor(fixture.stranger.userId).resume.updateField({
          resumeId: fixture.resumeId,
          path: "profession",
          value: "leaked"
        })
      ).rejects.toThrow(/resume not found/i)
    })

    it("rejects an unauthenticated caller", async () => {
      await expect(
        callerFor(null).resume.updateField({
          resumeId: fixture.resumeId,
          path: "profession",
          value: "leaked"
        })
      ).rejects.toThrow(/unauthorized/i)
    })
  })

  describe("readById", () => {
    it("returns the resume with its snapshotted rows, ordered by id", async () => {
      const found = await callerFor(fixture.owner.userId).resume.readById({
        resumeId: fixture.resumeId
      })

      const expectedOrder = await db
        .select({ id: work.id })
        .from(work)
        .where(eq(work.resumeId, fixture.resumeId))
        .orderBy(asc(work.id))

      expect(found.profession).toBe("Engineer")
      expect(found.experience.map((job) => job.id)).toEqual(
        expectedOrder.map((job) => job.id)
      )
      expect(found.education).toHaveLength(1)
    })

    it("rejects another user's resume", async () => {
      await expect(
        callerFor(fixture.stranger.userId).resume.readById({
          resumeId: fixture.resumeId
        })
      ).rejects.toThrow(/resume not found/i)
    })
  })

  describe("create — the resume owns what it renders", () => {
    it("keeps the job description it was drafted against", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      const found = await caller.resume.readById({ resumeId })

      expect(found.jobDescription).toBe("Senior TypeScript engineer, remote")
    })

    it("snapshots skills and contact onto the resume", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      const found = await caller.resume.readById({ resumeId })

      expect(found.skill.map((group) => group.category)).toEqual([
        "Languages",
        "Databases"
      ])
      expect(found.skill[0]?.all).toBe("TypeScript, Go")
      expect(found.contact.email).toBe("ada@example.com")
      expect(found.contact.fullName).toBe("Ada Lovelace")
    })

    /**
     * The assertion this whole spec exists for: tailoring one application can
     * no longer rewrite one already sent.
     */
    it("is unchanged when the account is edited afterwards", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      await caller.profile.upsertSkills({
        skills: [{ category: "Rewritten", all: ["Fortran"], position: 0 }]
      })

      await caller.profile.upsertNameAndContact({
        firstName: "Someone",
        lastName: "Else",
        profession: "Chef",
        location: "Paris, FR"
      })

      const found = await caller.resume.readById({ resumeId })

      expect(found.skill.map((group) => group.category)).toEqual([
        "Languages",
        "Databases"
      ])
      expect(found.contact.location).toBe("London, UK")
      expect(found.contact.fullName).toBe("Ada Lovelace")
    })

    it("does not hand a resume's snapshot back as the account's own", async () => {
      const caller = callerFor(fixture.owner.userId)

      await caller.resume.create(draft())

      const profile = await caller.profile.read()

      expect(profile.skills).toHaveLength(1)
      expect(profile.skills[0]?.category).toBe("Languages")
      expect(profile.contact?.location).toBe("London, UK")
    })

    it("orders jobs and schools by the order they were drafted in", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      const found = await caller.resume.readById({ resumeId })

      expect(found.experience.map((job) => job.name)).toEqual([
        "Analytical Engines",
        "Difference Engines"
      ])
      expect(found.experience.map((job) => job.position)).toEqual([0, 1])
      expect(found.education.map((entry) => entry.position)).toEqual([0, 1])
    })

    it("starts with the three core sections, in order", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      const found = await caller.resume.readById({ resumeId })

      expect(found.sections.map((row) => row.kind)).toEqual([
        "skills",
        "experience",
        "education"
      ])
      expect(found.sections.map((row) => row.label)).toEqual([
        "Skills",
        "Experience",
        "Education"
      ])
      expect(found.sections.every((row) => row.content === null)).toBe(true)
    })
  })

  describe("updateField — the resume's own contact and skills", () => {
    it("writes a contact field on this resume only", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const { resumeId: otherId } = await caller.resume.create(draft())

      await caller.resume.updateField({
        resumeId,
        path: "contact.email",
        value: "tailored@example.com"
      })

      expect((await caller.resume.readById({ resumeId })).contact.email).toBe(
        "tailored@example.com"
      )
      expect(
        (await caller.resume.readById({ resumeId: otherId })).contact.email
      ).toBe("ada@example.com")
    })

    it("writes a skill group, splitting the line back into entries", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const [group] = (await caller.resume.readById({ resumeId })).skill

      await caller.resume.updateField({
        resumeId,
        path: `skill.${group!.id}.all`,
        value: "Rust, Zig"
      })

      const [row] = await db.select().from(skill).where(eq(skill.id, group!.id))

      expect(row?.all).toEqual(["Rust", "Zig"])
      expect((await caller.resume.readById({ resumeId })).skill[0]?.all).toBe(
        "Rust, Zig"
      )
    })

    it("leaves the account's master skills alone", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const [group] = (await caller.resume.readById({ resumeId })).skill

      await caller.resume.updateField({
        resumeId,
        path: `skill.${group!.id}.category`,
        value: "Tailored"
      })

      const profile = await caller.profile.read()

      expect(profile.skills[0]?.category).toBe("Languages")
    })

    it("rejects a skill row belonging to another resume", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const { resumeId: otherId } = await caller.resume.create(draft())
      const [theirs] = (await caller.resume.readById({ resumeId: otherId })).skill

      await expect(
        caller.resume.updateField({
          resumeId,
          path: `skill.${theirs!.id}.category`,
          value: "leaked"
        })
      ).rejects.toThrow(/not found/i)
    })
  })

  describe("refreshFromAccount", () => {
    it("pulls the account's current details in, on request", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      await caller.profile.upsertSkills({
        skills: [{ category: "Refreshed", all: ["Fortran"], position: 0 }]
      })

      await caller.resume.refreshFromAccount({ resumeId })

      const found = await caller.resume.readById({ resumeId })

      expect(found.skill.map((group) => group.category)).toEqual(["Refreshed"])
      expect(found.skill[0]?.all).toBe("Fortran")
      expect(found.contact.location).toBe("London, UK")
    })

    it("refreshes only the resume it was asked about", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const { resumeId: otherId } = await caller.resume.create(draft())

      await caller.profile.upsertSkills({
        skills: [{ category: "Refreshed", all: ["Fortran"], position: 0 }]
      })

      await caller.resume.refreshFromAccount({ resumeId })

      const untouched = await caller.resume.readById({ resumeId: otherId })

      expect(untouched.skill.map((group) => group.category)).toEqual([
        "Languages",
        "Databases"
      ])
    })

    it("rejects another user's resume", async () => {
      await expect(
        callerFor(fixture.stranger.userId).resume.refreshFromAccount({
          resumeId: fixture.resumeId
        })
      ).rejects.toThrow(/resume not found/i)
    })
  })

  describe("reorderRows", () => {
    it("reorders the jobs within Experience", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const jobs = (await caller.resume.readById({ resumeId })).experience

      await caller.resume.reorderRows({
        resumeId,
        section: "experience",
        rowIds: [jobs[1]!.id, jobs[0]!.id]
      })

      const found = await caller.resume.readById({ resumeId })

      expect(found.experience.map((job) => job.name)).toEqual([
        "Difference Engines",
        "Analytical Engines"
      ])
    })

    it("reorders the entries within Education", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const schools = (await caller.resume.readById({ resumeId })).education

      await caller.resume.reorderRows({
        resumeId,
        section: "education",
        rowIds: [schools[1]!.id, schools[0]!.id]
      })

      const found = await caller.resume.readById({ resumeId })

      expect(found.education.map((entry) => entry.name)).toEqual([
        "Somerville College",
        "Home Tuition"
      ])
    })

    it("reorders skill groups", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const groups = (await caller.resume.readById({ resumeId })).skill

      await caller.resume.reorderRows({
        resumeId,
        section: "skills",
        rowIds: [groups[1]!.id, groups[0]!.id]
      })

      const found = await caller.resume.readById({ resumeId })

      expect(found.skill.map((group) => group.category)).toEqual([
        "Databases",
        "Languages"
      ])
    })

    it("refuses a row from another resume, and moves nothing", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const { resumeId: otherId } = await caller.resume.create(draft())
      const jobs = (await caller.resume.readById({ resumeId })).experience
      const theirs = (await caller.resume.readById({ resumeId: otherId }))
        .experience

      await expect(
        caller.resume.reorderRows({
          resumeId,
          section: "experience",
          rowIds: [theirs[0]!.id, jobs[0]!.id]
        })
      ).rejects.toThrow(/every row/i)

      const found = await caller.resume.readById({ resumeId })

      expect(found.experience.map((job) => job.name)).toEqual([
        "Analytical Engines",
        "Difference Engines"
      ])
    })

    /**
     * A partial list would leave the omitted rows on positions that now
     * collide, and a collision falls back to the arbitrary id order the
     * position column was added to replace.
     */
    it("refuses a list that does not name every row", async () => {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const jobs = (await caller.resume.readById({ resumeId })).experience

      await expect(
        caller.resume.reorderRows({
          resumeId,
          section: "experience",
          rowIds: [jobs[1]!.id]
        })
      ).rejects.toThrow(/every row/i)

      await expect(
        caller.resume.reorderRows({
          resumeId,
          section: "experience",
          rowIds: [jobs[0]!.id, jobs[0]!.id]
        })
      ).rejects.toThrow(/every row/i)

      const found = await caller.resume.readById({ resumeId })

      expect(found.experience.map((job) => job.position)).toEqual([0, 1])
    })
  })

  describe("sections", () => {
    /** A resume with its three core sections, ready to add to. */
    async function withResume() {
      const caller = callerFor(fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      return { caller, resumeId }
    }

    it("adds a custom section at the end, empty", async () => {
      const { caller, resumeId } = await withResume()

      const { sectionId } = await caller.section.add({
        resumeId,
        label: "Certificates",
        componentType: "list"
      })

      const found = await caller.resume.readById({ resumeId })
      const added = found.sections.at(-1)

      expect(added?.id).toBe(sectionId)
      expect(added?.label).toBe("Certificates")
      expect(added?.kind).toBe("custom")
      expect(added?.componentType).toBe("list")
      expect(added?.content).toEqual({ items: [] })
    })

    it("renames a section through the path grammar", async () => {
      const { caller, resumeId } = await withResume()
      const experience = (await caller.resume.readById({ resumeId })).sections[1]

      await caller.resume.updateField({
        resumeId,
        path: `section.${experience!.id}.label`,
        value: "Work History"
      })

      const found = await caller.resume.readById({ resumeId })

      expect(found.sections[1]?.label).toBe("Work History")
      // Renaming changes the heading, never what the section is.
      expect(found.sections[1]?.kind).toBe("experience")
    })

    it("moves Education above Experience", async () => {
      const { caller, resumeId } = await withResume()
      const [skills, experience, education] = (
        await caller.resume.readById({ resumeId })
      ).sections

      await caller.section.reorder({
        resumeId,
        sectionIds: [education!.id, experience!.id, skills!.id]
      })

      const found = await caller.resume.readById({ resumeId })

      expect(found.sections.map((row) => row.kind)).toEqual([
        "education",
        "experience",
        "skills"
      ])
      expect(found.sections.map((row) => row.position)).toEqual([0, 1, 2])
    })

    it("refuses a reorder that does not list every section", async () => {
      const { caller, resumeId } = await withResume()
      const sections = (await caller.resume.readById({ resumeId })).sections

      await expect(
        caller.section.reorder({
          resumeId,
          sectionIds: [sections[0]!.id, sections[1]!.id]
        })
      ).rejects.toThrow(/every section/i)

      const found = await caller.resume.readById({ resumeId })

      expect(found.sections.map((row) => row.kind)).toEqual([
        "skills",
        "experience",
        "education"
      ])
    })

    it("removes a section", async () => {
      const { caller, resumeId } = await withResume()
      const skills = (await caller.resume.readById({ resumeId })).sections[0]

      await caller.section.remove({ resumeId, sectionId: skills!.id })

      const found = await caller.resume.readById({ resumeId })

      expect(found.sections.map((row) => row.kind)).toEqual([
        "experience",
        "education"
      ])
    })

    it("writes into a custom section's content", async () => {
      const { caller, resumeId } = await withResume()
      const { sectionId } = await caller.section.add({
        resumeId,
        label: "Summary",
        componentType: "richText"
      })

      await caller.resume.updateField({
        resumeId,
        path: `section.${sectionId}.content.markdown`,
        value: "**Senior** engineer"
      })

      const found = await caller.resume.readById({ resumeId })

      expect(found.sections.at(-1)?.content).toEqual({
        markdown: "**Senior** engineer"
      })
    })

    it("fills a list section, then edits one item of it", async () => {
      const { caller, resumeId } = await withResume()
      const { sectionId } = await caller.section.add({
        resumeId,
        label: "Certificates",
        componentType: "list"
      })

      // A section is added empty, so adding an element is a content write —
      // there would otherwise be nothing for `updateField` to address.
      await caller.section.setContent({
        resumeId,
        sectionId,
        content: { items: ["AWS Certified", "CKA"] }
      })

      await caller.resume.updateField({
        resumeId,
        path: `section.${sectionId}.content.items.1`,
        value: "Certified Kubernetes Administrator"
      })

      const found = await caller.resume.readById({ resumeId })

      expect(found.sections.at(-1)?.content).toEqual({
        items: ["AWS Certified", "Certified Kubernetes Administrator"]
      })
    })

    it("refuses a content payload its component cannot render", async () => {
      const { caller, resumeId } = await withResume()
      const { sectionId } = await caller.section.add({
        resumeId,
        label: "Strengths",
        componentType: "tagList"
      })

      await expect(
        caller.section.setContent({
          resumeId,
          sectionId,
          content: { markdown: "# not a tag list" }
        })
      ).rejects.toThrow(/does not match a tagList section/i)

      const found = await caller.resume.readById({ resumeId })

      expect(found.sections.at(-1)?.content).toEqual({ tags: [] })
    })

    it("refuses a content payload on a core section", async () => {
      const { caller, resumeId } = await withResume()
      const experience = (await caller.resume.readById({ resumeId })).sections[1]

      await expect(
        caller.section.setContent({
          resumeId,
          sectionId: experience!.id,
          content: { markdown: "restructured" }
        })
      ).rejects.toThrow(/core section/i)
    })

    it("refuses content addressed in another component's shape", async () => {
      const { caller, resumeId } = await withResume()
      const { sectionId } = await caller.section.add({
        resumeId,
        label: "Strengths",
        componentType: "tagList"
      })

      await expect(
        caller.resume.updateField({
          resumeId,
          path: `section.${sectionId}.content.markdown`,
          value: "not a tag list"
        })
      ).rejects.toThrow(/renders as tagList/i)
    })

    it("refuses content on a core section", async () => {
      const { caller, resumeId } = await withResume()
      const experience = (await caller.resume.readById({ resumeId })).sections[1]

      await expect(
        caller.resume.updateField({
          resumeId,
          path: `section.${experience!.id}.content.markdown`,
          value: "restructured"
        })
      ).rejects.toThrow(/core section/i)
    })

    it("refuses a write past the end of a list", async () => {
      const { caller, resumeId } = await withResume()
      const { sectionId } = await caller.section.add({
        resumeId,
        label: "Certificates",
        componentType: "list"
      })

      await expect(
        caller.resume.updateField({
          resumeId,
          path: `section.${sectionId}.content.items.0`,
          value: "no such item"
        })
      ).rejects.toThrow(/not found/i)
    })

    it.each(["kind", "componentType", "position"])(
      "refuses a write to a section's %s",
      async (column) => {
        const { caller, resumeId } = await withResume()
        const experience = (await caller.resume.readById({ resumeId }))
          .sections[1]

        await expect(
          caller.resume.updateField({
            resumeId,
            path: `section.${experience!.id}.${column}`,
            value: "custom"
          })
        ).rejects.toThrow(/not an editable field/i)

        const [row] = await db
          .select()
          .from(section)
          .where(eq(section.id, experience!.id))

        expect(row?.kind).toBe("experience")
        expect(row?.componentType).toBe("twoColumn")
      }
    )

    it("refuses a section belonging to another user's resume", async () => {
      const { caller, resumeId } = await withResume()
      const mine = (await caller.resume.readById({ resumeId })).sections[0]
      const stranger = callerFor(fixture.stranger.userId)

      await expect(
        stranger.section.remove({ resumeId, sectionId: mine!.id })
      ).rejects.toThrow(/resume not found/i)

      await expect(
        stranger.resume.updateField({
          resumeId,
          path: `section.${mine!.id}.label`,
          value: "leaked"
        })
      ).rejects.toThrow(/resume not found/i)
    })

    it("refuses a section from another resume of the same user", async () => {
      const { caller, resumeId } = await withResume()
      const { resumeId: otherId } = await caller.resume.create(draft())
      const theirs = (await caller.resume.readById({ resumeId: otherId }))
        .sections[0]

      await expect(
        caller.resume.updateField({
          resumeId,
          path: `section.${theirs!.id}.label`,
          value: "leaked"
        })
      ).rejects.toThrow(/section not found/i)
    })
  })
})
