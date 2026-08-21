import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"
import {
  addSectionSchema,
  removeSectionSchema,
  reorderSectionsSchema,
  setSectionContentSchema
} from "~/server/modules/resume/section.schema"
import * as sectionService from "~/server/modules/resume/section.service"

/**
 * The sections of one resume.
 *
 * There is no procedure for changing a section's `kind` or `componentType`, and
 * that is the enforcement, not a UI convention: what a core section *is* stays
 * out of reach, so its typed rows stay machine-readable. Renaming goes through
 * `resume.updateField` with a `section.<id>.label` path, like every other
 * editable string.
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
    )
})
