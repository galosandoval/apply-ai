import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import { hash } from "bcryptjs"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc"
import { profile, user } from "~/server/db/schema"

export const userRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        email: z.string().email().max(255),
        password: z.string().min(8).max(50)
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input

      const foundUser = await ctx.db
        .select()
        .from(user)
        .where(eq(user.email, email))

      if (foundUser.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already exists."
        })
      }

      const hashedPassword = await hash(password, 10)

      const createdUser = await ctx.db
        .insert(user)
        .values({ email, password: hashedPassword, id: createId() })
        .returning()

      if (!createdUser?.length) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Something went wrong."
        })
      }

      await ctx.db
        .insert(profile)
        .values({ userId: createdUser[0]?.id, id: createId() })
    })
})
