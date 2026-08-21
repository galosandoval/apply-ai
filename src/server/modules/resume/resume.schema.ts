import { z } from "zod"
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

export const readResumeSchema = resumeIdSchema

export const refreshFromAccountSchema = resumeIdSchema

export const updateFieldSchema = resumeIdSchema.extend({
  path: z.string().max(200),
  value: z.string().max(10_000)
})
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>

export const reorderRowsSchema = resumeIdSchema.extend({
  section: z.enum(["experience", "education", "skills"]),
  rowIds: z.array(rowId).min(1).max(30)
})
export type ReorderRowsInput = z.infer<typeof reorderRowsSchema>
