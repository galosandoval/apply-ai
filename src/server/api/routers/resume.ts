import { createId } from "@paralleldrive/cuid2"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"
import { resume, school, work } from "~/server/db/schema"

export const resumeRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ profileId: z.string().cuid2() }))
    .query(async ({ ctx, input }) => {
      const resumes = await ctx.db
        .select({ createdAt: resume.createdAt, id: resume.id })
        .from(resume)
        .where(eq(resume.profileId, input.profileId))

      return resumes
    }),

  readById: protectedProcedure
    .input(
      z.object({
        resumeId: z.string().cuid2()
      })
    )
    .query(async ({ input, ctx }) => {
      const usersResume = await ctx.db
        .select()
        .from(resume)
        .where(eq(resume.id, input.resumeId))

      if (!usersResume?.length) throw new Error("Resume not found")

      const foundResume = usersResume[0]!

      const experience = await ctx.db
        .select()
        .from(work)
        .where(eq(work.resumeId, input.resumeId))

      const education = await ctx.db
        .select()
        .from(school)
        .where(eq(school.resumeId, input.resumeId))

      return { ...foundResume, experience, education }
    }),

  create: protectedProcedure
    .input(
      z.object({
        profileId: z.string().cuid2(),
        profession: z.string(),
        skills: z.string().array(),
        introduction: z.string(),
        interests: z.string(),
        education: z.array(
          z.object({
            schoolName: z.string(),
            startDate: z.string(),
            endDate: z.string(),
            degree: z.string(),
            description: z.string(),
            gpa: z.string().optional(),
            location: z.string().optional()
            // keyAchievements: z.string().array()
          })
        ),
        experience: z.array(
          z.object({
            companyName: z.string(),
            startDate: z.string(),
            endDate: z.string(),
            title: z.string(),
            description: z.string()
            // keyAchievements: z.string().array()
          })
        )
      })
    )
    .mutation(async ({ ctx, input }) => {
      const {
        profession,
        skills,
        introduction,
        interests,
        education,
        experience,
        profileId
      } = input

      const newResume = await ctx.db
        .insert(resume)
        .values({
          id: createId(),
          profession,
          skills: skills.join(","),
          introduction,
          interests: interests,
          profileId
        })
        .returning()

      if (!newResume?.length) throw new Error("Resume not created")

      const resumeId = newResume[0]?.id!

      await ctx.db
        .insert(work)
        .values(experience.map((e) => ({ ...e, id: createId(), resumeId })))

      await ctx.db.insert(school).values(
        education.map((e) => ({
          ...e,
          id: createId(),
          name: e.schoolName,
          resumeId
        }))
      )

      return { resumeId }
    })
})
