import { eq } from "drizzle-orm"
import { z } from "zod"
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc"
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
    })
})
