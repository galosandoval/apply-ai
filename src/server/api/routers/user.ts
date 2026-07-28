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

      const userId = createId()

      // A user without a profile can sign in but hits "Profile not found" on
      // every screen, so both rows have to land together.
      await ctx.db.transaction(async (tx) => {
        const createdUser = await tx
          .insert(user)
          .values({ email, password: hashedPassword, id: userId })
          .returning()

        if (!createdUser?.length) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Something went wrong."
          })
        }

        await tx.insert(profile).values({
          id: createId(),
          userId: createdUser[0]!.id,
          profession: "",
          interests: "",
          introduction: ""
        })
      })
    })
})
