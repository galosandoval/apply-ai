import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure
} from "~/server/api/trpc"
import {
  insertEducationSchema,
  insertExperienceSchema,
  insertNameSchema,
  updateProfileSchema
} from "~/server/db/crud-schema"
import { profile, school, work } from "~/server/db/schema"

export const profileRouter = createTRPCRouter({
  read: publicProcedure
    .input(
      z.object({
        userId: z.string().cuid2()
      })
    )
    .query(async ({ input, ctx }) => {
      const foundProfile = await ctx.db
        .select()
        .from(profile)
        .where(eq(profile.userId, input.userId))

      const result = !!foundProfile?.length && foundProfile[0]

      if (!result) {
        throw new TRPCError({
          message: "Profile not found",
          code: "NOT_FOUND"
        })
      }

      const education = await ctx.db
        .select()
        .from(school)
        .where(eq(school.profileId, result.id))

      const experience = await ctx.db
        .select()
        .from(work)
        .where(eq(work.profileId, result.id))

      return { ...result, education, experience }
    }),

  upsertName: protectedProcedure
    .input(insertNameSchema)
    .mutation(async ({ input, ctx }) => {
      const { firstName, lastName, id } = input

      const inputId = id ?? createId()
      console.log(ctx.session.user.id)
      const newProfile = await ctx.db
        .insert(profile)
        .values({
          firstName,
          lastName,
          id: inputId,
          userId: ctx.session.user.id
        })
        .onConflictDoUpdate({
          set: { firstName, lastName },
          target: profile.id
        })
        .returning()

      if (!newProfile?.length) {
        throw new TRPCError({
          message: "Profile not created",
          code: "INTERNAL_SERVER_ERROR"
        })
      }

      return newProfile[0]
    }),

  update: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ input, ctx }) => {
      const { profession, interests, introduction } = input

      return await ctx.db
        .update(profile)
        .set({
          profession,
          introduction,
          interests
        })
        .where(eq(profile.userId, ctx.session.user.id))
    }),

  addEducation: protectedProcedure
    .input(insertEducationSchema)
    .mutation(async ({ input, ctx }) => {
      const { education } = input

      const schoolsToInsert = education.map((e) => ({
        ...e,
        id: e?.id ? e.id : createId()
      }))

      return await ctx.db
        .insert(school)
        .values(schoolsToInsert)
        .onConflictDoUpdate({
          target: school.id,
          set: {
            degree: sql`excluded.degree`,
            description: sql`excluded.description`,
            endDate: sql`excluded.end_date`,
            gpa: sql`excluded.gpa`,
            location: sql`excluded.location`,
            name: sql`excluded.name`,
            startDate: sql`excluded.start_date`,
            profileId: sql`excluded.profile_id`,
            id: sql`excluded.id`
          }
        })
    }),

  addWork: protectedProcedure
    .input(insertExperienceSchema)
    .mutation(async ({ input, ctx }) => {
      const { experience } = input

      const workToInsert = experience.map((e) => ({
        ...e,
        id: e?.id ? e.id : createId()
      }))

      return await ctx.db
        .insert(work)
        .values(workToInsert)
        .onConflictDoUpdate({
          target: work.id,
          set: {
            companyName: sql`excluded.name`,
            description: sql`excluded.description`,
            endDate: sql`excluded.end_date`,
            startDate: sql`excluded.start_date`,
            profileId: sql`excluded.profile_id`,
            id: sql`excluded.id`
          }
        })
    }),

  addSkills: protectedProcedure
    .input(
      z.object({
        skills: z.object({ value: z.string().min(3) }).array(),
        userId: z.string().cuid2()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { skills, userId } = input

      return await ctx.db
        .update(profile)
        .set({
          skills: skills.map((s) => s.value)
        })
        .where(eq(profile.userId, userId))
    }),

  finishOnboarding: protectedProcedure
    .input(z.object({ userId: z.string().cuid2() }))
    .mutation(async ({ input, ctx }) => {
      const { userId } = input

      return await ctx.db
        .update(profile)
        .set({
          isOnboarded: true
        })
        .where(eq(profile.userId, userId))
    })
})
