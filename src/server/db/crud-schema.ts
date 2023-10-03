import { createInsertSchema } from "drizzle-zod"
import { profile, school, user, work } from "./schema"
import { z } from "zod"

export const insertProfileSchema = createInsertSchema(profile, {
  id: (schema) => schema.id.optional(),
  firstName: (schema) =>
    schema.firstName
      .min(3, "Must be atleast 3 characters")
      .max(50, "Must be less than 50 characters"),
  lastName: (schema) =>
    schema.lastName
      .min(3, "Must be atleast 3 characters")
      .max(50, "Must be less than 50 characters"),
  profession: (schema) =>
    schema.profession
      .min(3, "Must be atleast 3 characters")
      .max(255, "Must be less than 255 characters"),
  introduction: (schema) =>
    schema.introduction
      .min(3, "Must be atleast 3 characters")
      .max(255, "Must be less than 255 characters"),
  interests: (schema) =>
    schema.interests
      .min(3, "Must be atleast 3 characters")
      .max(255, "Must be less than 255 characters"),
  skills: (schema) => schema.skills.optional()
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
  skills: z.object({ value: z.string().min(3) }).array()
})

export type InsertSkillsSchema = z.infer<typeof insertSkillsSchema>
