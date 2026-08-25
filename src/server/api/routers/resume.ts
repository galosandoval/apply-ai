import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"
import * as resumeService from "~/server/modules/resume/resume.service"
import {
  addRowSchema,
  createResumeSchema,
  generateResumeSchema,
  readResumeSchema,
  refreshFromAccountSchema,
  removeResumeSchema,
  removeRowSchema,
  reorderRowsSchema,
  setBulletsSchema,
  updateFieldSchema
} from "~/server/modules/resume/resume.schema"

export const resumeRouter = createTRPCRouter({
  /**
   * Drafts a resume against a job description, saves it, and returns its id for
   * the client to navigate to.
   *
   * An ordinary mutation rather than a streaming API route: the dashboard shows
   * a loading state and needs the whole object before it can render anything,
   * so the stream was overhead with a `JSON.parse` on the end of it.
   */
  generate: protectedProcedure
    .input(generateResumeSchema)
    .mutation(({ ctx, input }) =>
      resumeService.generate(ctx.db, ctx.session.user.id, input)
    ),

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

  /** Deletes a resume and every row snapshotted onto it. */
  remove: protectedProcedure
    .input(removeResumeSchema)
    .mutation(({ ctx, input }) =>
      resumeService.remove(ctx.db, ctx.session.user.id, input.resumeId)
    ),

  /** Appends a blank job, school or skill group. */
  addRow: protectedProcedure
    .input(addRowSchema)
    .mutation(({ ctx, input }) =>
      resumeService.addRow(ctx.db, ctx.session.user.id, input)
    ),

  removeRow: protectedProcedure
    .input(removeRowSchema)
    .mutation(({ ctx, input }) =>
      resumeService.removeRow(ctx.db, ctx.session.user.id, input)
    ),

  /**
   * Replaces a job's whole bullet list — how a bullet is added, removed or
   * moved, where `updateField` rewrites one that already exists.
   */
  setBullets: protectedProcedure
    .input(setBulletsSchema)
    .mutation(({ ctx, input }) =>
      resumeService.setBullets(ctx.db, ctx.session.user.id, input)
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
