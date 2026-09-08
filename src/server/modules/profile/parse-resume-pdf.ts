import { PDFParse } from "pdf-parse"
import { z } from "zod"
import { withNormalizedDates } from "~/lib/resume-date"
import { maxSkills } from "~/server/db/crud-schema"

/** The dates and the flag as a resume may have written them. */
const parsedDates = {
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  current: z.boolean().default(false)
}

/**
 * Shape the model is asked to return. Every field is lenient on purpose — a
 * resume PDF is messy, and a missing GPA should not throw away the whole parse.
 * The onboarding forms re-validate against the strict insert schemas when the
 * user reviews and submits each step.
 *
 * The dates are the one exception, and are lenient for the same reason rather
 * than a different one: they are read into the stored subset by
 * `normalizeEntryDates` after the parse, not refused during it. A resume that
 * writes `Sept 2017` is a resume, not a bad payload.
 */
export const parsedResumeSchema = z.object({
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  profession: z.string().default(""),
  location: z.string().default(""),
  phone: z.string().default(""),
  linkedIn: z.string().default(""),
  portfolio: z.string().default(""),
  experience: z
    .object({
      name: z.string().default(""),
      title: z.string().default(""),
      location: z.string().default(""),
      body: z.string().default(""),
      ...parsedDates
    })
    .transform(withNormalizedDates)
    .array()
    .default([]),
  education: z
    .object({
      name: z.string().default(""),
      degree: z.string().default(""),
      location: z.string().default(""),
      gpa: z.string().default(""),
      body: z.string().default(""),
      ...parsedDates
    })
    .transform(withNormalizedDates)
    .array()
    .default([]),
  skills: z
    .object({
      category: z.string().default(""),
      all: z.string().array().default([])
    })
    .array()
    .default([])
})

export type ParsedResume = z.infer<typeof parsedResumeSchema>

const maxExperience = 5
const maxEducation = 4

/**
 * How many bullets one job's body may be asked for.
 *
 * A cap on the extraction rather than on the column: the body is one markdown
 * string and the user may write it however they like, but a model handed a
 * dense resume will otherwise return a page of them.
 */
const maxBodyBullets = 8

/** Guards against pathological PDFs blowing up the prompt. */
const maxTextLength = 20_000

/**
 * Extract the text layer of a resume PDF.
 *
 * @throws If the PDF has no extractable text (e.g. a scanned image).
 */
export async function extractPdfText(file: Buffer) {
  const parser = new PDFParse({ data: file })

  try {
    const { text } = await parser.getText()
    const trimmed = text.trim()

    if (trimmed.length < 50) {
      throw new Error(
        "Could not read any text from that PDF. If it is a scan or an image, try exporting a text-based PDF instead."
      )
    }

    return trimmed.slice(0, maxTextLength)
  } finally {
    await parser.destroy()
  }
}

/**
 * Turn raw resume text into the structured fields the onboarding steps expect.
 *
 * @throws If OpenAI fails or returns something that isn't the expected shape.
 */
export async function extractResumeFields(text: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: extractionPrompt },
        { role: "user", content: text }
      ]
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`)
  }

  const completion = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }

  const content = completion.choices?.[0]?.message?.content

  if (!content) {
    throw new Error("OpenAI returned an empty response")
  }

  const parsed = parsedResumeSchema.parse(JSON.parse(content))

  return {
    ...parsed,
    experience: parsed.experience.slice(0, maxExperience),
    education: parsed.education.slice(0, maxEducation),
    skills: parsed.skills.slice(0, maxSkills)
  }
}

/**
 * Reading a document, not authoring one.
 *
 * Deliberately language-neutral: every value it returns is the resume's own
 * text, so it is copied across in whatever language and whatever conventions
 * the document already uses. Worked examples of English skill headings would
 * have made the extraction quietly translate a Spanish resume on its way into
 * the onboarding forms.
 *
 * The dates are the exception, and are not an exception to that rule: the
 * example payload shows them in the stored ISO subset, which belongs to no
 * language. What the resume wrote them as is read back by
 * `normalizeEntryDates` rather than copied across.
 */
const extractionPrompt = `You extract structured data from a resume. The user message is the raw text of a resume PDF, so the layout may be jumbled.

Rules:
- Only use information present in the resume. Never invent employers, schools, dates, or numbers. Use an empty string for anything missing.
- Copy every value in the resume's own language and wording. Never translate, expand, or reformat what it says.
- Write every date as "YYYY", "YYYY-MM" or "YYYY-MM-DD", at whatever precision the resume gives — never add a month it does not state. Where the resume says a role or a course of study is still going, set "current" to true and leave "endDate" empty rather than copying its word for it.
- "profession" is the person's current job title or the headline at the top of the resume.
- For each job, "body" is what the resume writes under it, as markdown: one "- " line per accomplishment, at most ${maxBodyBullets}, and a plain line for anything written as prose. Keep the person's own wording and metrics.
- For each school, "body" is whatever the resume writes under it, in the same markdown form. Empty when it writes nothing.
- Group skills into at most ${maxSkills} categories, using the resume's own headings for them. If it lists skills without categories, put them all under one category named the way the resume names that part of the page.
- Return at most ${maxExperience} jobs and ${maxEducation} schools, most recent first.

Respond with RFC8259 compliant JSON only, no explanations, in exactly this format:
{
  "firstName": "", "lastName": "", "profession": "", "location": "", "phone": "",
  "linkedIn": "", "portfolio": "",
  "experience": [{ "name": "", "title": "", "startDate": "2017-09", "endDate": "2021-05", "current": false, "location": "", "body": "" }],
  "education": [{ "name": "", "degree": "", "startDate": "2013-09", "endDate": "", "current": true, "location": "", "gpa": "", "body": "" }],
  "skills": [{ "category": "", "all": [""] }]
}`
