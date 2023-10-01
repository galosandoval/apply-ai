import { createId } from "@paralleldrive/cuid2"
import { eq } from "drizzle-orm"
import { z } from "zod"
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure
} from "~/server/api/trpc"
import { insertProfileSchema } from "~/server/db/crud-schema"
import { profile } from "~/server/db/schema"

export const profileRouter = createTRPCRouter({
  read: publicProcedure
    .input(
      z.object({
        userId: z.string().cuid()
      })
    )
    .query(async ({ input, ctx }) => {
      return await ctx.db
        .select()
        .from(profile)
        .where(eq(profile.id, input.userId))
    }),

  create: protectedProcedure
    .input(insertProfileSchema)
    .mutation(async ({ input, ctx }) => {
      const {
        profession,
        interests,
        introduction,
        userId,
        firstName,
        lastName
      } = input

      const id = createId()

      return await ctx.db.update(profile).set({
        firstName,
        lastName,
        id,
        userId,
        profession,
        interests,
        introduction
      })
    })
})
