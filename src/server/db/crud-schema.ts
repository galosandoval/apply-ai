import { createInsertSchema } from "drizzle-zod"
import { profile, school, work } from "./schema"
import { z } from "zod"

export const insertNameSchema = z.object({
  firstName: z
    .string()
    .min(3, "Must be atleast 3 characters")
    .max(50, "Must be less than 50 characters"),
  lastName: z
    .string()
    .min(3, "Must be atleast 3 characters")
    .max(50, "Must be less than 50 characters")
})

export type InsertNameSchema = z.infer<typeof insertNameSchema>

export const updateProfileSchema = createInsertSchema(profile, {
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
  skills: (schema) => schema.skills.optional(),
  id: (schema) => schema.id.optional()
})

export type updateProfileSchema = z.infer<typeof updateProfileSchema>

export const insertEducationSchema = z.object({
  education: createInsertSchema(school, {
    id: (schema) => schema.id.optional(),
    degree: (schema) =>
      schema.degree
        .min(3, "Must be atleast 3 characters")
        .max(255, "Must be less than 255 characters"),
    name: (schema) =>
      schema.name
        .min(3, "Must be atleast 3 characters")
        .max(255, "Must be less than 255 characters"),
    description: (schema) =>
      schema.description
        .max(255, "Must be less than 255 characters")
        .optional(),
    location: (schema) =>
      schema.location.max(255, "Must be less than 255 characters").optional(),
    startDate: (schema) => schema.startDate.min(4).max(50),
    endDate: (schema) => schema.endDate.min(4).max(50),
    gpa: (schema) => schema.gpa.optional(),
    profileId: (schema) => schema.profileId.cuid2().optional()
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
