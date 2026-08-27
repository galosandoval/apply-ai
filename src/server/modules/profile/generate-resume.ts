import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"

/**
 * The shape the model must return.
 *
 * Structured generation replaces the old "respond with RFC8259 compliant JSON
 * without deviation" prompt plus a `JSON.parse` in a `try`/`catch` — the schema
 * is enforced by the call, so there is no half-parsed state to handle.
 */
export const generatedResumeSchema = z.object({
  profession: z.string(),
  education: z.array(
    z.object({
      name: z.string(),
      degree: z.string(),
      description: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      gpa: z.string()
    })
  ),
  experience: z.array(
    z.object({
      name: z.string(),
      title: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      bullets: z.array(z.string())
    })
  ),
  /**
   * The extra sections, as *requested* rather than as accepted: `label` is a
   * plain string because a schema the model writes the labels for cannot
   * enforce an allowlist. What is actually rendered is decided by
   * `sectionsFromGeneration`, in the module that owns what a section is.
   */
  sections: z.array(
    z.object({ label: z.string(), entries: z.array(z.string()) })
  )
})

export type GeneratedResume = z.infer<typeof generatedResumeSchema>

/**
 * What the prompt is built from: the user's history, serialized, and the
 * posting. Named for the draft rather than the procedure, so it cannot be
 * mistaken for `GenerateInput` — what the *client* sends, which is the posting
 * and nothing else.
 */
export type DraftInput = {
  profession: string
  /** The user's history, serialized. Shape is the model's problem, not ours. */
  experience: string
  education: string
  jobDescription: string
}

/** Strips characters that would let pasted text restructure the prompt. */
function cleanupString(input: string): string {
  return input.replace(/[[\]|\\'"{}<>]/g, "")
}

/**
 * The one prompt that writes a resume.
 *
 * The anti-fabrication rule is the point of it. A generator told to produce
 * keywords for a recruiter and told nothing about invention will manufacture
 * the coverage it is rewarded for, and the user finds out in an interview. The
 * posting's vocabulary is still used — bounded to what the history supports.
 *
 * Literal keyword repetition is deliberately not instructed: applicant tracking
 * matches on embeddings of extracted skills and titles, so an exact-phrase
 * resume optimises for systems a decade out of date and reads badly to the
 * human who decides.
 */
const generationPrompt = `You write a resume for one specific job posting, using only what the user has actually done.

Rules:
- Every employer, school, job title, date, number and skill in your answer must appear in the user's history. Never invent one, and never move an accomplishment from one employer to another.
- Where the posting describes something the user has genuinely done, describe it in the posting's own vocabulary. Never claim a technology, responsibility or result the history does not support, and do not repeat phrases from the posting for their own sake.
- Rewriting and reordering the history to lead with what this posting asks for is the job. Adding to it is not.
- Each job gets 3 to 6 accomplishments, one sentence each.
- Keep the resume to one page.

Sections:
- Always return the user's experience and education.
- You may also return up to two extra sections, and only these, each as one entry of "sections":
  - "Summary": 1 to 2 short paragraphs written for this posting, one entry per paragraph.
  - "Strengths": 3 to 6 short capability phrases that are not tied to a single employer, one entry each. A few words each, noun phrases — not sentences, and not punctuated as sentences.
- Omit either if the history does not support it. Any other section is discarded.`

/**
 * Drafts a resume. The seam tests stub, and the only place the model is called.
 *
 * The result is deliberately `unknown`: the caller re-parses it against
 * `generatedResumeSchema`, so a stub — or a future model boundary that doesn't
 * validate for us — is a typed failure rather than a shape nobody checked.
 */
export async function generateResume(input: DraftInput) {
  const { object } = await generateObject({
    model: openai("gpt-4.1"),
    schema: generatedResumeSchema,
    prompt: `${generationPrompt}

Profession: ${input.profession}
Work Experience: ${cleanupString(input.experience)}
Education: ${cleanupString(input.education)}

Job posting:
${input.jobDescription}`
  })

  return object
}
