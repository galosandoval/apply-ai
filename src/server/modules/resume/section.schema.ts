import { z } from "zod"
import { sectionComponentTypes } from "~/lib/section-content"
import { resumeIdSchema, rowId } from "./resume.schema"

// API contracts for a resume's sections.
//
// There is no input for a section's `kind` or `componentType`. That is the
// enforcement, not a UI convention: what a core section *is* stays out of
// reach, so its typed rows stay machine-readable.

export const addSectionSchema = resumeIdSchema.extend({
  label: z.string().min(1).max(60),
  componentType: z.enum(sectionComponentTypes)
})
export type AddSectionInput = z.infer<typeof addSectionSchema>

export const removeSectionSchema = resumeIdSchema.extend({ sectionId: rowId })
export type RemoveSectionInput = z.infer<typeof removeSectionSchema>

/**
 * `content` is deliberately unshaped here: which payload is legal depends on
 * the section's own `componentType`, which the server reads rather than takes.
 * The service validates it there, where the discriminator is known.
 */
export const setSectionContentSchema = resumeIdSchema.extend({
  sectionId: rowId,
  content: z.unknown()
})
export type SetSectionContentInput = z.infer<typeof setSectionContentSchema>

/**
 * Reordering takes the whole list rather than one moved id: positions are then
 * rewritten from it wholesale, so they cannot drift into duplicates or gaps.
 */
export const reorderSectionsSchema = resumeIdSchema.extend({
  sectionIds: z.array(rowId).min(1).max(30)
})
export type ReorderSectionsInput = z.infer<typeof reorderSectionsSchema>
