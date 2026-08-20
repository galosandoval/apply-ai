import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import { asc, eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { appRouter } from "~/server/api/root"
import {
  connectTestDatabase,
  disconnectTestDatabase,
  resetTestDatabase,
  testDatabaseUrl,
  type TestDatabase
} from "~/server/db/test-database"
import { resume, school, user, work } from "~/server/db/schema"

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
})
