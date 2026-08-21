import { z } from "zod"

// What a section is and what it may hold.
//
// Shared by the client and the server: the same discriminator decides which
// component draws a section, which paths can address its content, and which
// payloads a write will accept.

/**
 * Core kinds keep their typed rows — a `work` row's company, dates and bullets
 * are what make a resume machine-readable, so their structure is not the user's
 * to restructure. Only `custom` carries `content`.
 */
export const coreSectionKinds = ["experience", "education", "skills"] as const

export type CoreSectionKind = (typeof coreSectionKinds)[number]
export type SectionKind = CoreSectionKind | "custom"

export function isCoreSectionKind(kind: string): kind is CoreSectionKind {
  return (coreSectionKinds as readonly string[]).includes(kind)
}

/**
 * The shapes a section can draw as. Fixed by spec C, which renders them; this
 * module stores and validates the discriminator, and nothing more.
 */
export const sectionComponentTypes = [
  "richText",
  "twoColumn",
  "list",
  "tagList",
  "iconList"
] as const

export type SectionComponentType = (typeof sectionComponentTypes)[number]

export function isSectionComponentType(
  value: string
): value is SectionComponentType {
  return (sectionComponentTypes as readonly string[]).includes(value)
}

/**
 * Rich text is a **markdown string** in the constrained subset spec D defines —
 * bold, links, bullet lists. Not HTML: there is no sanitizer to get wrong, and
 * the value strips to clean text for a parser for free.
 */
const richTextContent = z.object({ markdown: z.string() })

const twoColumnContent = z.object({
  rows: z.array(z.object({ left: z.string(), right: z.string() }))
})

const listContent = z.object({ items: z.array(z.string()) })

const tagListContent = z.object({ tags: z.array(z.string()) })

const iconListContent = z.object({
  icons: z.array(z.object({ icon: z.string(), text: z.string() }))
})

const contentSchemas = {
  richText: richTextContent,
  twoColumn: twoColumnContent,
  list: listContent,
  tagList: tagListContent,
  iconList: iconListContent
} satisfies Record<SectionComponentType, z.ZodTypeAny>

export type SectionContent = {
  [Type in SectionComponentType]: z.infer<(typeof contentSchemas)[Type]>
}

export type AnySectionContent = SectionContent[SectionComponentType]

/**
 * Validates a content payload against the component that has to render it.
 *
 * Returns `null` rather than throwing: both the write path and the parser ask
 * this question about client-supplied values, and a rejection is an answer.
 * Unknown keys are stripped, so a tag list cannot smuggle rich text through.
 */
export function parseSectionContent<Type extends SectionComponentType>(
  componentType: Type,
  content: unknown
): SectionContent[Type] | null
export function parseSectionContent(
  componentType: string,
  content: unknown
): AnySectionContent | null
export function parseSectionContent(
  componentType: string,
  content: unknown
): AnySectionContent | null {
  if (!isSectionComponentType(componentType)) return null

  const parsed = contentSchemas[componentType].strip().safeParse(content)

  return parsed.success ? (parsed.data as AnySectionContent) : null
}

/** What a section holds the moment it is added, before anything is written. */
export function emptySectionContent<Type extends SectionComponentType>(
  componentType: Type
): SectionContent[Type] {
  const empty = {
    richText: { markdown: "" },
    twoColumn: { rows: [] },
    list: { items: [] },
    tagList: { tags: [] },
    iconList: { icons: [] }
  } satisfies SectionContent

  return empty[componentType]
}
