import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import { eq } from "drizzle-orm"
import { z } from "zod"
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure
} from "~/server/api/trpc"
import {
  insertEducationSchema,
  insertNameSchema,
  updateProfileSchema
} from "~/server/db/crud-schema"
import { profile, school } from "~/server/db/schema"

export const profileRouter = createTRPCRouter({
  read: publicProcedure
    .input(
      z.object({
        userId: z.string().cuid()
      })
    )
    .query(async ({ input, ctx }) => {
      const foundProfile = await ctx.db
        .select()
        .from(profile)
        .where(eq(profile.id, input.userId))

      if (!foundProfile?.length) {
        throw new TRPCError({
          message: "Profile not found",
          code: "INTERNAL_SERVER_ERROR"
        })
      }

      return foundProfile[0]
    }),

  create: protectedProcedure
    .input(insertNameSchema)
    .mutation(async ({ input, ctx }) => {
      const { firstName, lastName } = input

      const id = createId()

      const newProfile = await ctx.db
        .insert(profile)
        .values({
          firstName,
          lastName,
          id,
          userId: ctx.session.user.id
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

      const schoolsToInsert = education.map((e) => ({ ...e, id: createId() }))

      return await ctx.db.insert(school).values(schoolsToInsert)
    }),

  createSkills: protectedProcedure
    .input(
      z.object({
        skills: z.object({ value: z.string().min(3) }).array(),
        userId: z.string().cuid()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { skills, userId } = input

      const prevSkills = await ctx.db
        .select({ skills: profile.skills })
        .from(profile)
        .where(eq(profile.id, userId))

      if (!prevSkills?.length) {
        throw new TRPCError({
          message: "Profile not found",
          code: "INTERNAL_SERVER_ERROR"
        })
      }

      return await ctx.db.update(profile).set({
        skills: skills.map((s) => s.value),
        userId
      })
    })
})
