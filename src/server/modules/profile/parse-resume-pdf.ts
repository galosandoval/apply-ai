import { PDFParse } from "pdf-parse"
import { z } from "zod"
import { withNormalizedDates } from "~/lib/resume-date"
import {
  type ImportedSection,
  type ImportedSectionContent
} from "~/lib/section-heading"
import { maxSkills } from "~/server/db/crud-schema"

/** The dates and the flag as a resume may have written them. */
const parsedDates = {
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  current: z.boolean().default(false)
}

/**
 * One section of the document that is not one of the typed four.
 *
 * A heading, where the document put it, and what it wrote underneath — as
 * entries or as prose, whichever the document gave. Deliberately not a
 * component type: the model returns what it read, and `resolveSectionHeading`
 * decides what that draws as, for the same reason the generation allowlist
 * decides rather than the prompt.
 *
 * Lenient like everything else here. A section missing its content is a heading
 * the user can fill in; a section missing its heading is dropped by
 * `orderedSections`, because there is nothing left to recognise it by.
 */
const parsedSectionSchema = z.object({
  heading: z.string().default(""),
  position: z.number().default(0),
  entries: z.string().array().default([]),
  text: z.string().default("")
})

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
  email: z.string().default(""),
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
    .default([]),
  sections: parsedSectionSchema
    .array()
    .default([])
    // The one place a whole branch is caught rather than defaulted per field: a
    // `sections` the model wrote as something other than a list is a reading of
    // the document we lose, and it must not cost the user the jobs and schools
    // in the same payload.
    .catch([])
})

type ParsedResume = z.infer<typeof parsedResumeSchema>

type ParsedSection = z.infer<typeof parsedSectionSchema>

/**
 * What `extractResumeFields` hands back: the parsed document, plus what the
 * caps took off it.
 *
 * The caps were silent until #98. A history longer than its `historyCaps` entry
 * is not a detail — the user reads a confirmation, believes the import is
 * complete, and finds two jobs missing weeks later — so what was dropped
 * travels with what was kept, all the way to the toast.
 */
export type ExtractedResume = ParsedResume & { truncated: Truncation }

/** Which of the capped lists the caps actually bit, keyed as the caps are. */
export type Truncation = Record<keyof typeof historyCaps, boolean>

/**
 * What the document put under a heading, as the resolver reads it.
 *
 * Which of the two readings a section gives is a fact about the document, not a
 * choice about the section: entries when the model found a run of lines, prose
 * when it found a paragraph. The shape it draws as is
 * `resolveSectionHeading`'s to decide.
 */
function importedContent(section: ParsedSection): ImportedSectionContent {
  const entries = section.entries.map((entry) => entry.trim()).filter(Boolean)

  return entries.length
    ? { type: "entries", entries }
    : { type: "prose", text: section.text }
}

/**
 * Every section the extraction found, ready to be written: a heading and what
 * the document put under it, in the order it printed them.
 *
 * One function rather than an ordering and a reading for a caller to compose —
 * how a parsed payload becomes a list of sections is this module's knowledge,
 * and a caller assembling it out of parts is a caller that can assemble it
 * differently from the next one.
 *
 * Sorted by the position the model reported rather than trusted to arrive in
 * order — `sort` is stable, so sections it numbered the same keep the order the
 * array gave them. A section with no heading is dropped rather than written as
 * a blank one: the heading is the only part of it the user can recognise.
 */
export function importedSections(parsed: ParsedResume): ImportedSection[] {
  return parsed.sections
    .map((section, index) => ({
      ...section,
      heading: section.heading.trim(),
      index
    }))
    .filter((section) => section.heading)
    .sort((a, b) => a.position - b.position || a.index - b.index)
    .map((section) => ({
      heading: section.heading,
      content: importedContent(section)
    }))
}

/**
 * How much history one import may keep, per capped list.
 *
 * Applied here rather than asked of the model, so that *what was dropped* is a
 * fact this module knows. The prompt used to carry the same numbers, and a
 * model that obeyed them truncated the history upstream where nothing could
 * see it — which is how a capped import came to report itself complete.
 *
 * One object rather than a constant each, so that the caps, the slicing and the
 * `truncated` flags are all keyed by the same names: a third capped list is a
 * line here and a line in the messages, not an edit in four files.
 */
const historyCaps = {
  experience: 5,
  education: 4
} as const

/** Which of the caps this parse actually hit, keyed as `historyCaps` is. */
function truncatedBy(parsed: ParsedResume): Truncation {
  return {
    experience: parsed.experience.length > historyCaps.experience,
    education: parsed.education.length > historyCaps.education
  }
}

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
    experience: parsed.experience.slice(0, historyCaps.experience),
    education: parsed.education.slice(0, historyCaps.education),
    skills: parsed.skills.slice(0, maxSkills),
    truncated: truncatedBy(parsed)
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
- "email" is the address printed on the resume. Leave it empty when the resume prints none — never guess one from a name or a website.
- For each job, "body" is what the resume writes under it, as markdown: one "- " line per accomplishment, at most ${maxBodyBullets}, and a plain line for anything written as prose. Keep the person's own wording and metrics.
- For each school, "body" is whatever the resume writes under it, in the same markdown form. Empty when it writes nothing.
- Group skills into at most ${maxSkills} categories, using the resume's own headings for them. If it lists skills without categories, put them all under one category named the way the resume names that part of the page.
- Return every job and every school the resume lists, most recent first. Do not leave any out to shorten the answer — how many are kept is decided after you answer, and a job you drop is one nobody can be told about.
- "sections" is every *other* section the resume has, in the order the document prints them: a heading, its position counting from 0, and what is written under it. Include every one of them — a section you leave out is a section the user loses.
- Copy each heading exactly as the document writes it, in its own language. Never rename it, translate it, or replace it with a word you would have chosen.
- Put a section's content in "entries" when the document writes a run of lines or bullets under it, one line per entry, and in "text" when it writes a paragraph. Use one or the other, never both.
- Never put jobs, schools, skills, or the contact details above into "sections" — they are returned in their own fields.

Respond with RFC8259 compliant JSON only, no explanations, in exactly this format:
{
  "firstName": "", "lastName": "", "profession": "", "location": "", "email": "", "phone": "",
  "linkedIn": "", "portfolio": "",
  "experience": [{ "name": "", "title": "", "startDate": "2017-09", "endDate": "2021-05", "current": false, "location": "", "body": "" }],
  "education": [{ "name": "", "degree": "", "startDate": "2013-09", "endDate": "", "current": true, "location": "", "gpa": "", "body": "" }],
  "skills": [{ "category": "", "all": [""] }],
  "sections": [{ "heading": "", "position": 0, "entries": [""], "text": "" }]
}`
