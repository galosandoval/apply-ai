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
import { contact, school, skill, user, work } from "~/server/db/schema"
import {
  connectTestDatabase,
  disconnectTestDatabase,
  resetTestDatabase,
  testDatabaseUrl,
  type TestDatabase
} from "~/server/db/test-database"
import { type ParsedResume } from "~/server/modules/profile/parse-resume-pdf"

/**
 * The profile router — the account's master copy — driven through
 * `appRouter.createCaller(ctx)` against a real database.
 *
 * Import is most of it. Both halves of the extraction are stubbed: reading a
 * PDF's text layer, and the model that structures it. What is under test is
 * what lands in the database, which is the part a user reviews and corrects.
 *
 * Requires `TEST_DATABASE_URL`. See `.env.example`.
 */

vi.mock(
  "~/server/modules/profile/parse-resume-pdf",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("~/server/modules/profile/parse-resume-pdf")
    >()),
    extractPdfText: vi.fn(),
    extractResumeFields: vi.fn()
  })
)

const { extractPdfText, extractResumeFields } =
  await import("~/server/modules/profile/parse-resume-pdf")

const readsText = vi.mocked(extractPdfText)
const extracts = vi.mocked(extractResumeFields)

const hasTestDatabase = !!testDatabaseUrl

if (!hasTestDatabase) {
  console.warn(
    "\n  ⚠ TEST_DATABASE_URL is not set — skipping the import tests.\n"
  )
}

let db: TestDatabase

/** Everything an extraction can find, so a partial one is a subset of it. */
function extracted(overrides: Partial<ParsedResume> = {}): ParsedResume {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    profession: "Engineer",
    location: "London, UK",
    phone: "555-0100",
    linkedIn: "linkedin.com/in/ada",
    portfolio: "ada.dev",
    experience: [
      {
        name: "Acme",
        title: "Engineer",
        startDate: "2020",
        endDate: "Present",
        location: "Remote",
        bullets: ["Shipped the thing"]
      }
    ],
    education: [
      {
        name: "State University",
        degree: "BSc",
        startDate: "2016",
        endDate: "2020",
        location: "",
        gpa: "3.9",
        description: ""
      }
    ],
    skills: [{ category: "Languages", all: ["TypeScript", "Go"] }],
    ...overrides
  }
}

async function seed() {
  const owner = createId()
  const stranger = createId()

  await db.insert(user).values([
    { id: owner, email: `${owner}@test.dev`, name: "Owner" },
    { id: stranger, email: `${stranger}@test.dev`, name: "Stranger" }
  ])

  // The stranger's own history, so "only the caller's rows" can fail.
  await db.insert(work).values({
    id: createId(),
    userId: stranger,
    name: "Stranger Co",
    title: "Engineer",
    startDate: "2019",
    endDate: "2021",
    bullets: ["Untouched"],
    position: 0
  })

  return { owner, stranger }
}

/** The base64 the file picker sends. Never read — `extractPdfText` is stubbed. */
const fileBase64 = Buffer.from("a pdf").toString("base64")

