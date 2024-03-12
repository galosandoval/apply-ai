import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import { hash } from "bcryptjs"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc"
import { insertUserSchema } from "~/server/db/crud-schema"
import { contact, profile, user } from "~/server/db/schema"

export const userRouter = createTRPCRouter({
  create: publicProcedure
    .input(insertUserSchema)
    .mutation(async ({ input, ctx }) => {
      const {
        email,
        password,
        firstName,
        lastName,
        location,
        linkedIn,
        phone,
        portfolio,
        profession
      } = input

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

      const createdUser = await ctx.db
        .insert(user)
        .values({ email, password: hashedPassword, id: userId })
        .returning()

      if (!createdUser?.length) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Something went wrong."
        })
      }

      const createdProfile = await ctx.db
        .insert(profile)
        .values({
          userId: createdUser[0]?.id,
          id: createId(),
          skills: [],
          profession,
          firstName,
          lastName
        })
        .returning()

      if (!createdProfile?.length) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Something went wrong."
        })
      }

      await ctx.db.insert(contact).values({
        id: createId(),
        phone,
        linkedIn,
        portfolio,
        location,
        profileId: createdProfile[0]?.id!
      })
    })
})
