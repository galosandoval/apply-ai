import { createInsertSchema } from "drizzle-zod"
import { resume, school, user, work } from "./schema"
import { z } from "zod"

const contactSchema = z.object({
  phone: z.string().optional(),
  linkedIn: z.string().optional(),
  portfolio: z.string().optional(),
  location: z.string().min(3, "Must be at least 3 characters")
})

export const insertContactSchema = z
  .object({
    firstName: z
      .string()
      .min(1, "Must be at least 1 characters")
      .max(50, "Must be less than 50 characters"),
    lastName: z
      .string()
      .min(1, "Must be at least 1 characters")
      .max(50, "Must be less than 50 characters"),

    profession: z.string().min(3).max(255),
    interests: z.string().min(3).max(255).optional()
  })
  .merge(contactSchema)

export type InsertContactSchema = z.infer<typeof insertContactSchema>

/**
 * The profile-shaped columns of `user`.
 *
 * `user` also carries the account columns better-auth owns (`email`,
 * `emailVerified`, timestamps); picking keeps them out of a profile form's
 * input, where they would be both required and unwritable.
 */
export const updateProfileSchema = createInsertSchema(user, {
  profession: (schema) =>
    schema.profession
      .min(3, "Must be at least 3 characters")
      .max(255, "Must be less than 255 characters"),
  interests: (schema) =>
    schema.interests
      .min(3, "Must be at least 3 characters")
      .max(255, "Must be less than 255 characters")
      .optional()
      .nullable()
}).pick({
  firstName: true,
  lastName: true,
  profession: true,
  introduction: true,
  interests: true
})

export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>

export const insertEducationSchema = z.object({
  education: createInsertSchema(school, {
    id: (schema) => schema.id.optional(),
    degree: (schema) =>
      schema.degree
        .min(3, "Must be at least 3 characters")
        .max(255, "Must be less than 255 characters"),
    name: (schema) =>
      schema.name
        .min(3, "Must be at least 3 characters")
        .max(255, "Must be less than 255 characters"),
    description: (schema) =>
      schema.description
        .max(500, "Must be less than 500 characters")
        .optional(),
    location: (schema) =>
      schema.location.max(255, "Must be less than 255 characters").optional(),
    startDate: (schema) => schema.startDate.min(4).max(50),
    endDate: (schema) => schema.endDate.min(4).max(50),
    gpa: (schema) => schema.gpa.optional()
  })
    // The owner and the resume a row is snapshotted onto are the server's to
    // decide — a client that could name them could write onto someone else's.
    .omit({ userId: true, resumeId: true })
    .array()
    .min(1)
    .max(4)
})

export type InsertEducationSchema = z.infer<typeof insertEducationSchema>

export const minBullets = 2
export const maxBullets = 8

const maxBulletLength = 300

/**
 * One accomplishment per entry, so the length cap is per bullet rather than per
 * job — a single runaway sentence is what breaks the layout, not the count.
 *
 * The checks live in a `superRefine` without a `path` so every message lands on
 * the array itself. Onboarding edits bullets as one line-separated textarea and
 * renders a single `FormMessage` for it; an issue reported on `bullets.2` would
 * block submit with nothing on screen to explain why. Blank lines are ignored
 * here for the same reason — the user is mid-typing, not writing an empty
 * bullet, and they're stripped before the array is saved.
 */
const bulletsSchema = z
  .string()
  .array()
  .superRefine((bullets, ctx) => {
    const filled = bullets.filter((bullet) => bullet.trim())

    const issue =
      filled.length < minBullets
        ? `Write at least ${minBullets} accomplishments`
        : filled.length > maxBullets
          ? `Write at most ${maxBullets} accomplishments`
          : filled.some((bullet) => bullet.trim().length < 6)
            ? "Each accomplishment must be more than 6 characters"
            : filled.some((bullet) => bullet.length > maxBulletLength)
              ? `Each accomplishment must be less than ${maxBulletLength} characters`
              : null

    if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue })
  })

export const insertExperienceSchema = z.object({
  experience: createInsertSchema(work, {
    id: (schema) => schema.id.optional(),
    name: (schema) =>
      schema.name
        .min(3, "Must be at least 3 characters")
        .max(255, "Must be less than 255 characters"),
    bullets: bulletsSchema,
    endDate: (schema) =>
      schema.endDate.min(3, "Must be at least 3 characters").max(50),
    startDate: (schema) =>
      schema.startDate.min(3, "Must be at least 3 characters").max(50),
    title: (schema) =>
      schema.title
        .min(3, "Must be at least 3 characters")
        .max(255, "Must be less than 255 characters")
  })
    .omit({ userId: true, resumeId: true })
    .array()
    .min(1)
    .max(5)
})

export type InsertExperienceSchema = z.infer<typeof insertExperienceSchema>

export const maxSkills = 4

export const insertSkillsSchema = z.object({
  skills: z
    .object({
      id: z.string().optional(),
      category: z.string().min(3),
      all: z.string(),
      position: z.number()
    })
    .array()
    .min(1)
    .max(maxSkills)
})

export type InsertSkillsSchema = z.infer<typeof insertSkillsSchema>

export const insertResumeSchema = createInsertSchema(resume, {
  id: (schema) => schema.id.optional(),
  profession: (schema) =>
    schema.profession
      .min(3, "Must be at least 3 characters")
      .max(255, "Must be less than 255 characters"),
})
  .omit({ userId: true })
  .merge(
    z.object({
      phone: z.string(),
      linkedIn: z.string(),
      portfolio: z.string(),
      location: z.string().min(3, "Must be at least 3 characters")
    })
  )
  .merge(insertEducationSchema)
  .merge(insertExperienceSchema)
  .merge(insertSkillsSchema)
  .merge(z.object({ email: z.string().email() }))

export type InsertResumeSchema = z.infer<typeof insertResumeSchema>

export const downloadPdfSchema = z
  .object({
    fullName: z.string(),
    email: z.string().email(),
    profession: z.string()
  })
  .merge(contactSchema)
  .merge(
    updateProfileSchema.pick({
      interests: true
    })
  )
  .merge(insertEducationSchema)
  .merge(insertExperienceSchema)
  .merge(insertSkillsSchema)

export type DownloadPdfSchema = z.infer<typeof downloadPdfSchema>
