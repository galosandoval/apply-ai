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
import { contact, school, section, skill, user, work } from "~/server/db/schema"
import {
  connectTestDatabase,
  disconnectTestDatabase,
  resetTestDatabase,
  testDatabaseUrl,
  type TestDatabase
} from "~/server/db/test-database"
import { type ExtractedResume } from "~/server/modules/profile/parse-resume-pdf"
import * as profileService from "~/server/modules/profile/profile.service"

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
function extracted(overrides: Partial<ExtractedResume> = {}): ExtractedResume {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    profession: "Engineer",
    location: "London, UK",
    email: "ada@lovelace.dev",
    phone: "555-0100",
    linkedIn: "linkedin.com/in/ada",
    portfolio: "ada.dev",
    experience: [
      {
        name: "Acme",
        title: "Engineer",
        startDate: "2020",
        endDate: "Present",
        current: false,
        location: "Remote",
        body: "- Shipped the thing"
      }
    ],
    education: [
      {
        name: "State University",
        degree: "BSc",
        startDate: "2016",
        endDate: "2020",
        current: false,
        location: "",
        gpa: "3.9",
        body: ""
      }
    ],
    skills: [{ category: "Languages", all: ["TypeScript", "Go"] }],
    sections: [],
    truncated: { experience: false, education: false },
    ...overrides
  }
}

