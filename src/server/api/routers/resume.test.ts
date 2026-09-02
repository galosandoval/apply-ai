import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import { asc, eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { toDownloadPayload } from "~/features/resume/resume-field-lens"
import { callerFor } from "~/server/api/test-caller"
import { downloadPdfSchema } from "~/server/db/crud-schema"
import { type CreateResumeInput } from "~/server/modules/resume/resume.schema"
import {
  connectTestDatabase,
  disconnectTestDatabase,
  resetTestDatabase,
  testDatabaseUrl,
  type TestDatabase
} from "~/server/db/test-database"
import {
  contact,
  resume,
  school,
  section,
  skill,
  user,
  work
} from "~/server/db/schema"

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

  // The account's master copy, and now the only copy: what a new resume is
  // seeded from, and the thing that must not reach back into a resume already
  // saved. A resume's own skills are its Skills section's content.
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

/**
 * The Skills section's groups — where a resume's skills live now.
 *
 * Skills stopped being a core section with typed rows of its own, so a resume's
 * copy is section content like any other. Read through one helper so the
 * assertions say what they are checking rather than how it is stored.
 */
function skillGroupsOf(found: {
  sections: { kind: string; content: unknown }[]
}) {
  const content = found.sections.find((row) => row.kind === "skills")?.content

  return (content as { groups?: { label: string; items: string[] }[] } | null)
    ?.groups
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
      await callerFor(db, fixture.owner.userId).resume.updateField({
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
      await callerFor(db, fixture.owner.userId).resume.updateField({
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
      await callerFor(db, fixture.owner.userId).resume.updateField({
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
      await callerFor(db, fixture.owner.userId).resume.updateField({
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
        callerFor(db, fixture.owner.userId).resume.updateField({
          resumeId: fixture.resumeId,
          path: rejected[name]!(fixture),
          value: "should not land"
        })
      ).rejects.toBeInstanceOf(TRPCError)
    })

    it("leaves the row untouched when the path is rejected", async () => {
      await expect(
        callerFor(db, fixture.owner.userId).resume.updateField({
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
        callerFor(db, fixture.owner.userId).resume.updateField({
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
        callerFor(db, fixture.stranger.userId).resume.updateField({
          resumeId: fixture.resumeId,
          path: "profession",
          value: "leaked"
        })
      ).rejects.toThrow(/resume not found/i)
    })

    it("rejects an unauthenticated caller", async () => {
      await expect(
        callerFor(db, null).resume.updateField({
          resumeId: fixture.resumeId,
          path: "profession",
          value: "leaked"
        })
      ).rejects.toThrow(/unauthorized/i)
    })
  })

  describe("readById", () => {
    it("returns the resume with its snapshotted rows, ordered by id", async () => {
      const found = await callerFor(db, fixture.owner.userId).resume.readById({
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
        callerFor(db, fixture.stranger.userId).resume.readById({
          resumeId: fixture.resumeId
        })
      ).rejects.toThrow(/resume not found/i)
    })
  })

  describe("create — the resume owns what it renders", () => {
    it("keeps the job description it was drafted against", async () => {
      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      const found = await caller.resume.readById({ resumeId })

      expect(found.jobDescription).toBe("Senior TypeScript engineer, remote")
    })

    it("takes the language from the account and writes the headings in it", async () => {
      await db
        .update(user)
        .set({ locale: "es" })
        .where(eq(user.id, fixture.owner.userId))

      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      const found = await caller.resume.readById({ resumeId })

      expect(found.language).toBe("es")
      expect(found.sections.map((row) => row.label)).toEqual([
        "Habilidades",
        "Experiencia",
        "Formación académica"
      ])
    })

    it("carries the language through to what the print route is posted", async () => {
      await db
        .update(user)
        .set({ locale: "es" })
        .where(eq(user.id, fixture.owner.userId))

      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      const found = await caller.resume.readById({ resumeId })

      // The column on its own is not the feature: the file only downloads as
      // `curriculum.pdf` if the language reaches the request, and the payload
      // is the one place between the two that can drop it.
      expect(toDownloadPayload(found).language).toBe("es")
      expect(downloadPdfSchema.parse(toDownloadPayload(found)).language).toBe(
        "es"
      )
    })

    it("snapshots skills and contact onto the resume", async () => {
      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      const found = await caller.resume.readById({ resumeId })

      // The skills come off the account rather than off the draft: they are
      // not the caller's to supply any more than the history is.
      expect(skillGroupsOf(found)).toEqual([
        { label: "Languages", items: ["TypeScript", "Go"] }
      ])
      expect(found.contact.email).toBe("ada@example.com")
      expect(found.contact.fullName).toBe("Ada Lovelace")
    })

    /**
     * The assertion this whole spec exists for: tailoring one application can
     * no longer rewrite one already sent.
     */
    it("is unchanged when the account is edited afterwards", async () => {
      const caller = callerFor(db, fixture.owner.userId)
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

      expect(skillGroupsOf(found)).toEqual([
        { label: "Languages", items: ["TypeScript", "Go"] }
      ])
      expect(found.contact.location).toBe("London, UK")
      expect(found.contact.fullName).toBe("Ada Lovelace")
    })

    it("does not hand a resume's snapshot back as the account's own", async () => {
      const caller = callerFor(db, fixture.owner.userId)

      await caller.resume.create(draft())

      const profile = await caller.profile.read()

      expect(profile.skills).toHaveLength(1)
      expect(profile.skills[0]?.category).toBe("Languages")
      expect(profile.contact?.location).toBe("London, UK")
    })

    it("orders jobs and schools by the order they were drafted in", async () => {
      const caller = callerFor(db, fixture.owner.userId)
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
      const caller = callerFor(db, fixture.owner.userId)
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
      // Skills carries its own content now; the two with typed rows do not.
      expect(
        found.sections
          .filter((row) => row.kind !== "skills")
          .every((row) => row.content === null)
      ).toBe(true)
      expect(skillGroupsOf(found)).toEqual([
        { label: "Languages", items: ["TypeScript", "Go"] }
      ])
    })
  })

  describe("updateField — the resume's own contact and skills", () => {
    it("writes a contact field on this resume only", async () => {
      const caller = callerFor(db, fixture.owner.userId)
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

    it("files the fallback contact row under the resume's owner", async () => {
      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      // A resume created before contact was snapshotted: the edit has to land
      // somewhere, and that somewhere must still belong to the owner.
      await db.delete(contact).where(eq(contact.resumeId, resumeId))

      await caller.resume.updateField({
        resumeId,
        path: "contact.email",
        value: "recovered@example.com"
      })

      const [row] = await db
        .select()
        .from(contact)
        .where(eq(contact.resumeId, resumeId))

      expect(row?.email).toBe("recovered@example.com")
      expect(row?.userId).toBe(fixture.owner.userId)
    })

    it("writes a skill group through its section's content", async () => {
      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const skills = (await caller.resume.readById({ resumeId })).sections.find(
        (row) => row.kind === "skills"
      )

      await caller.resume.updateField({
        resumeId,
        path: `section.${skills!.id}.content.groups.0.items`,
        value: "Rust, Zig"
      })

      const found = await caller.resume.readById({ resumeId })

      // The line the panel edits is stored as the entries it names — a
      // trailing comma names nothing, and neither does a run of spaces.
      expect(skillGroupsOf(found)).toEqual([
        { label: "Languages", items: ["Rust", "Zig"] }
      ])
    })

    it("leaves the account's master skills alone", async () => {
      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const skills = (await caller.resume.readById({ resumeId })).sections.find(
        (row) => row.kind === "skills"
      )

      await caller.resume.updateField({
        resumeId,
        path: `section.${skills!.id}.content.groups.0.label`,
        value: "Tailored"
      })

      const profile = await caller.profile.read()

      expect(profile.skills[0]?.category).toBe("Languages")
    })

    it("rejects a skills section belonging to another resume", async () => {
      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const { resumeId: otherId } = await caller.resume.create(draft())
      const theirs = (
        await caller.resume.readById({ resumeId: otherId })
      ).sections.find((row) => row.kind === "skills")

      await expect(
        caller.resume.updateField({
          resumeId,
          path: `section.${theirs!.id}.content.groups.0.label`,
          value: "leaked"
        })
      ).rejects.toThrow(/not found/i)
    })
  })

  describe("refreshFromAccount", () => {
    it("pulls the account's current details in, on request", async () => {
      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      await caller.profile.upsertSkills({
        skills: [{ category: "Refreshed", all: ["Fortran"], position: 0 }]
      })

      await caller.resume.refreshFromAccount({ resumeId })

      const found = await caller.resume.readById({ resumeId })

      expect(skillGroupsOf(found)).toEqual([
        { label: "Refreshed", items: ["Fortran"] }
      ])
      expect(found.contact.location).toBe("London, UK")
    })

    it("refreshes only the resume it was asked about", async () => {
      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const { resumeId: otherId } = await caller.resume.create(draft())

      await caller.profile.upsertSkills({
        skills: [{ category: "Refreshed", all: ["Fortran"], position: 0 }]
      })

      await caller.resume.refreshFromAccount({ resumeId })

      const untouched = await caller.resume.readById({ resumeId: otherId })

      expect(skillGroupsOf(untouched)).toEqual([
        { label: "Languages", items: ["TypeScript", "Go"] }
      ])
    })

    it("rejects another user's resume", async () => {
      await expect(
        callerFor(db, fixture.stranger.userId).resume.refreshFromAccount({
          resumeId: fixture.resumeId
        })
      ).rejects.toThrow(/resume not found/i)
    })
  })

  describe("reorderRows", () => {
    it("reorders the jobs within Experience", async () => {
      const caller = callerFor(db, fixture.owner.userId)
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
      const caller = callerFor(db, fixture.owner.userId)
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

    /**
     * Skills is not a row list any more, and the schema is where that is
     * enforced: the procedures take a section name, and there is no longer one
     * called `skills` for a caller to name. Its groups are moved the way any
     * section's content is.
     */
    it("refuses skills, which is not a row list", async () => {
      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      await expect(
        caller.resume.reorderRows({
          resumeId,
          // @ts-expect-error — the point of the assertion
          section: "skills",
          rowIds: [createId()]
        })
      ).rejects.toThrow()
    })

    it("refuses a row from another resume, and moves nothing", async () => {
      const caller = callerFor(db, fixture.owner.userId)
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
      const caller = callerFor(db, fixture.owner.userId)
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
      const caller = callerFor(db, fixture.owner.userId)
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

    it("writes the heading the preset is called, not the one it was sent", async () => {
      const { caller, resumeId } = await withResume()

      // What the picker displayed is in the *interface's* language; the
      // resume's own language decides what goes onto the document.
      const { sectionId } = await caller.section.add({
        resumeId,
        label: "Proyectos",
        presetId: "projects",
        componentType: "twoColumn"
      })

      const found = await caller.resume.readById({ resumeId })

      expect(found.sections.find((row) => row.id === sectionId)?.label).toBe(
        "Projects"
      )
    })

    it("keeps the label it was sent for a preset the messages don't know", async () => {
      const { caller, resumeId } = await withResume()

      const { sectionId } = await caller.section.add({
        resumeId,
        label: "Certificates",
        presetId: "not-a-preset",
        componentType: "list"
      })

      const found = await caller.resume.readById({ resumeId })

      expect(found.sections.find((row) => row.id === sectionId)?.label).toBe(
        "Certificates"
      )
    })

    it("renames a section through the path grammar", async () => {
      const { caller, resumeId } = await withResume()
      const experience = (await caller.resume.readById({ resumeId }))
        .sections[1]

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
      const experience = (await caller.resume.readById({ resumeId }))
        .sections[1]

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
      const experience = (await caller.resume.readById({ resumeId }))
        .sections[1]

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
      const stranger = callerFor(db, fixture.stranger.userId)

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

  /**
   * Adding, removing and reordering — the operations inline editing could not
   * express, because there is nowhere to click for a thing that is not there.
   */
  describe("setBullets", () => {
    /** A resume with its drafted rows, ready to add to. */
    async function withResume() {
      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      return { caller, resumeId }
    }

    it("adds a bullet to a job", async () => {
      const { caller, resumeId } = await withResume()
      const [job] = (await caller.resume.readById({ resumeId })).experience

      await caller.resume.setBullets({
        resumeId,
        rowId: job!.id,
        bullets: [...job!.bullets, "Added by hand"]
      })

      const found = await caller.resume.readById({ resumeId })

      expect(found.experience[0]?.bullets).toEqual([
        "Wrote the first algorithm",
        "Described a general computer",
        "Added by hand"
      ])
    })

    it("removes a bullet", async () => {
      const { caller, resumeId } = await withResume()
      const [job] = (await caller.resume.readById({ resumeId })).experience

      await caller.resume.setBullets({
        resumeId,
        rowId: job!.id,
        bullets: [job!.bullets[1]!]
      })

      expect(
        (await caller.resume.readById({ resumeId })).experience[0]?.bullets
      ).toEqual(["Described a general computer"])
    })

    it("reorders bullets within a job", async () => {
      const { caller, resumeId } = await withResume()
      const [job] = (await caller.resume.readById({ resumeId })).experience

      await caller.resume.setBullets({
        resumeId,
        rowId: job!.id,
        bullets: [job!.bullets[1]!, job!.bullets[0]!]
      })

      expect(
        (await caller.resume.readById({ resumeId })).experience[0]?.bullets
      ).toEqual(["Described a general computer", "Wrote the first algorithm"])
    })

    it("leaves the other jobs alone", async () => {
      const { caller, resumeId } = await withResume()
      const jobs = (await caller.resume.readById({ resumeId })).experience

      await caller.resume.setBullets({
        resumeId,
        rowId: jobs[0]!.id,
        bullets: []
      })

      expect(
        (await caller.resume.readById({ resumeId })).experience[1]?.bullets
      ).toEqual(["Built the thing", "Then built the other thing"])
    })

    it("refuses a job belonging to another resume", async () => {
      const { caller, resumeId } = await withResume()
      const { resumeId: otherId } = await caller.resume.create(draft())
      const theirs = (await caller.resume.readById({ resumeId: otherId }))
        .experience

      await expect(
        caller.resume.setBullets({
          resumeId,
          rowId: theirs[0]!.id,
          bullets: ["leaked"]
        })
      ).rejects.toThrow(/not found/i)

      expect(
        (await caller.resume.readById({ resumeId: otherId })).experience[0]
          ?.bullets
      ).toEqual(["Wrote the first algorithm", "Described a general computer"])
    })

    it("refuses another user's resume", async () => {
      const { caller, resumeId } = await withResume()
      const [job] = (await caller.resume.readById({ resumeId })).experience
      const stranger = callerFor(db, fixture.stranger.userId)

      await expect(
        stranger.resume.setBullets({
          resumeId,
          rowId: job!.id,
          bullets: ["leaked"]
        })
      ).rejects.toThrow(/resume not found/i)
    })
  })

  describe("addRow and removeRow", () => {
    async function withResume() {
      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      return { caller, resumeId }
    }

    it("appends an empty job at the end", async () => {
      const { caller, resumeId } = await withResume()

      const { rowId } = await caller.resume.addRow({
        resumeId,
        section: "experience"
      })

      const found = await caller.resume.readById({ resumeId })

      expect(found.experience.map((job) => job.id)).toEqual([
        found.experience[0]!.id,
        found.experience[1]!.id,
        rowId
      ])

      const added = found.experience[2]!

      expect(added.name).toBe("")
      expect(added.title).toBe("")
      expect(added.bullets).toEqual([])
      expect(added.position).toBe(2)
    })

    it("appends an empty school", async () => {
      const { caller, resumeId } = await withResume()

      const school = await caller.resume.addRow({
        resumeId,
        section: "education"
      })

      const found = await caller.resume.readById({ resumeId })

      expect(found.education.at(-1)?.id).toBe(school.rowId)
      expect(found.education.at(-1)?.degree).toBe("")
    })

    it("adds the row to this resume only", async () => {
      const { caller, resumeId } = await withResume()
      const { resumeId: otherId } = await caller.resume.create(draft())

      await caller.resume.addRow({ resumeId, section: "experience" })

      expect(
        (await caller.resume.readById({ resumeId: otherId })).experience
      ).toHaveLength(2)

      // The account's master copy is not a resume's, and gains nothing.
      expect((await caller.profile.read()).experience).toHaveLength(0)
    })

    it("removes a job and a school", async () => {
      const { caller, resumeId } = await withResume()
      const before = await caller.resume.readById({ resumeId })

      await caller.resume.removeRow({
        resumeId,
        section: "experience",
        rowId: before.experience[0]!.id
      })
      await caller.resume.removeRow({
        resumeId,
        section: "education",
        rowId: before.education[0]!.id
      })
      const found = await caller.resume.readById({ resumeId })

      expect(found.experience.map((job) => job.name)).toEqual([
        "Difference Engines"
      ])
      expect(found.education.map((entry) => entry.name)).toEqual([
        "Somerville College"
      ])
    })

    it("refuses a row belonging to another resume, and removes nothing", async () => {
      const { caller, resumeId } = await withResume()
      const { resumeId: otherId } = await caller.resume.create(draft())
      const theirs = (await caller.resume.readById({ resumeId: otherId }))
        .experience

      await expect(
        caller.resume.removeRow({
          resumeId,
          section: "experience",
          rowId: theirs[0]!.id
        })
      ).rejects.toThrow(/not found/i)

      expect(
        (await caller.resume.readById({ resumeId: otherId })).experience
      ).toHaveLength(2)
    })

    it("refuses another user's resume", async () => {
      const { caller, resumeId } = await withResume()
      const stranger = callerFor(db, fixture.stranger.userId)

      await expect(
        stranger.resume.addRow({ resumeId, section: "experience" })
      ).rejects.toThrow(/resume not found/i)

      await expect(
        stranger.resume.removeRow({
          resumeId,
          section: "experience",
          rowId: (await caller.resume.readById({ resumeId })).experience[0]!.id
        })
      ).rejects.toThrow(/resume not found/i)
    })

    /**
     * A removed row's position is not backfilled, so the next row added must
     * not land on a position another row already holds.
     */
    it("does not reuse the position of a removed row", async () => {
      const { caller, resumeId } = await withResume()
      const before = await caller.resume.readById({ resumeId })

      await caller.resume.removeRow({
        resumeId,
        section: "experience",
        rowId: before.experience[1]!.id
      })

      const { rowId } = await caller.resume.addRow({
        resumeId,
        section: "experience"
      })

      const found = await caller.resume.readById({ resumeId })

      expect(found.experience.map((job) => job.id)).toEqual([
        before.experience[0]!.id,
        rowId
      ])
      expect(new Set(found.experience.map((job) => job.position)).size).toBe(2)
    })
  })

  /**
   * Generation now creates a resume rather than previewing one, so a resume the
   * user dislikes has to be removable — and removing it must not strand the
   * rows it owns.
   */
  describe("remove", () => {
    it("deletes the resume and everything it owns", async () => {
      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      await caller.resume.remove({ resumeId })

      expect(await caller.resume.list()).toHaveLength(2)

      for (const table of [work, school, contact]) {
        expect(
          await db.select().from(table).where(eq(table.resumeId, resumeId))
        ).toHaveLength(0)
      }

      expect(
        await db.select().from(section).where(eq(section.resumeId, resumeId))
      ).toHaveLength(0)
    })

    it("leaves the account's master copies alone", async () => {
      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())

      await caller.resume.remove({ resumeId })

      const profile = await caller.profile.read()

      expect(profile.skills).toHaveLength(1)
      expect(profile.contact?.location).toBe("London, UK")
    })

    it("refuses another user's resume", async () => {
      const caller = callerFor(db, fixture.owner.userId)
      const { resumeId } = await caller.resume.create(draft())
      const stranger = callerFor(db, fixture.stranger.userId)

      await expect(stranger.resume.remove({ resumeId })).rejects.toThrow(
        /resume not found/i
      )

      expect(await caller.resume.list()).toHaveLength(3)
    })
  })
})
