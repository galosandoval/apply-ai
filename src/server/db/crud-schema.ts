import { createInsertSchema } from "drizzle-zod"
import { profile, school, work } from "./schema"
import { z } from "zod"

export const insertProfileSchema = createInsertSchema(profile, {
  id: (schema) => schema.id.optional(),
  skills: (schema) => z.object({ value: schema.skills.min(3) }).array()
})

export const insertSchoolSchema = createInsertSchema(school, {
  id: (schema) => schema.id.optional(),
  resumeId: (schema) => schema.resumeId.optional()
})

export const insertJobSchema = createInsertSchema(work, {
  id: (schema) => schema.id.optional(),
  resumeId: (schema) => schema.resumeId.optional()
})

export const onboardingSchema = insertProfileSchema
  .merge(z.object({ education: insertSchoolSchema.array() }))
  .merge(z.object({ workExperience: insertJobSchema.array() }))

export type OnboardingFormValues = z.infer<typeof onboardingSchema>
