import { z } from "zod"
import {
  insertContactSchema,
  insertEducationSchema,
  insertExperienceSchema,
  updateProfileSchema
} from "~/server/db/crud-schema"

/**
 * API contracts for the profile module.
 *
 * The field-level shapes still live in `~/server/db/crud-schema` because the
 * onboarding forms share them. This file is the seam: routers reference these
 * names, so the shared schemas can be split apart later without touching the
 * transport layer.
 *
 * No input carries an owner id. The rows belong to the session's user, and the
 * session is the only place that id can come from.
 */

export const upsertNameAndContactSchema = insertContactSchema
export type UpsertNameAndContactInput = z.infer<
  typeof upsertNameAndContactSchema
>

export const updateDetailsSchema = updateProfileSchema
export type UpdateDetailsInput = z.infer<typeof updateDetailsSchema>

export const addEducationSchema = insertEducationSchema
export type AddEducationInput = z.infer<typeof addEducationSchema>

export const addExperienceSchema = insertExperienceSchema
export type AddExperienceInput = z.infer<typeof addExperienceSchema>

/**
 * Base64 inflates by ~4/3, so the 8MB file the upload page accepts arrives as
 * roughly 10.7M characters. Keep this above that or the client's own check
 * passes and the server rejects the request anyway.
 */
const maxPdfBase64Length = 11_000_000

export const importFromPdfSchema = z.object({
  fileBase64: z.string().min(1).max(maxPdfBase64Length, "That PDF is too large")
})
export type ImportFromPdfInput = z.infer<typeof importFromPdfSchema>

export const replaceSkillsSchema = z.object({
  skills: z
    .object({
      id: z.string().optional(),
      category: z.string().min(3),
      all: z.string().array(),
      position: z.number()
    })
    .array()
})
export type ReplaceSkillsInput = z.infer<typeof replaceSkillsSchema>
