import { createInsertSchema } from "drizzle-zod"
import { invalid } from "~/lib/validation-message"
import { school, user, work } from "./schema"
import { z } from "zod"

const contactSchema = z.object({
  phone: z.string().optional(),
  linkedIn: z.string().optional(),
  portfolio: z.string().optional(),
  location: z.string().min(3, invalid("minChars", { count: 3 }))
})

export const insertContactSchema = z
  .object({
    firstName: z
      .string()
      .min(1, invalid("minChars", { count: 1 }))
      .max(50, invalid("maxChars", { count: 50 })),
    lastName: z
      .string()
      .min(1, invalid("minChars", { count: 1 }))
      .max(50, invalid("maxChars", { count: 50 })),

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
      .min(3, invalid("minChars", { count: 3 }))
      .max(255, invalid("maxChars", { count: 255 }))
}).pick({
  firstName: true,
  lastName: true,
  profession: true
})

export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>

/**
 * The longest an entry's body may be.
 *
 * One cap on the whole body rather than a count and a per-bullet length: the
 * body is one markdown string now, and how the user divides it between prose
 * and list items is theirs to decide. It bounds the field; it does not
 * prescribe a shape.
 */
export const maxBodyLength = 2_000

/** An entry's body: the constrained markdown subset, as one bounded field. */
const bodySchema = z
  .string()
  .max(maxBodyLength, invalid("maxChars", { count: maxBodyLength }))

/**
 * The same field where a step insists on one.
 *
 * A job with nothing under it is a job the resume says nothing about, and
 * onboarding is what asks for it — where the editor's own write allows an empty
 * body, for a row the user has just added.
 */
const requiredBodySchema = bodySchema
  .trim()
  .min(6, invalid("minChars", { count: 6 }))

export const insertEducationSchema = z.object({
  education: createInsertSchema(school, {
    id: (schema) => schema.id.optional(),
    degree: (schema) =>
      schema.degree
        .min(3, invalid("minChars", { count: 3 }))
        .max(255, invalid("maxChars", { count: 255 })),
    name: (schema) =>
      schema.name
        .min(3, invalid("minChars", { count: 3 }))
        .max(255, invalid("maxChars", { count: 255 })),
    body: () => bodySchema,
    location: (schema) =>
      schema.location.max(255, invalid("maxChars", { count: 255 })).optional(),
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

export const insertExperienceSchema = z.object({
  experience: createInsertSchema(work, {
    id: (schema) => schema.id.optional(),
    name: (schema) =>
      schema.name
        .min(3, invalid("minChars", { count: 3 }))
        .max(255, invalid("maxChars", { count: 255 })),
    endDate: (schema) =>
      schema.endDate.min(3, invalid("minChars", { count: 3 })).max(50),
    startDate: (schema) =>
      schema.startDate.min(3, invalid("minChars", { count: 3 })).max(50),
    title: (schema) =>
      schema.title
        .min(3, invalid("minChars", { count: 3 }))
        .max(255, invalid("maxChars", { count: 255 }))
  })
    .omit({ userId: true, resumeId: true })
    /*
      Required, where the column has a default and so is optional everywhere
      else: a job with nothing under it is a job the resume says nothing about,
      and this is the step that asks for it. The editor's own write allows an
      empty body, for a row the user has just added.
    */
    .extend({ body: requiredBodySchema })
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
      .min(3, invalid("minChars", { count: 3 }))
      .max(255, invalid("maxChars", { count: 255 })),
    /** The posting this was drafted against, kept on the resume. */
    jobDescription: z.string().max(20_000),
    contact: resumeContactSchema
  })
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
    sections: downloadPdfSectionSchema.array().optional(),
    /**
     * How the document looks, sent with it for the same reason the sections
     * are: the print has to be the document the user was looking at. Loose
     * strings — the renderer narrows a style it does not recognise to the
     * default and ignores an accent that is not a hex colour.
     */
    style: z.string().max(32).optional(),
    accent: z.string().max(32).optional(),
    /**
     * The document's own language, which names the file it downloads as.
     * Optional and loose for the same reason the style is: the route falls back
     * to English for anything it does not recognise.
     */
    language: z.string().max(8).optional()
  })

export type DownloadPdfSchema = z.infer<typeof downloadPdfSchema>
