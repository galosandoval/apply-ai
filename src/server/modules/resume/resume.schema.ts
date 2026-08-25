import { z } from "zod"
import { resumeStyles } from "~/lib/resume-style"
import { insertResumeSchema } from "~/server/db/crud-schema"

// API contracts for the resume module.
//
// No input carries an owner id: a resume belongs to the session's user, and
// every procedure asserts that before it reads or writes anything.

/**
 * Row ids are cuid2 for anything the app minted, but the section backfill wrote
 * digest ids, so a row id is validated as an opaque string rather than by
 * shape. What matters is that the row belongs to the resume, which is a
 * `WHERE`, not a regex.
 */
export const rowId = z.string().min(1).max(64)

export const resumeIdSchema = z.object({ resumeId: z.string().cuid2() })

export const createResumeSchema = insertResumeSchema
export type CreateResumeInput = z.infer<typeof createResumeSchema>

/**
 * Everything a generation takes.
 *
 * The history it is written from is read off the account on the server, so
 * there is nothing else here: a caller that could supply its own experience
 * could put anything on the resume it claims came from the model.
 */
export const generateResumeSchema = z.object({
  jobDescription: z
    .string()
    .min(1, "Paste the job posting first")
    .max(20_000, "That posting is too long")
})
export type GenerateInput = z.infer<typeof generateResumeSchema>

export const readResumeSchema = resumeIdSchema

export const refreshFromAccountSchema = resumeIdSchema

export const updateFieldSchema = resumeIdSchema.extend({
  path: z.string().max(200),
  value: z.string().max(10_000)
})
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>

/**
 * The sections addressed a row at a time. Named here rather than inlined into
 * each schema so the reorder, the add and the remove cannot disagree about
 * which lists a row can belong to.
 */
export const rowSectionSchema = z.enum(["experience", "education", "skills"])
export type RowSectionName = z.infer<typeof rowSectionSchema>

export const reorderRowsSchema = resumeIdSchema.extend({
  section: rowSectionSchema,
  rowIds: z.array(rowId).min(1).max(30)
})
export type ReorderRowsInput = z.infer<typeof reorderRowsSchema>

export const addRowSchema = resumeIdSchema.extend({
  section: rowSectionSchema
})
export type AddRowInput = z.infer<typeof addRowSchema>

export const removeRowSchema = resumeIdSchema.extend({
  section: rowSectionSchema,
  rowId
})
export type RemoveRowInput = z.infer<typeof removeRowSchema>

/**
 * A job's whole bullet list.
 *
 * `updateField` replaces one bullet that already exists; this is how the set of
 * them changes — added, removed, reordered — for the same reason
 * `section.setContent` exists beside a per-string write. Taking the whole array
 * also means a reorder cannot leave an index pointing at a different bullet.
 *
 * The caps are deliberately looser than the onboarding form's two-to-eight
 * accomplishments: this is the write a user makes while editing, and a resume
 * mid-edit is allowed to have no bullets on a job they are about to fill in.
 * They exist to bound the payload, not to enforce a shape.
 */
export const setBulletsSchema = resumeIdSchema.extend({
  rowId,
  bullets: z.array(z.string().max(1_000)).max(20)
})
export type SetBulletsInput = z.infer<typeof setBulletsSchema>

/**
 * Choosing a typographic direction.
 *
 * The accent is not in the input: each style fixes its own, and the server is
 * what writes it onto the resume. A caller that could supply one would be a
 * colour picker, which is exactly what the spec put out of scope.
 */
export const setStyleSchema = resumeIdSchema.extend({
  style: z.enum(resumeStyles)
})
export type SetStyleInput = z.infer<typeof setStyleSchema>

export const removeResumeSchema = resumeIdSchema
