import { createInsertSchema } from "drizzle-zod"
import { resumeDatePattern } from "~/lib/resume-date"
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
 *
 * The number is the budget the old shape allowed — 8 bullets of 300 — because
 * a body migrated from bullets that no longer fits is a resume the user cannot
 * save without cutting words this change never asked them to cut.
 */
export const maxBodyLength = 2_400

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

/**
 * A date on an entry: one of `YYYY`, `YYYY-MM` or `YYYY-MM-DD`.
 *
 * This replaced a `min(3).max(50)` on a `text` column, which is how `Present`,
 * `2020-2022`, `current` and `now` all got into production data. Nothing can be
 * sorted, counted or gap-checked against a column that legally holds any of
 * those — see #71, and `~/lib/resume-date` for the shape itself.
 */
const entryDateSchema = z
  .string()
  .regex(resumeDatePattern, invalid("dateFormat"))

/**
 * The end date, which is a date or nothing at all.
 *
 * Present but empty rather than absent: `endDate` is a field on a form the user
 * ticks a box next to, and a field that disappears from the payload is a field
 * react-hook-form has nothing to register. `refineEndDate` is what decides
 * whether empty is allowed here.
 */
const endDateSchema = z.union([z.literal(""), entryDateSchema])

/**
 * The two date fields and the flag, as every entry carries them.
 *
 * Extended onto the insert schemas rather than passed to `createInsertSchema`,
 * because the columns have defaults — which drizzle-zod reads as "optional on
 * insert", and an `endDate` that may be `undefined` is one more empty state for
 * the form, the document and the write to each handle their own way.
 */
const entryDateFields = {
  startDate: entryDateSchema,
  endDate: endDateSchema,
  current: z.boolean().default(false)
}

/**
 * The end date and the flag, checked against each other.
 *
 * Required unless the entry is current, and *forbidden* when it is. The second
 * half is the one that matters: a row carrying both a set `current` and an end
 * date is a row two readers disagree about, and the whole point of splitting
 * the flag out of the column was to make that state unrepresentable.
 */
function refineEndDate(
  entry: { endDate: string; current?: boolean },
  ctx: z.RefinementCtx
) {
  if (entry.current && entry.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: invalid("endDateNotCurrent")
    })

    return
  }

  if (!entry.current && !entry.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: invalid("endDateRequired")
    })
  }
}

/**
 * One school, before the end-date rule is applied to it.
 *
 * Named so the print payload can restate its dates without restating the whole
 * entry — see `downloadPdfSchema`. A refined schema is a `ZodEffects` and has
 * no `.extend`, so the split has to happen here rather than there.
 */
const schoolEntrySchema = createInsertSchema(school, {
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
  gpa: (schema) => schema.gpa.optional()
})
  .extend(entryDateFields)
  // The owner and the resume a row is snapshotted onto are the server's to
  // decide — a client that could name them could write onto someone else's.
  .omit({ userId: true, resumeId: true })

export const insertEducationSchema = z.object({
  education: schoolEntrySchema
    .superRefine(refineEndDate)
    .array()
    // No minimum: a user with no degree has an empty education history, and
    // being unable to get past the step is not the same as having one.
    .max(4)
})

export type InsertEducationSchema = z.infer<typeof insertEducationSchema>

/** One job, before the end-date rule — see `schoolEntrySchema`. */
const workEntrySchema = createInsertSchema(work, {
  id: (schema) => schema.id.optional(),
  name: (schema) =>
    schema.name
      .min(3, invalid("minChars", { count: 3 }))
      .max(255, invalid("maxChars", { count: 255 })),
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
  .extend({ body: requiredBodySchema, ...entryDateFields })

export const insertExperienceSchema = z.object({
  experience: workEntrySchema.superRefine(refineEndDate).array().min(1).max(5)
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
 * The dates as a **print** takes them: whatever the document is drawing.
 *
 * Printing is not writing. The #71 migration deliberately left a date it could
 * not read on the resume rather than blanking it, and the renderer prints an
 * unrecognised value verbatim — so holding the download to the write schema's
 * date rules would mean a resume that renders on screen and 400s on the way to
 * a PDF, with the user punished for a value the app itself chose to keep.
 */
const printedEntryDates = {
  startDate: z.string().max(50),
  endDate: z.string().max(50),
  current: z.boolean().default(false)
}

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
    experience: workEntrySchema.extend(printedEntryDates).array().min(1).max(5),
    education: schoolEntrySchema.extend(printedEntryDates).array().max(4),
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
