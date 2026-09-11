import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"
import {
  addSectionSchema,
  removeSectionSchema,
  renameSectionSchema,
  reorderSectionsSchema,
  setSectionContentSchema
} from "~/server/modules/resume/section.schema"
import * as sectionService from "~/server/modules/resume/section.service"

/**
 * The sections of one resume — or, when the input names no resume, of the
 * account whose master copy new resumes are drawn from.
 *
 * There is no procedure for changing a section's `kind` or `componentType`, and
 * that is the enforcement, not a UI convention: what a core section *is* stays
 * out of reach, so its typed rows stay machine-readable.
 */
export const sectionRouter = createTRPCRouter({
  add: protectedProcedure
    .input(addSectionSchema)
    .mutation(({ ctx, input }) =>
      sectionService.add(ctx.db, ctx.session.user.id, input)
    ),

  remove: protectedProcedure
    .input(removeSectionSchema)
    .mutation(({ ctx, input }) =>
      sectionService.remove(ctx.db, ctx.session.user.id, input)
    ),

  /**
   * Replaces a custom section's content wholesale — how an element is added or
   * removed, where `resume.updateField` edits one that already exists.
   */
  setContent: protectedProcedure
    .input(setSectionContentSchema)
    .mutation(({ ctx, input }) =>
      sectionService.setContent(ctx.db, ctx.session.user.id, input)
    ),

  reorder: protectedProcedure
    .input(reorderSectionsSchema)
    .mutation(({ ctx, input }) =>
      sectionService.reorder(ctx.db, ctx.session.user.id, input)
    ),

  /**
   * Renames a section.
   *
   * A resume's own heading is an editable string on the document, so the editor
   * writes it through `resume.updateField` with a `section.<id>.label` path;
   * the account has no document to address, and this is how it renames.
   */
  rename: protectedProcedure
    .input(renameSectionSchema)
    .mutation(({ ctx, input }) =>
      sectionService.rename(ctx.db, ctx.session.user.id, input)
    )
})
