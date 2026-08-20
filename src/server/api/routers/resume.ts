import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { parseResumeFieldPath } from "~/lib/resume-field-path"
import { assertOwnsResume } from "~/server/api/ownership"
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"
import { type db } from "~/server/db"
import { insertSkillsSchema } from "~/server/db/crud-schema"
import { resume, school, work } from "~/server/db/schema"
import {
  generateResume,
  generateResumeInput
} from "~/server/modules/profile/generate-resume"

type Database = typeof db

/**
 * Replaces one entry of a job's `bullets` array.
 *
 * Postgres can assign to an array subscript directly, but assigning past the
 * end silently pads the array with NULLs — so the current value is read and
 * bounds-checked inside a transaction rather than written blind.
 */
async function updateBullet(
  database: Database,
  {
    resumeId,
    rowId,
    bulletIndex,
    value
  }: { resumeId: string; rowId: string; bulletIndex: number; value: string }
) {
  const matchesRow = and(eq(work.id, rowId), eq(work.resumeId, resumeId))

  await database.transaction(async (tx) => {
    const rows = await tx
      .select({ bullets: work.bullets })
      .from(work)
      .where(matchesRow)

    const bullets = rows[0]?.bullets

    if (!bullets || bulletIndex >= bullets.length) throw fieldNotFound()

    const nextBullets = [...bullets]
    nextBullets[bulletIndex] = value

    await tx.update(work).set({ bullets: nextBullets }).where(matchesRow)
  })
}

function fieldNotFound() {
  return new TRPCError({ code: "NOT_FOUND", message: "Field not found" })
}

/**
 * Writes one column of a snapshotted `work` / `school` row.
 *
 * Scoping the write to `resumeId` as well as the row id is what stops a caller
 * editing another resume's rows through a resume they do own.
 */
async function updateSnapshotColumn(
  database: Database,
  {
    table,
    resumeId,
    rowId,
    column,
    value
  }: {
    table: typeof work | typeof school
    resumeId: string
    rowId: string
    column: string
    value: string
  }
) {
  const updated = await database
    .update(table)
    .set({ [column]: value })
    .where(and(eq(table.id, rowId), eq(table.resumeId, resumeId)))
    .returning({ id: table.id })

  if (!updated.length) throw fieldNotFound()
}

export const resumeRouter = createTRPCRouter({
  /**
   * Drafts a resume against a job description.
   *
   * An ordinary mutation rather than a streaming API route: the dashboard shows
   * a loading state and needs the whole object before it can render anything,
   * so the stream was overhead with a `JSON.parse` on the end of it.
   */
  generate: protectedProcedure
    .input(generateResumeInput)
    .mutation(({ input }) => generateResume(input)),

  list: protectedProcedure.query(async ({ ctx }) => {
    const resumes = await ctx.db
      .select({ createdAt: resume.createdAt, id: resume.id })
      .from(resume)
      .where(eq(resume.userId, ctx.session.user.id))

    return resumes
  }),

  readById: protectedProcedure
    .input(
      z.object({
        resumeId: z.string().cuid2()
      })
    )
    .query(async ({ input, ctx }) => {
      await assertOwnsResume(ctx.db, ctx.session.user.id, input.resumeId)

      const usersResume = await ctx.db
        .select()
        .from(resume)
        .where(eq(resume.id, input.resumeId))

      if (!usersResume?.length) throw new Error("Resume not found")

      const foundResume = usersResume[0]!

      // Ordered so the template's indices mean the same thing on every fetch.
      // `id` is arbitrary but stable; a real `position` column is still owed.
      const experience = await ctx.db
        .select()
        .from(work)
        .where(eq(work.resumeId, input.resumeId))
        .orderBy(asc(work.id))

      const education = await ctx.db
        .select()
        .from(school)
        .where(eq(school.resumeId, input.resumeId))
        .orderBy(asc(school.id))

      return { ...foundResume, experience, education }
    }),

  /**
   * Writes one editable string. `path` addresses rows by id
   * (`experience.<id>.bullets.2`), so it survives reordering.
   *
   * The grammar and the set of writable columns live in `~/lib/resume-field-path`,
   * shared with the client so the template, the optimistic cache patch and this
   * write can't disagree about what's editable.
   */
  updateField: protectedProcedure
    .input(
      z.object({
        resumeId: z.string().cuid2(),
        path: z.string().max(200),
        value: z.string().max(1000)
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnsResume(ctx.db, ctx.session.user.id, input.resumeId)

      const target = parseResumeFieldPath(input.path)

      if (!target) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Not an editable field: ${input.path}`
        })
      }

      if (target.section === "resume") {
        await ctx.db
          .update(resume)
          .set({ [target.column]: input.value })
          .where(eq(resume.id, input.resumeId))

        return
      }

      if (target.kind === "bullet") {
        await updateBullet(ctx.db, {
          resumeId: input.resumeId,
          rowId: target.row,
          bulletIndex: target.bulletIndex,
          value: input.value
        })

        return
      }

      await updateSnapshotColumn(ctx.db, {
        table: target.section === "experience" ? work : school,
        resumeId: input.resumeId,
        rowId: target.row,
        column: target.column,
        value: input.value
      })
    }),

  create: protectedProcedure
    .input(
      z
        .object({
          profession: z.string(),
          interests: z.string(),
          education: z.array(
            z.object({
              name: z.string(),
              startDate: z.string(),
              endDate: z.string(),
              degree: z.string(),
              description: z.string().optional().nullable(),
              gpa: z.string().optional().nullable(),
              location: z.string().optional().nullable()
              // keyAchievements: z.string().array()
            })
          ),
          experience: z.array(
            z.object({
              name: z.string(),
              startDate: z.string(),
              endDate: z.string(),
              title: z.string(),
              bullets: z.string().array()
              // keyAchievements: z.string().array()
            })
          )
        })
        .merge(insertSkillsSchema)
    )
    .mutation(async ({ ctx, input }) => {
      const { profession, interests, education, experience } = input
      const userId = ctx.session.user.id

      // The resume and its snapshotted work/school rows are one unit — a
      // partial write leaves a resume that renders with missing sections.
      const resumeId = await ctx.db.transaction(async (tx) => {
        const newResume = await tx
          .insert(resume)
          .values({
            id: createId(),
            profession,
            interests: interests,
            userId
          })
          .returning()

        if (!newResume?.length) throw new Error("Resume not created")

        const id = newResume[0]!.id

        await tx
          .insert(work)
          .values(
            experience.map((e) => ({ ...e, id: createId(), resumeId: id }))
          )

        await tx.insert(school).values(
          education.map((e) => ({
            ...e,
            id: createId(),
            name: e.name,
            resumeId: id
          }))
        )

        return id
      })

      return { resumeId }
    })
})
