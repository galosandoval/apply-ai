import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import { and, asc, eq } from "drizzle-orm"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest"
import { callerFor } from "~/server/api/test-caller"
import { contact, resume, section, skill, user, work } from "~/server/db/schema"
import {
  connectTestDatabase,
  disconnectTestDatabase,
  resetTestDatabase,
  testDatabaseUrl,
  type TestDatabase
} from "~/server/db/test-database"
import { type GeneratedResume } from "~/server/modules/profile/generate-resume"

/**
 * Generation, driven through `appRouter.createCaller(ctx)` against a real
 * database with the model stubbed at the structured-generation boundary.
 *
 * The model is never exercised: `generateResume` is the seam, and stubbing it
 * is what makes everything below it — the allowlist, the snapshot, the typed
 * failure — deterministic. What the *prompt* produces is not testable here and
 * is not pretended to be; see `docs/anti-fabrication-review.md`.
 *
 * Requires `TEST_DATABASE_URL`. See `.env.example`.
 */

vi.mock("~/server/modules/profile/generate-resume", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/server/modules/profile/generate-resume")
  >()),
  generateResume: vi.fn()
}))

const { generateResume } =
  await import("~/server/modules/profile/generate-resume")

const stub = vi.mocked(generateResume)

/**
 * Stubs the model with a response that deliberately isn't the agreed shape.
 *
 * The cast is the point of these tests: the router's job is to reject what the
 * type says can't happen, so the one unsound step lives here rather than being
 * repeated at every call site.
 */
function stubMalformed(response: unknown) {
  stub.mockResolvedValue(response as GeneratedResume)
}

const hasTestDatabase = !!testDatabaseUrl

if (!hasTestDatabase) {
  // Skipped silently, a green run would read as "generation is covered".
  console.warn(
    "\n  ⚠ TEST_DATABASE_URL is not set — skipping the generation tests.\n"
  )
}

let db: TestDatabase

/** A drafted resume, as a well-behaved model returns one. */
function drafted(overrides: Partial<GeneratedResume> = {}): GeneratedResume {
  return {
    profession: "Senior TypeScript Engineer",
    experience: [
      {
        name: "Acme",
        title: "Engineer",
        startDate: "2020",
        endDate: "2022",
        bullets: ["Shipped the thing", "Then shipped the other thing"]
      }
    ],
    education: [
      {
        name: "State University",
        degree: "BSc",
        description: "",
        startDate: "2016",
        endDate: "2020",
        gpa: ""
      }
    ],
    sections: [],
    ...overrides
  }
}

/**
 * Two users with a filled-in account each, so "the caller's rows" is a claim
 * that can fail rather than the only rows in the database.
 */
async function seed() {
  const owner = createId()
  const stranger = createId()

  await db.insert(user).values([
    {
      id: owner,
      email: `${owner}@test.dev`,
      name: "Owner",
      firstName: "Ada",
      lastName: "Lovelace",
      profession: "Engineer"
    },
    {
      id: stranger,
      email: `${stranger}@test.dev`,
      name: "Stranger",
      firstName: "Grace",
      lastName: "Hopper",
      profession: "Engineer"
    }
  ])

  await db.insert(skill).values([
    {
      id: createId(),
      userId: owner,
      category: "Languages",
      all: ["TypeScript", "Go"],
      position: 0
    },
    {
      id: createId(),
      userId: stranger,
      category: "Stranger's",
      all: ["COBOL"],
      position: 0
    }
  ])

  await db.insert(contact).values([
    {
      id: createId(),
      userId: owner,
      location: "London, UK",
      phone: "555-0100",
      linkedIn: "linkedin.com/in/ada",
      portfolio: "ada.dev"
    },
    { id: createId(), userId: stranger, location: "Arlington, VA" }
  ])

  // The account's master history: what a generation is drafted from.
  await db.insert(work).values({
    id: createId(),
    userId: owner,
    name: "Acme",
    title: "Engineer",
    startDate: "2020",
    endDate: "2022",
    bullets: ["Shipped the thing"],
    position: 0
  })

  return { owner, stranger }
}

const posting = "Senior TypeScript engineer, remote, Postgres"

