import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { users } from "~/server/db/schema";

export const userRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        email: z.string().email().max(255),
        password: z.string().min(8).max(50),
        bio: z.string().min(1).max(255).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input;

      const foundUser = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, email));

      if (foundUser.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already exists.",
        });
      }

      const hashedPassword = await hash(password, 10);

      await ctx.db
        .insert(users)
        .values({ email, password: hashedPassword, id: createId() });
    }),

  readAll: protectedProcedure.query(async ({ ctx }) => {
    const response = await ctx.db.select().from(users);

    return response;
  }),
});
