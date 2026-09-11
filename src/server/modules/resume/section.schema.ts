import { z } from "zod"
import { sectionComponentTypes } from "~/lib/section-content"
import { rowId } from "./resume.schema"

// API contracts for a section, whether a resume owns it or the account does.
//
// There is no input for a section's `kind` or `componentType`. That is the
// enforcement, not a UI convention: what a core section *is* stays out of
// reach, so its typed rows stay machine-readable.

/**
 * Whose sections the input is about: the resume it names, or the account it
 * says so about.
 *
 * The account is claimed rather than named. There is no id for it because the
 * only account a caller may edit is the session's, which comes from the cookie
 * — but the claim is still spelled out, and the service refuses an input that
 * makes both or neither. An owner inferred from a *missing* `resumeId` would
 * mean a client that lost one while its resume loaded writing to the master
 * copy every resume is drawn from, silently and successfully.
 */
export const sectionOwnerSchema = z.object({
  resumeId: z.string().cuid2().optional(),
  onAccount: z.literal(true).optional()
})
export type SectionOwnerInput = z.infer<typeof sectionOwnerSchema>

/**
 * `label` is what the picker displayed; `presetId` is which catalog entry it
 * came from. Both, because they answer different questions: the id lets the
 * server write the heading in the *resume's* language rather than the
 * interface's, and the label is what a preset the message files don't know
 * falls back to. The catalog itself stays on the client — see
 * `~/lib/section-catalog`.
 */
export const addSectionSchema = sectionOwnerSchema.extend({
  label: z.string().min(1).max(60),
  presetId: z.string().min(1).max(40).optional(),
  componentType: z.enum(sectionComponentTypes)
})
export type AddSectionInput = z.infer<typeof addSectionSchema>

export const removeSectionSchema = sectionOwnerSchema.extend({
  sectionId: rowId
})
export type RemoveSectionInput = z.infer<typeof removeSectionSchema>

/**
 * `content` is deliberately unshaped here: which payload is legal depends on
 * the section's own `componentType`, which the server reads rather than takes.
 * The service validates it there, where the discriminator is known.
 */
export const setSectionContentSchema = sectionOwnerSchema.extend({
  sectionId: rowId,
  content: z.unknown()
})
export type SetSectionContentInput = z.infer<typeof setSectionContentSchema>

/**
 * Reordering takes the whole list rather than one moved id: positions are then
 * rewritten from it wholesale, so they cannot drift into duplicates or gaps.
 */
export const reorderSectionsSchema = sectionOwnerSchema.extend({
  sectionIds: z.array(rowId).min(1).max(30)
})
export type ReorderSectionsInput = z.infer<typeof reorderSectionsSchema>

/**
 * Renaming, for the sections a resume's field-path grammar cannot address.
 *
 * A resume renames through `resume.updateField` with a `section.<id>.label`
 * path, like every other editable string on the document; the account has no
 * document and no such grammar, so it says which section and what to call it.
 * Both land in the same `writeLabel`.
 */
export const renameSectionSchema = sectionOwnerSchema.extend({
  sectionId: rowId,
  label: z.string().min(1).max(60)
})
export type RenameSectionInput = z.infer<typeof renameSectionSchema>
