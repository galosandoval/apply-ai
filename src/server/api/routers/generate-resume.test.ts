import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import { asc, eq } from "drizzle-orm"
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

    const [snapshotSkill] = await db
      .select()
      .from(skill)
      .where(eq(skill.resumeId, resumeId))

    const [snapshotContact] = await db
      .select()
      .from(contact)
      .where(eq(contact.resumeId, resumeId))

    expect(snapshotSkill?.category).toBe("Languages")
    expect(snapshotSkill?.all).toEqual(["TypeScript", "Go"])
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

    const [snapshotSkill] = await db
      .select()
      .from(skill)
      .where(eq(skill.resumeId, strangersResumes[0]!.id))

    expect(snapshotSkill?.category).toBe("Stranger's")
  })

  describe("the section allowlist", () => {
    it("places a Summary above the core sections and Strengths below", async () => {
      stub.mockResolvedValue(
        drafted({
          sections: [
            { label: "Strengths", entries: ["Mentoring", "Incident response"] },
            { label: "Summary", entries: ["First paragraph", "Second"] }
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
      expect(rows[4]?.content).toEqual({
        items: ["Mentoring", "Incident response"]
      })
    })

    it("drops a section outside the allowlist and creates the rest", async () => {
      stub.mockResolvedValue(
        drafted({
          sections: [
            { label: "References", entries: ["Available on request"] },
            // A label that is a key of `Object.prototype`: an allowlist kept in
            // an object literal finds one of those and walks past the guard.
            { label: "constructor", entries: ["Not a section"] },
            { label: "Summary", entries: ["Written for the posting"] }
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
      stub.mockResolvedValue(malformed[name])

      await expect(
        callerFor(db, fixture.owner).resume.generate({
          jobDescription: posting
        })
      ).rejects.toBeInstanceOf(TRPCError)
    })

    it("creates nothing at all", async () => {
      stub.mockResolvedValue(null)

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
