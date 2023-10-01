import { createInsertSchema } from "drizzle-zod"
import { profile, school, work } from "./schema"
import { z } from "zod"

export const insertProfileSchema = createInsertSchema(profile, {
  id: (schema) => schema.id.optional()
})

export type InsertProfileSchema = z.infer<typeof insertProfileSchema>

export const insertEducationSchema = z.object({
  education: createInsertSchema(school, {
    id: (schema) => schema.id.optional(),
    resumeId: (schema) => schema.resumeId.optional()
  }).array()
})

export type InsertEducationSchema = z.infer<typeof insertEducationSchema>

export const insertExperienceSchema = z.object({
  experience: createInsertSchema(work, {
    id: (schema) => schema.id.optional(),
    resumeId: (schema) => schema.resumeId.optional()
  }).array()
})

export type InsertExperienceSchema = z.infer<typeof insertExperienceSchema>

export const insertSkillsSchema = z.object({
  skills: z.object({ value: z.string() }).array()
})

export type InsertSkillsSchema = z.infer<typeof insertSkillsSchema>
