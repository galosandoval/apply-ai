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
 */

export const readProfileSchema = z.object({
  userId: z.string().cuid2()
})
export type ReadProfileInput = z.infer<typeof readProfileSchema>

export const upsertNameAndContactSchema = insertContactSchema
export type UpsertNameAndContactInput = z.infer<
  typeof upsertNameAndContactSchema
>

export const updateDetailsSchema = updateProfileSchema
export type UpdateDetailsInput = z.infer<typeof updateDetailsSchema>

export const addEducationSchema = insertEducationSchema.merge(
  z.object({ profileId: z.string().cuid2().optional() })
)
export type AddEducationInput = z.infer<typeof addEducationSchema>

export const addExperienceSchema = insertExperienceSchema.merge(
  z.object({ profileId: z.string().cuid2().optional() })
)
export type AddExperienceInput = z.infer<typeof addExperienceSchema>

/** ~6MB of base64, which is roughly a 4.5MB PDF — far above any real resume. */
const maxPdfBase64Length = 6_000_000

export const importFromPdfSchema = z.object({
  fileBase64: z.string().min(1).max(maxPdfBase64Length, "That PDF is too large")
})
export type ImportFromPdfInput = z.infer<typeof importFromPdfSchema>

export const replaceSkillsSchema = z.object({
  skills: z
    .object({
      category: z.string().min(3),
      all: z.string().array(),
      position: z.number()
    })
    .array(),
  profileId: z.string().cuid2()
})
export type ReplaceSkillsInput = z.infer<typeof replaceSkillsSchema>
