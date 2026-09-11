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

/** Whether the input claims exactly one owner, which is the only legal input. */
export function claimsOneOwner(input: SectionOwnerInput) {
  const claimsResume = input.resumeId !== undefined
  const claimsAccount = input.onAccount === true

  return claimsResume !== claimsAccount
}

export const oneOwnerMessage =
  "A section belongs to a resume or to the account, not both"

/**
 * A section input, with "exactly one owner" enforced by the contract rather
 * than by every consumer remembering to ask.
 *
 * The rule lives on the schema so the shape *cannot* express both-or-neither.
 * The service checks it again on the way through — it is reachable from
 * `resume.updateField` as well, which never passes this schema — but no router
 * input can now reach it having skipped the question.
 */
function ownedSectionInput<Shape extends z.ZodRawShape>(shape: Shape) {
  return sectionOwnerSchema.extend(shape).refine(claimsOneOwner, {
    message: oneOwnerMessage
  })
}

/**
 * `label` is what the picker displayed; `presetId` is which catalog entry it
 * came from. Both, because they answer different questions: the id lets the
 * server write the heading in the *resume's* language rather than the
 * interface's, and the label is what a preset the message files don't know
 * falls back to. The catalog itself stays on the client — see
 * `~/lib/section-catalog`.
 */
export const addSectionSchema = ownedSectionInput({
  label: z.string().min(1).max(60),
  presetId: z.string().min(1).max(40).optional(),
  componentType: z.enum(sectionComponentTypes)
})
export type AddSectionInput = z.infer<typeof addSectionSchema>

export const removeSectionSchema = ownedSectionInput({
  sectionId: rowId
})
export type RemoveSectionInput = z.infer<typeof removeSectionSchema>

/**
 * `content` is deliberately unshaped here: which payload is legal depends on
 * the section's own `componentType`, which the server reads rather than takes.
 * The service validates it there, where the discriminator is known.
 */
export const setSectionContentSchema = ownedSectionInput({
  sectionId: rowId,
  content: z.unknown()
})
export type SetSectionContentInput = z.infer<typeof setSectionContentSchema>

/**
 * Reordering takes the whole list rather than one moved id: positions are then
 * rewritten from it wholesale, so they cannot drift into duplicates or gaps.
 */
export const reorderSectionsSchema = ownedSectionInput({
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
 *
 * The account is the only owner this takes, and `onAccount` is required rather
 * than assumed. A resume that could rename here too would be a second way to
 * write the same string, reached by a different assertion — one path per thing
 * is what keeps the two from disagreeing.
 */
export const renameSectionSchema = z.object({
  onAccount: z.literal(true),
  sectionId: rowId,
  label: z.string().min(1).max(60)
})
export type RenameSectionInput = z.infer<typeof renameSectionSchema>