/** One section as the extraction returns it, defaults filled in. */
function extractedSection(
  overrides: Partial<ExtractedResume["sections"][number]>
): ExtractedResume["sections"][number] {
  return { heading: "", position: 0, entries: [], text: "", ...overrides }
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
    current: false,
    body: "- Untouched",
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

    expect(counts).toMatchObject({ experience: 1, education: 1, skills: 1 })

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
    expect(jobs[0]?.body).toBe("- Shipped the thing")
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
            endDate: "",
            current: true,
            location: "",
            body: "- Latest"
          },
          {
            name: "The one before",
            title: "Engineer",
            startDate: "2019",
            endDate: "2022",
            current: false,
            location: "",
            body: "- Earlier"
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

    expect(counts).toMatchObject({ experience: 1, education: 0, skills: 0 })

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
   * #98. A resume is more than the four things an applicant tracking system
   * reads off it, and until now everything else in the document was dropped on
   * the floor without a word. Each heading the extraction returns is resolved
   * by `resolveSectionHeading` and written as a section of the account's own.
   */
  describe("every section in the document", () => {
    /** The account's own sections, in the order the profile reads them. */
    const accountSections = async (userId: string) =>
      db
        .select()
        .from(section)
        .where(eq(section.userId, userId))
        .orderBy(asc(section.position))

    /** Just the imported ones — the core three are not the import's to write. */
    const importedSections = async (userId: string) =>
      (await accountSections(userId)).filter((row) => row.kind === "custom")

    const document = [
      extractedSection({
        heading: "Profile",
        position: 0,
        text: "An engineer who ships."
      }),
      extractedSection({
        heading: "Certifications",
        position: 1,
        entries: ["AWS Certified Developer — 2024"]
      }),
      extractedSection({
        heading: "Hobbies",
        position: 2,
        entries: ["Chess", "Bouldering"]
      })
    ]

    it("writes a section per extracted heading, in the document's order", async () => {
      extracts.mockResolvedValue(extracted({ sections: document }))

      await callerFor(db, fixture.owner).profile.importFromPdf({ fileBase64 })

      expect(
        (await importedSections(fixture.owner)).map((row) => row.label)
      ).toEqual(["Profile", "Certifications", "Hobbies"])
    })

    it("orders by the position the extraction gave, not the array", async () => {
      extracts.mockResolvedValue(
        extracted({
          sections: [
            extractedSection({
              heading: "Hobbies",
              position: 2,
              entries: ["Chess"]
            }),
            extractedSection({
              heading: "Profile",
              position: 0,
              text: "Ships."
            })
          ]
        })
      )

      await callerFor(db, fixture.owner).profile.importFromPdf({ fileBase64 })

      expect(
        (await importedSections(fixture.owner)).map((row) => row.label)
      ).toEqual(["Profile", "Hobbies"])
    })

    it("keeps the core three and appends the document's sections after them", async () => {
      extracts.mockResolvedValue(extracted({ sections: document }))

      await callerFor(db, fixture.owner).profile.importFromPdf({ fileBase64 })

      const rows = await accountSections(fixture.owner)

      expect(rows.map((row) => row.kind)).toEqual([
        "skills",
        "experience",
        "education",
        "custom",
        "custom",
        "custom"
      ])

      expect(rows.map((row) => row.position)).toEqual([0, 1, 2, 3, 4, 5])
    })

    /**
     * The shape is `resolveSectionHeading`'s to decide and is asserted as
     * values in #93. What is asserted here is that the import actually asks it
     * — a heading that reaches the database as rich text because nobody
     * resolved it is the same bug at the other end of the wire.
     */
    it("draws each section as the heading it matched says it should", async () => {
      extracts.mockResolvedValue(extracted({ sections: document }))

      await callerFor(db, fixture.owner).profile.importFromPdf({ fileBase64 })

      expect(
        (await importedSections(fixture.owner)).map((row) => row.componentType)
      ).toEqual(["richText", "twoColumn", "tagList"])
    })

    it("keeps an unrecognised heading and shapes it from its content", async () => {
      extracts.mockResolvedValue(
        extracted({
          sections: [
            extractedSection({
              heading: "Things I Have Broken",
              entries: [
                "The build, twice, in the same afternoon",
                "A production database nobody had backed up"
              ]
            })
          ]
        })
      )

      await callerFor(db, fixture.owner).profile.importFromPdf({ fileBase64 })

      const [imported] = await importedSections(fixture.owner)

      // The heading is the user's own text, kept verbatim: nothing matched it,
      // and a section that arrives called something else is a section they
      // cannot find again.
      expect(imported?.label).toBe("Things I Have Broken")
      expect(imported?.componentType).toBe("list")
      expect(imported?.content).toEqual({
        items: [
          "The build, twice, in the same afternoon",
          "A production database nobody had backed up"
        ]
      })
    })

    it("keeps a heading in the document's own language, untranslated", async () => {
      extracts.mockResolvedValue(
        extracted({
          sections: [
            extractedSection({ heading: "Pasatiempos", entries: ["Ajedrez"] })
          ]
        })
      )

      await callerFor(db, fixture.owner).profile.importFromPdf({ fileBase64 })

      const [imported] = await importedSections(fixture.owner)

      expect(imported?.label).toBe("Pasatiempos")
    })

    it("replaces the previous import rather than accumulating", async () => {
      const caller = callerFor(db, fixture.owner)

      extracts.mockResolvedValue(extracted({ sections: document }))
      await caller.profile.importFromPdf({ fileBase64 })

      extracts.mockResolvedValue(
        extracted({
          sections: [
            extractedSection({
              heading: "Projects",
              entries: ["Apply AI — 2025"]
            })
          ]
        })
      )
      await caller.profile.importFromPdf({ fileBase64 })

      expect(
        (await importedSections(fixture.owner)).map((row) => row.label)
      ).toEqual(["Projects"])

      expect(
        (await accountSections(fixture.owner)).map((row) => row.position)
      ).toEqual([0, 1, 2, 3])
    })

    it("keeps the sections a partial extraction found", async () => {
      extracts.mockResolvedValue(
        extracted({
          experience: [],
          education: [],
          skills: [],
          sections: [
            extractedSection({ heading: "Profile", text: "An engineer." }),
            // Nothing to recognise it by, so there is nothing to write.
            extractedSection({ heading: "   ", entries: ["Orphaned"] })
          ]
        })
      )

      await callerFor(db, fixture.owner).profile.importFromPdf({ fileBase64 })

      expect(
        (await importedSections(fixture.owner)).map((row) => row.label)
      ).toEqual(["Profile"])
    })

    it("leaves another account's sections alone", async () => {
      extracts.mockResolvedValue(extracted({ sections: document }))

      await callerFor(db, fixture.owner).profile.importFromPdf({ fileBase64 })

      expect(await accountSections(fixture.stranger)).toEqual([])
    })
  })

  describe("the confirmation", () => {
    it("counts every section, not only the typed three", async () => {
      extracts.mockResolvedValue(
        extracted({
          sections: [
            extractedSection({ heading: "Profile", text: "An engineer." }),
            extractedSection({ heading: "Hobbies", entries: ["Chess"] })
          ]
        })
      )

      const counts = await callerFor(db, fixture.owner).profile.importFromPdf({
        fileBase64
      })

      // The core three plus the two the document added.
      expect(counts.sections).toBe(5)
    })

    it("reports a history the extraction capped", async () => {
      extracts.mockResolvedValue(
        extracted({ truncated: { experience: true, education: false } })
      )

      const counts = await callerFor(db, fixture.owner).profile.importFromPdf({
        fileBase64
      })

      expect(counts.truncated).toEqual({ experience: true, education: false })
    })

    it("says nothing was dropped when nothing was", async () => {
      extracts.mockResolvedValue(extracted())

      const counts = await callerFor(db, fixture.owner).profile.importFromPdf({
        fileBase64
      })

      expect(counts.truncated).toEqual({ experience: false, education: false })
    })
  })

  /**
   * #98. The one contact detail the import never read. The address someone
   * signed up with is not necessarily the one printed on the resume they send
   * to employers, and the document is the one being sent.
   */
  it("takes the email from the document rather than the account", async () => {
    extracts.mockResolvedValue(extracted({ email: "ada@analytical.engine" }))

    await callerFor(db, fixture.owner).profile.importFromPdf({ fileBase64 })

    const [details] = await db
      .select()
      .from(contact)
      .where(eq(contact.userId, fixture.owner))

    const [account] = await db
      .select()
      .from(user)
      .where(eq(user.id, fixture.owner))

    expect(details?.email).toBe("ada@analytical.engine")
    expect(account?.email).not.toBe(details?.email)
  })

  /**
   * #71 put a boolean beside the dates, and the onboarding steps are what write
   * it. A flag the step collects and the write drops is a checkbox the user
   * ticks and finds unticked when they come back — including on the *second*
   * save, where the row already exists and the write is an upsert.
   */
  describe("the current flag survives the round trip", () => {
    const currentJob = (current: boolean) => ({
      experience: [
        {
          name: "Acme",
          title: "Engineer",
          startDate: "2020-01",
          endDate: current ? "" : "2022-03",
          current,
          body: "- Shipped the thing"
        }
      ]
    })

    const savedJob = async () => {
      const [job] = await db
        .select()
        .from(work)
        .where(eq(work.userId, fixture.owner))

      return job
    }

    it("saves a job the user is still in", async () => {
      await callerFor(db, fixture.owner).profile.addWork(currentJob(true))

      expect(await savedJob()).toMatchObject({ current: true, endDate: "" })
    })

    it("unsets it when the user says the job ended", async () => {
      const caller = callerFor(db, fixture.owner)

      await caller.profile.addWork(currentJob(true))
      await caller.profile.addWork(currentJob(false))

      expect(await savedJob()).toMatchObject({
        current: false,
        endDate: "2022-03"
      })
    })

    it("saves it on a school as well", async () => {
      await callerFor(db, fixture.owner).profile.addEducation({
        education: [
          {
            name: "State University",
            degree: "BSc",
            startDate: "2016-09",
            endDate: "",
            current: true
          }
        ]
      })

      const [saved] = await db
        .select()
        .from(school)
        .where(eq(school.userId, fixture.owner))

      expect(saved).toMatchObject({ current: true, endDate: "" })
    })
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
            endDate: "2020",
            current: false
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
  /*
    Not a procedure — the onboarding layout calls this on the server to decide
    whether to let the route render at all. #94: a returning user with a profile
    does not see onboarding again.
  */
  describe("hasProfile", () => {
    const filledContact = {
      firstName: "Ada",
      lastName: "Lovelace",
      profession: "Engineer",
      location: "London, UK",
      phone: "",
      linkedIn: "",
      portfolio: ""
    }

    it("is false for an account that has not filled the contact step", async () => {
      await expect(profileService.hasProfile(db, fixture.owner)).resolves.toBe(
        false
      )
    })

    it("is true once a name and profession are on the row", async () => {
      await callerFor(db, fixture.owner).profile.upsertNameAndContact(
        filledContact
      )

      await expect(profileService.hasProfile(db, fixture.owner)).resolves.toBe(
        true
      )
    })

    it("does not read one account's profile as another's", async () => {
      await callerFor(db, fixture.owner).profile.upsertNameAndContact(
        filledContact
      )

      await expect(
        profileService.hasProfile(db, fixture.stranger)
      ).resolves.toBe(false)
    })
  })

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
