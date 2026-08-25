import { createInsertSchema } from "drizzle-zod"
import { school, user, work } from "./schema"
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

    profession: z.string().min(3).max(255)
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
      .max(255, "Must be less than 255 characters")
}).pick({
  firstName: true,
  lastName: true,
  profession: true
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
    // No minimum: a user with no degree has an empty education history, and
    // being unable to get past the step is not the same as having one.
    .max(4)
})

export type InsertEducationSchema = z.infer<typeof insertEducationSchema>

export const MIN_BULLETS = 1
export const MAX_BULLETS = 8

const MAX_BULLET_LENGTH = 300

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
      filled.length < MIN_BULLETS
        ? `Write at least ${MIN_BULLETS} accomplishments`
        : filled.length > MAX_BULLETS
          ? `Write at most ${MAX_BULLETS} accomplishments`
          : filled.some((bullet) => bullet.trim().length < 6)
            ? "Each accomplishment must be more than 6 characters"
            : filled.some((bullet) => bullet.length > MAX_BULLET_LENGTH)
              ? `Each accomplishment must be less than ${MAX_BULLET_LENGTH} characters`
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

/**
 * The contact details a **resume** owns, snapshotted from the account when it
 * was created. Nested under `contact` rather than spread across the top level
 * so every one of them has an address of its own — `contact.email` is editable,
 * where a bare `email` would be indistinguishable from the account's.
 */
export const resumeContactSchema = z.object({
  fullName: z.string(),
  email: z.string().email(),
  location: z.string(),
  phone: z.string().optional(),
  linkedIn: z.string().optional(),
  portfolio: z.string().optional()
})

export type ResumeContactSchema = z.infer<typeof resumeContactSchema>

/**
 * A resume's skill groups. Keyed `skill`, singular, because a path addresses
 * one row of the table — `skill.<row>.category`, the way `contact.<column>` and
 * `experience.<row>.<column>` do.
 */
export const resumeSkillsSchema = z.object({
  skill: z
    .object({
      id: z.string().optional(),
      category: z.string(),
      all: z.string()
    })
    .array()
    .max(maxSkills)
})

export type ResumeSkillsSchema = z.infer<typeof resumeSkillsSchema>

/**
 * A whole resume, shaped exactly as the document renders it.
 *
 * The draft preview drives a form off this schema and addresses its fields with
 * the same paths the template does, so the two cannot disagree about where a
 * value lives.
 */
export const insertResumeSchema = z
  .object({
    profession: z
      .string()
      .min(3, "Must be at least 3 characters")
      .max(255, "Must be less than 255 characters"),
    /** The posting this was drafted against, kept on the resume. */
    jobDescription: z.string().max(20_000),
    contact: resumeContactSchema
  })
  .merge(resumeSkillsSchema)
  .merge(insertEducationSchema)
  .merge(insertExperienceSchema)

export type InsertResumeSchema = z.infer<typeof insertResumeSchema>

/**
 * One section of the document as the PDF route receives it.
 *
 * `content` is unvalidated here on purpose: the renderer re-parses it against
 * the component that has to draw it, so a payload that disagrees with its
 * `componentType` draws nothing rather than being rejected at the door.
 */
const downloadPdfSectionSchema = z.object({
  id: z.string(),
  kind: z.string(),
  label: z.string(),
  componentType: z.string(),
  position: z.number(),
  content: z.unknown().optional()
})

/**
 * The document as the PDF route receives it — the resume without the posting.
 *
 * Sections travel with it so the print is the document the user was looking at:
 * their order, their names and the custom ones among them. Optional, because a
 * draft that has never been saved has none and falls back to the sections a new
 * resume is created with — the same fallback the preview uses.
 */
export const downloadPdfSchema = insertResumeSchema
  .omit({
    jobDescription: true
  })
  .extend({
    sections: downloadPdfSectionSchema.array().optional()
  })

export type DownloadPdfSchema = z.infer<typeof downloadPdfSchema>
