import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"
import { type Locale } from "~/i18n/routing"
import { generatedSectionKinds } from "~/server/modules/resume/section.service"

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
      body: z.string(),
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
      /**
       * Everything under the job, as the markdown subset the document renders:
       * a `- ` line per accomplishment, a plain line for prose. One field
       * rather than an array of bullets, because that is what the column holds
       * and a resume is allowed to mix the two.
       */
      body: z.string()
    })
  ),
  /**
   * The extra sections, as *requested* rather than as accepted: the model names
   * a `kind` from a fixed set instead of writing a heading, so the same
   * generation can be asked for in any language and still produce sections this
   * app knows how to draw. What is actually rendered — and what the heading
   * says — is decided by `sectionsFromGeneration`, in the module that owns what
   * a section is.
   */
  sections: z.array(
    z.object({
      kind: z.enum(generatedSectionKinds),
      entries: z.array(z.string())
    })
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
  /**
   * The language to write in, from `resume.language`.
   *
   * Passed explicitly and never inferred: a posting is often in English for a
   * job worked in Spanish, and either way it is the user who decided what
   * language their resume is in, not the company that wrote the advert.
   */
  language: Locale
}

/** Strips characters that would let pasted text restructure the prompt. */
function cleanupString(input: string): string {
  return input.replace(/[[\]|\\'"{}<>]/g, "")
}

/**
 * The prompt that writes a resume, one per language.
 *
 * A translated prompt rather than an English prompt with "answer in Spanish"
 * appended: the second gets a Spanish resume written to English conventions,
 * and the conventions are half of what a resume is. Each one is written in the
 * language it produces, so the model is reading the register it is being asked
 * to write in.
 *
 * The anti-fabrication rule is the point of both. A generator told to produce
 * keywords for a recruiter and told nothing about invention will manufacture
 * the coverage it is rewarded for, and the user finds out in an interview. The
 * posting's vocabulary is still used — bounded to what the history supports.
 *
 * Literal keyword repetition is deliberately not instructed: applicant tracking
 * matches on embeddings of extracted skills and titles, so an exact-phrase
 * resume optimises for systems a decade out of date and reads badly to the
 * human who decides.
 */
const englishPrompt = `You write a resume for one specific job posting, using only what the user has actually done.

Rules:
- Every employer, school, job title, date, number and skill in your answer must appear in the user's history. Never invent one, and never move an accomplishment from one employer to another.
- Where the posting describes something the user has genuinely done, describe it in the posting's own vocabulary. Never claim a technology, responsibility or result the history does not support, and do not repeat phrases from the posting for their own sake.
- Rewriting and reordering the history to lead with what this posting asks for is the job. Adding to it is not.
- Each job's "body" is markdown: one "- " line per accomplishment, 3 to 6 of them, one sentence each. Write a plain line instead of a bullet only where the history is genuinely prose.
- A school's "body" is the same markdown, and empty when there is nothing to say.
- Keep the resume to one page.

Sections:
- Always return the user's experience and education.
- You may also return up to two extra sections, and only these, each as one entry of "sections", named by its "kind":
  - "summary": 1 to 2 short paragraphs written for this posting, one entry per paragraph.
  - "strengths": 3 to 6 short capability phrases that are not tied to a single employer, one entry each. A few words each, noun phrases — not sentences, and not punctuated as sentences.
- Omit either if the history does not support it.

Write every word of the resume in English, whatever language the job posting is in.`

const spanishPrompt = `Escribes un currículum para una vacante concreta, usando únicamente lo que la persona ha hecho de verdad.

Reglas:
- Toda empresa, institución, puesto, fecha, cifra y habilidad que aparezca en tu respuesta debe estar en el historial de la persona. Nunca inventes ninguna, y nunca traslades un logro de una empresa a otra.
- Cuando la vacante describa algo que la persona sí ha hecho, descríbelo con el vocabulario de la propia vacante. Nunca atribuyas una tecnología, una responsabilidad o un resultado que el historial no respalde, ni repitas frases de la vacante por repetirlas.
- Reescribir y reordenar el historial para empezar por lo que esta vacante pide es el trabajo. Agregarle cosas no lo es.
- El "body" de cada puesto es markdown: una línea que empieza por "- " por cada logro, de 3 a 6, de una oración cada uno. Escribe una línea sin viñeta solo cuando el historial sea de verdad un párrafo.
- El "body" de cada formación es el mismo markdown, y va vacío cuando no hay nada que decir.
- El currículum no pasa de una página.

Secciones:
- Devuelve siempre la experiencia y la formación de la persona.
- Puedes devolver además hasta dos secciones extra, y solo estas, cada una como una entrada de "sections", nombrada por su "kind":
  - "summary": 1 o 2 párrafos breves escritos para esta vacante, una entrada por párrafo.
  - "strengths": de 3 a 6 frases cortas de capacidad que no dependan de un solo empleo, una entrada cada una. De pocas palabras, sintagmas nominales, sin forma de oración y sin puntuación de oración.
- Omite cualquiera de las dos si el historial no la respalda.

Escribe el currículum entero en español neutro de Latinoamérica, sea cual sea el idioma de la vacante. Usa un registro profesional y evita el voseo y los regionalismos.`

/**
 * The prompt each language is written with.
 *
 * Exhaustive over `Locale` on purpose, rather than a lookup with an English
 * fallback: a locale that ships without a prompt of its own would quietly
 * produce resumes in a language nobody asked for, and a type error at the
 * table is where that should be found.
 */
const generationPrompts: Record<Locale, string> = {
  en: englishPrompt,
  es: spanishPrompt
}

/**
 * Drafts a resume. The seam tests stub, and the only place the model is called.
 *
 * The result is deliberately `unknown`: the caller re-parses it against
 * `generatedResumeSchema`, so a stub — or a future model boundary that doesn't
 * validate for us — is a typed failure rather than a shape nobody checked.
 */
export async function generateResume(input: DraftInput) {
  const prompt = generationPrompts[input.language]

  const { object } = await generateObject({
    model: openai("gpt-4.1"),
    schema: generatedResumeSchema,
    prompt: `${prompt}

Profession: ${input.profession}
Work Experience: ${cleanupString(input.experience)}
Education: ${cleanupString(input.education)}

Job posting:
${input.jobDescription}`
  })

  return object
}
