import { PDFParse } from "pdf-parse"
import { z } from "zod"
import { maxBullets, maxSkills } from "~/server/db/crud-schema"

/**
 * Shape the model is asked to return. Every field is lenient on purpose — a
 * resume PDF is messy, and a missing GPA should not throw away the whole parse.
 * The onboarding forms re-validate against the strict insert schemas when the
 * user reviews and submits each step.
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
      startDate: z.string().default(""),
      endDate: z.string().default(""),
      location: z.string().default(""),
      bullets: z.string().array().default([])
    })
    .array()
    .default([]),
  education: z
    .object({
      name: z.string().default(""),
      degree: z.string().default(""),
      startDate: z.string().default(""),
      endDate: z.string().default(""),
      location: z.string().default(""),
      gpa: z.string().default(""),
      description: z.string().default("")
    })
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

const extractionPrompt = `You extract structured data from a resume. The user message is the raw text of a resume PDF, so the layout may be jumbled.

Rules:
- Only use information present in the resume. Never invent employers, schools, dates, or numbers. Use an empty string for anything missing.
- Dates are free text, formatted like "Sept 2017". Use "Present" for a current role.
- "profession" is the person's current job title or the headline at the top of the resume.
- For each job, "bullets" is the list of accomplishment bullet points, one string per bullet, at most ${maxBullets}. Keep the person's own wording and metrics. If the job is written as a paragraph, split it into one bullet per sentence.
- Group skills into at most ${maxSkills} categories (for example "Languages", "Frameworks"). If the resume lists skills without categories, put them all under a single "Skills" category.
- Return at most ${maxExperience} jobs and ${maxEducation} schools, most recent first.

Respond with RFC8259 compliant JSON only, no explanations, in exactly this format:
{
  "firstName": "", "lastName": "", "profession": "", "location": "", "phone": "",
  "linkedIn": "", "portfolio": "",
  "experience": [{ "name": "", "title": "", "startDate": "", "endDate": "", "location": "", "bullets": [""] }],
  "education": [{ "name": "", "degree": "", "startDate": "", "endDate": "", "location": "", "gpa": "", "description": "" }],
  "skills": [{ "category": "", "all": [""] }]
}`
