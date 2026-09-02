import { z } from "zod"
import { sectionComponentTypes } from "~/lib/section-content"
import { resumeIdSchema, rowId } from "./resume.schema"

// API contracts for a resume's sections.
//
// There is no input for a section's `kind` or `componentType`. That is the
// enforcement, not a UI convention: what a core section *is* stays out of
// reach, so its typed rows stay machine-readable.

/**
 * `label` is what the picker displayed; `presetId` is which catalog entry it
 * came from. Both, because they answer different questions: the id lets the
 * server write the heading in the *resume's* language rather than the
 * interface's, and the label is what a preset the message files don't know
 * falls back to. The catalog itself stays on the client — see
 * `~/lib/section-catalog`.
 */
export const addSectionSchema = resumeIdSchema.extend({
  label: z.string().min(1).max(60),
  presetId: z.string().min(1).max(40).optional(),
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
