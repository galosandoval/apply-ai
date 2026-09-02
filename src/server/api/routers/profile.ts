import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"
import {
  addEducationSchema,
  addExperienceSchema,
  importFromPdfSchema,
  replaceSkillsSchema,
  setLocaleSchema,
  updateDetailsSchema,
  upsertNameAndContactSchema
} from "~/server/modules/profile/profile.schema"
import * as profileService from "~/server/modules/profile/profile.service"

/**
 * The signed-in user's own profile.
 *
 * Every procedure resolves the row from `ctx.session.user.id`. There is no
 * `profileId` input to check because there is no id a client could name.
 */
export const profileRouter = createTRPCRouter({
  read: protectedProcedure.query(({ ctx }) =>
    profileService.read(ctx.db, ctx.session.user.id)
  ),

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

  /**
   * The interface language, on the account.
   *
   * The URL is what changes the page — `/es` renders Spanish for anyone who
   * asks for it, signed in or not. This is the separate question of what a
   * *new resume* is written in, which is read from `user.locale` at creation
   * and so has to be recorded rather than inferred per request.
   *
   * Nothing in the interface calls this yet: there is no language picker, by
   * decision. Until something does, every account stays on the `'en'` default.
   */
  setLocale: protectedProcedure
    .input(setLocaleSchema)
    .mutation(({ input, ctx }) =>
      profileService.setLocale(ctx.db, ctx.session.user.id, input)
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
