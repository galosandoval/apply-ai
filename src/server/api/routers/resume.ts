import { eq } from "drizzle-orm"
import { z } from "zod"
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc"
import { profile, resume, user } from "~/server/db/schema"

export const resumeRouter = createTRPCRouter({
  readById: publicProcedure
    .input(
      z.object({
        resumeId: z.string().cuid2()
      })
    )
    .query(async ({ input, ctx }) => {
      return await ctx.db
        .select({
          id: resume.id,
          jobDescription: resume.jobDescription,
          profession: resume.profession,
          skills: resume.skills,
          introduction: resume.introduction,
          interests: resume.interests,
          experience: resume.experience,
          education: resume.education,
          contact: resume.contact,
          firstName: profile.firstName,
          lastName: profile.lastName
        })
        .from(user)
        .innerJoin(resume, eq(user.id, resume.userId))
        .innerJoin(profile, eq(user.id, profile.userId))
        .where(eq(resume.id, input.resumeId))
    })
})
