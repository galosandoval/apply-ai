import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"
import {
  generateResume,
  generateResumeInput
} from "~/server/modules/profile/generate-resume"
import * as resumeService from "~/server/modules/resume/resume.service"
import {
  createResumeSchema,
  readResumeSchema,
  refreshFromAccountSchema,
  reorderRowsSchema,
  updateFieldSchema
} from "~/server/modules/resume/resume.schema"

export const resumeRouter = createTRPCRouter({
  /**
   * Drafts a resume against a job description.
   *
   * An ordinary mutation rather than a streaming API route: the dashboard shows
   * a loading state and needs the whole object before it can render anything,
   * so the stream was overhead with a `JSON.parse` on the end of it.
   */
  generate: protectedProcedure
    .input(generateResumeInput)
    .mutation(({ input }) => generateResume(input)),

  list: protectedProcedure.query(({ ctx }) =>
    resumeService.list(ctx.db, ctx.session.user.id)
  ),

  readById: protectedProcedure
    .input(readResumeSchema)
    .query(({ ctx, input }) =>
      resumeService.readById(ctx.db, ctx.session.user.id, input.resumeId)
    ),

  updateField: protectedProcedure
    .input(updateFieldSchema)
    .mutation(({ ctx, input }) =>
      resumeService.updateField(ctx.db, ctx.session.user.id, input)
    ),

  create: protectedProcedure
    .input(createResumeSchema)
    .mutation(({ ctx, input }) =>
      resumeService.create(ctx.db, ctx.session.user.id, input)
    ),

  /** Reorders the jobs, schools or skill groups inside one section. */
  reorderRows: protectedProcedure
    .input(reorderRowsSchema)
    .mutation(({ ctx, input }) =>
      resumeService.reorderRows(ctx.db, ctx.session.user.id, input)
    ),

  /** Pulls the account's current details back into this resume, on request. */
  refreshFromAccount: protectedProcedure
    .input(refreshFromAccountSchema)
    .mutation(({ ctx, input }) =>
      resumeService.refreshFromAccount(
        ctx.db,
        ctx.session.user.id,
        input.resumeId
      )
    )
})