describe.skipIf(!hasTestDatabase)("resume.generate", () => {
  let fixture: Awaited<ReturnType<typeof seed>>

  beforeAll(async () => {
    db = await connectTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestDatabase()
  })

  beforeEach(async () => {
    await resetTestDatabase(db)
    stub.mockReset()
    fixture = await seed()
  })

  const sectionsOf = (resumeId: string) =>
    db
      .select()
      .from(section)
      .where(eq(section.resumeId, resumeId))
      .orderBy(asc(section.position))

  it("creates the resume and keeps the posting on it", async () => {
    stub.mockResolvedValue(drafted())

    const { resumeId } = await callerFor(db, fixture.owner).resume.generate({
      jobDescription: posting
    })

    const [row] = await db.select().from(resume).where(eq(resume.id, resumeId))

    expect(row?.profession).toBe("Senior TypeScript Engineer")
    expect(row?.jobDescription).toBe(posting)
    expect(row?.userId).toBe(fixture.owner)
  })

  it("writes the drafted experience and education onto the resume", async () => {
    stub.mockResolvedValue(drafted())

    const { resumeId } = await callerFor(db, fixture.owner).resume.generate({
      jobDescription: posting
    })

    const jobs = await db.select().from(work).where(eq(work.resumeId, resumeId))

    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.bullets).toEqual([
      "Shipped the thing",
      "Then shipped the other thing"
    ])
  })

  it("snapshots skills and contact from the account", async () => {
    stub.mockResolvedValue(drafted())

    const { resumeId } = await callerFor(db, fixture.owner).resume.generate({
      jobDescription: posting
    })

    // Skills is a content-bearing section now, so the account's copy is
    // snapshotted into the section rather than into rows of its own.
    const [skillsSection] = await db
      .select()
      .from(section)
      .where(and(eq(section.resumeId, resumeId), eq(section.kind, "skills")))

    const [snapshotContact] = await db
      .select()
      .from(contact)
      .where(eq(contact.resumeId, resumeId))

    expect(skillsSection?.content).toEqual({
      groups: [{ label: "Languages", items: ["TypeScript", "Go"] }]
    })
    expect(snapshotContact?.fullName).toBe("Ada Lovelace")
    expect(snapshotContact?.location).toBe("London, UK")
  })

  it("drafts from the caller's history, never another user's", async () => {
    stub.mockResolvedValue(drafted())

    await callerFor(db, fixture.stranger).resume.generate({
      jobDescription: posting
    })

    const [{ experience } = { experience: "" }] = stub.mock.calls.map(
      ([input]) => input
    )

    // The stranger's account has no work rows; the owner's does.
    expect(experience).toBe("[]")

    const strangersResumes = await db
      .select()
      .from(resume)
      .where(eq(resume.userId, fixture.stranger))

    const [skillsSection] = await db
      .select()
      .from(section)
      .where(
        and(
          eq(section.resumeId, strangersResumes[0]!.id),
          eq(section.kind, "skills")
        )
      )

    expect(skillsSection?.content).toEqual({
      groups: [{ label: "Stranger's", items: ["COBOL"] }]
    })
  })

  describe("the section allowlist", () => {
    it("places a Summary above the core sections and Strengths below", async () => {
      stub.mockResolvedValue(
        drafted({
          sections: [
            { kind: "strengths", entries: ["Mentoring", "Incident response"] },
            { kind: "summary", entries: ["First paragraph", "Second"] }
          ]
        })
      )

      const { resumeId } = await callerFor(db, fixture.owner).resume.generate({
        jobDescription: posting
      })

      const rows = await sectionsOf(resumeId)

      expect(rows.map((row) => row.label)).toEqual([
        "Summary",
        "Skills",
        "Experience",
        "Education",
        "Strengths"
      ])

      expect(rows[0]?.componentType).toBe("richText")
      expect(rows[0]?.content).toEqual({
        markdown: "First paragraph\n\nSecond"
      })
      expect(rows[4]?.componentType).toBe("tagList")
      expect(rows[4]?.content).toEqual({
        tags: ["Mentoring", "Incident response"]
      })
    })

    it("drops a section with no entries and creates the rest", async () => {
      stub.mockResolvedValue(
        drafted({
          sections: [
            { kind: "strengths", entries: ["   "] },
            { kind: "summary", entries: ["Written for the posting"] }
          ]
        })
      )

      const { resumeId } = await callerFor(db, fixture.owner).resume.generate({
        jobDescription: posting
      })

      const rows = await sectionsOf(resumeId)

      expect(rows.map((row) => row.label)).toEqual([
        "Summary",
        "Skills",
        "Experience",
        "Education"
      ])
    })

    it("rejects a kind outside the allowlist without writing anything", async () => {
      // The kinds are an enum in the schema now, so a section this app cannot
      // draw is refused where the response is validated rather than quietly
      // dropped further in.
      stubMalformed({
        ...drafted(),
        sections: [{ kind: "references", entries: ["On request"] }]
      })

      await expect(
        callerFor(db, fixture.owner).resume.generate({
          jobDescription: posting
        })
      ).rejects.toBeInstanceOf(TRPCError)

      expect(await db.select().from(resume)).toEqual([])
    })

    it("creates only the core sections when nothing extra came back", async () => {
      stub.mockResolvedValue(drafted())

      const { resumeId } = await callerFor(db, fixture.owner).resume.generate({
        jobDescription: posting
      })

      const rows = await sectionsOf(resumeId)

      expect(rows.map((row) => row.kind)).toEqual([
        "skills",
        "experience",
        "education"
      ])
    })
  })

  describe("the account's language", () => {
    /** Everything below generates for an account that reads Spanish. */
    const generateInSpanish = async () => {
      await db
        .update(user)
        .set({ locale: "es" })
        .where(eq(user.id, fixture.owner))

      stub.mockResolvedValue(
        drafted({
          sections: [{ kind: "summary", entries: ["Escrito para la vacante"] }]
        })
      )

      return callerFor(db, fixture.owner).resume.generate({
        jobDescription: posting
      })
    }

    it("tells the model which language to write in", async () => {
      await generateInSpanish()

      expect(stub).toHaveBeenCalledWith(
        expect.objectContaining({ language: "es" })
      )
    })

    it("freezes the language onto the resume", async () => {
      const { resumeId } = await generateInSpanish()

      const [row] = await db
        .select()
        .from(resume)
        .where(eq(resume.id, resumeId))

      expect(row?.language).toBe("es")
    })

    it("writes the headings in that language", async () => {
      const { resumeId } = await generateInSpanish()

      expect((await sectionsOf(resumeId)).map((row) => row.label)).toEqual([
        "Resumen profesional",
        "Habilidades",
        "Experiencia",
        "Formación académica"
      ])
    })

    it("leaves an English account's resume in English", async () => {
      stub.mockResolvedValue(drafted())

      const { resumeId } = await callerFor(db, fixture.owner).resume.generate({
        jobDescription: posting
      })

      expect((await sectionsOf(resumeId)).map((row) => row.label)).toEqual([
        "Skills",
        "Experience",
        "Education"
      ])
    })
  })

  describe("a response that isn't the agreed shape", () => {
    const malformed: Record<string, unknown> = {
      "a missing profession": { experience: [], education: [], sections: [] },
      "bullets that aren't strings": drafted({
        experience: [
          {
            name: "Acme",
            title: "Engineer",
            startDate: "2020",
            endDate: "2022",
            bullets: [1, 2] as unknown as string[]
          }
        ]
      }),
      "nothing at all": null
    }

    it.each(Object.keys(malformed))("rejects %s", async (name) => {
      stubMalformed(malformed[name])

      await expect(
        callerFor(db, fixture.owner).resume.generate({
          jobDescription: posting
        })
      ).rejects.toBeInstanceOf(TRPCError)
    })

    it("creates nothing at all", async () => {
      stubMalformed(null)

      await expect(
        callerFor(db, fixture.owner).resume.generate({
          jobDescription: posting
        })
      ).rejects.toBeInstanceOf(TRPCError)

      expect(await db.select().from(resume)).toEqual([])
      expect(await db.select().from(section)).toEqual([])
    })
  })
})