describe.skipIf(!hasTestDatabase)("profile.importFromPdf", () => {
  let fixture: Awaited<ReturnType<typeof seed>>

  beforeAll(async () => {
    db = await connectTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestDatabase()
  })

  beforeEach(async () => {
    await resetTestDatabase(db)
    readsText.mockReset()
    extracts.mockReset()
    readsText.mockResolvedValue("the resume's text layer")
    fixture = await seed()
  })

  it("maps the extracted fields onto the account", async () => {
    extracts.mockResolvedValue(extracted())

    const counts = await callerFor(db, fixture.owner).profile.importFromPdf({
      fileBase64
    })

    expect(counts).toEqual({ experience: 1, education: 1, skills: 1 })

    const [account] = await db
      .select()
      .from(user)
      .where(eq(user.id, fixture.owner))

    const [details] = await db
      .select()
      .from(contact)
      .where(eq(contact.userId, fixture.owner))

    const jobs = await db
      .select()
      .from(work)
      .where(eq(work.userId, fixture.owner))

    const schools = await db
      .select()
      .from(school)
      .where(eq(school.userId, fixture.owner))

    const groups = await db
      .select()
      .from(skill)
      .where(eq(skill.userId, fixture.owner))

    expect(account?.firstName).toBe("Ada")
    expect(account?.profession).toBe("Engineer")
    expect(details?.location).toBe("London, UK")
    expect(details?.linkedIn).toBe("linkedin.com/in/ada")
    expect(jobs[0]?.name).toBe("Acme")
    expect(jobs[0]?.bullets).toEqual(["Shipped the thing"])
    expect(schools[0]?.gpa).toBe("3.9")
    expect(groups[0]?.all).toEqual(["TypeScript", "Go"])
  })

  it("keeps the order the extraction returned", async () => {
    extracts.mockResolvedValue(
      extracted({
        experience: [
          {
            name: "Most recent",
            title: "Engineer",
            startDate: "2022",
            endDate: "Present",
            location: "",
            bullets: ["Latest"]
          },
          {
            name: "The one before",
            title: "Engineer",
            startDate: "2019",
            endDate: "2022",
            location: "",
            bullets: ["Earlier"]
          }
        ]
      })
    )

    await callerFor(db, fixture.owner).profile.importFromPdf({ fileBase64 })

    const jobs = await db
      .select()
      .from(work)
      .where(eq(work.userId, fixture.owner))
      .orderBy(asc(work.position))

    expect(jobs.map((job) => job.name)).toEqual([
      "Most recent",
      "The one before"
    ])
  })

  it("fills what a partial extraction found and leaves the rest empty", async () => {
    extracts.mockResolvedValue(
      extracted({
        lastName: "",
        phone: "",
        linkedIn: "",
        portfolio: "",
        education: [],
        skills: []
      })
    )

    const counts = await callerFor(db, fixture.owner).profile.importFromPdf({
      fileBase64
    })

    expect(counts).toEqual({ experience: 1, education: 0, skills: 0 })

    const [account] = await db
      .select()
      .from(user)
      .where(eq(user.id, fixture.owner))

    const [details] = await db
      .select()
      .from(contact)
      .where(eq(contact.userId, fixture.owner))

    // What it found is kept; what it didn't is empty rather than absent, so
    // the forms open on a field the user can correct.
    expect(account?.firstName).toBe("Ada")
    expect(account?.lastName).toBe("")
    expect(details?.location).toBe("London, UK")
    expect(details?.phone).toBe("")

    const jobs = await db
      .select()
      .from(work)
      .where(eq(work.userId, fixture.owner))

    expect(jobs).toHaveLength(1)
  })

  it("writes only to the calling user's rows", async () => {
    extracts.mockResolvedValue(extracted())

    await callerFor(db, fixture.owner).profile.importFromPdf({ fileBase64 })

    const strangersJobs = await db
      .select()
      .from(work)
      .where(eq(work.userId, fixture.stranger))

    const [stranger] = await db
      .select()
      .from(user)
      .where(eq(user.id, fixture.stranger))

    expect(strangersJobs.map((job) => job.name)).toEqual(["Stranger Co"])
    expect(stranger?.firstName).toBeNull()
  })

  it("reports an unreadable PDF as the user's to fix", async () => {
    readsText.mockRejectedValue(
      new Error("Could not read any text from that PDF.")
    )

    await expect(
      callerFor(db, fixture.owner).profile.importFromPdf({ fileBase64 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("writes nothing when the extraction fails", async () => {
    extracts.mockRejectedValue(new Error("OpenAI returned an empty response"))

    await expect(
      callerFor(db, fixture.owner).profile.importFromPdf({ fileBase64 })
    ).rejects.toBeInstanceOf(TRPCError)

    const jobs = await db
      .select()
      .from(work)
      .where(eq(work.userId, fixture.owner))

    expect(jobs).toEqual([])
  })

  /**
   * A user with no degree has to be able to leave the education step. The
   * schema's minimum is gone; this is the write it used to refuse.
   */
  describe("addEducation — an education history can be empty", () => {
    it("saves an empty education history", async () => {
      await callerFor(db, fixture.owner).profile.addEducation({ education: [] })

      const schools = await db
        .select()
        .from(school)
        .where(eq(school.userId, fixture.owner))

      expect(schools).toEqual([])
    })

    it("clears a history the user had already filled in", async () => {
      await callerFor(db, fixture.owner).profile.addEducation({
        education: [
          {
            name: "State University",
            degree: "BSc",
            startDate: "2016",
            endDate: "2020"
          }
        ]
      })

      await callerFor(db, fixture.owner).profile.addEducation({ education: [] })

      const schools = await db
        .select()
        .from(school)
        .where(eq(school.userId, fixture.owner))

      expect(schools).toEqual([])
    })
  })

  /**
   * The column existed a step before anything wrote to it. This is that
   * writer — and the reason a new resume comes out in the right language.
   */
  describe("profile.setLocale", () => {
    it("records the caller's interface language", async () => {
      await callerFor(db, fixture.owner).profile.setLocale({ locale: "es" })

      const rows = await db
        .select({ locale: user.locale })
        .from(user)
        .where(eq(user.id, fixture.owner))

      expect(rows[0]?.locale).toBe("es")
    })

    it("leaves every other account alone", async () => {
      await callerFor(db, fixture.owner).profile.setLocale({ locale: "es" })

      const rows = await db
        .select({ locale: user.locale })
        .from(user)
        .where(eq(user.id, fixture.stranger))

      expect(rows[0]?.locale).toBe("en")
    })

    it("refuses a locale the app does not ship", async () => {
      await expect(
        callerFor(db, fixture.owner).profile.setLocale({
          // The switcher can only send a locale it renders; a hand-rolled
          // request cannot leave the column reading something nothing falls
          // back from.
          locale: "fr" as "es"
        })
      ).rejects.toThrow()
    })
  })
})
