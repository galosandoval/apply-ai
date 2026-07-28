import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"
import {
  addEducationSchema,
  addExperienceSchema,
  importFromPdfSchema,
  readProfileSchema,
  replaceSkillsSchema,
  updateDetailsSchema,
  upsertNameAndContactSchema
} from "~/server/modules/profile/profile.schema"
import * as profileService from "~/server/modules/profile/profile.service"

export const profileRouter = createTRPCRouter({
  // `userId` stays in the input for the existing callers, but the profile is
  // always resolved from the session — a client can't read someone else's.
  read: protectedProcedure
    .input(readProfileSchema)
    .query(({ ctx }) => profileService.read(ctx.db, ctx.session.user.id)),

  upsertNameAndContact: protectedProcedure
    .input(upsertNameAndContactSchema)
    .mutation(({ input, ctx }) =>
      profileService.upsertNameAndContact(ctx.db, ctx.session.user.id, input)
    ),

  update: protectedProcedure
    .input(updateDetailsSchema)
    .mutation(({ input, ctx }) =>
      profileService.updateDetails(ctx.db, ctx.session.user.id, input)
    ),

  addEducation: protectedProcedure
    .input(addEducationSchema)
    .mutation(({ input, ctx }) =>
      profileService.replaceEducation(ctx.db, ctx.session.user.id, input)
    ),

  addWork: protectedProcedure
    .input(addExperienceSchema)
    .mutation(({ input, ctx }) =>
      profileService.replaceExperience(ctx.db, ctx.session.user.id, input)
    ),

  importFromPdf: protectedProcedure
    .input(importFromPdfSchema)
    .mutation(({ input, ctx }) =>
      profileService.importFromPdf(ctx.db, ctx.session.user.id, input)
    ),

  upsertSkills: protectedProcedure
    .input(replaceSkillsSchema)
    .mutation(({ input, ctx }) =>
      profileService.replaceSkills(ctx.db, ctx.session.user.id, input)
    )
})
