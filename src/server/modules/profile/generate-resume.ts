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
  )
})

export type GeneratedResume = z.infer<typeof generatedResumeSchema>

export const generateResumeInput = z.object({
  profession: z.string(),
  /** The user's history, serialized. Shape is the model's problem, not ours. */
  experience: z.string(),
  education: z.string(),
  jobDescription: z.string().min(1).max(20_000)
})

export type GenerateResumeInput = z.infer<typeof generateResumeInput>

/** Strips characters that would let pasted text restructure the prompt. */
function cleanupString(input: string): string {
  return input.replace(/[[\]|\\'"{}<>]/g, "")
}

export async function generateResume(input: GenerateResumeInput) {
  const { object } = await generateObject({
    model: openai("gpt-4.1"),
    schema: generatedResumeSchema,
    prompt: `You are a helpful resume building assistant. Generate a resume that is 1 page long based on the following user's information: Profession: ${
      input.profession
    } Work Experience: ${cleanupString(
      input.experience
    )}, Education: ${cleanupString(
      input.education
    )}. The following is the job description: ${
      input.jobDescription
    }. Use the job description provided to respond with keywords for a recruiter or recruiting algorithm. Each job should have 3 to 6 accomplishments, one sentence each.`
  })

  return object
}
