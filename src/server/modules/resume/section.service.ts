import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import {
  type AnySectionContent,
  coreSectionDefaults,
  emptySectionContent,
  isCoreSectionKind,
  parseSectionContent,
  replaceSectionContentString,
  type SectionComponentType,
  type SectionContentTarget,
  type SectionKind
} from "~/lib/section-content"
import { assertOwnsResume } from "~/server/api/ownership"
import { type Database, type DbOrTx } from "~/server/db/types"
import { assertCoversExactly } from "./reorder"
import * as repo from "./resume.repository"
import {
  type AddSectionInput,
  type RemoveSectionInput,
  type ReorderSectionsInput,
  type SetSectionContentInput
} from "./section.schema"

// The sections a resume is drawn from.
//
// Like `resume.service`, every entry point takes the session's `userId` and
// asserts ownership itself. Each query is scoped to `resumeId` as well, so a
// section id from another resume finds nothing rather than being edited.

const sectionNotFound = () =>
  new TRPCError({ code: "NOT_FOUND", message: "Section not found" })

/**
 * One section a resume is created with, before it is given a position.
 *
 * Core sections carry no content: they are a label, an order and a pointer to
 * their own typed rows. Generation may add a custom one either side of them.
 */
export type NewSection = {
  kind: SectionKind
  label: string
  componentType: SectionComponentType
  content: AnySectionContent | null
}

/** One category of skills, as the Skills section stores it. */
export type SkillGroup = { label: string; items: string[] }

/**
 * The sections every resume starts with, with the account's skills already in
 * the one that holds them.
 *
 * What they are and what order they come in is `coreSectionDefaults`, shared
 * with the renderer's fallback — the defaults and the renderer cannot drift if
 * there is only one list.
 *
 * Skills arrives as *content* rather than as rows of its own: it is an ordinary
 * content-bearing section now, and the account's copy is snapshotted into it
 * the way contact details are snapshotted into `contact`.
 */
export function defaultSections(skillGroups: SkillGroup[]): NewSection[] {
  return coreSectionDefaults.map((section) => ({
    ...section,
    content: section.kind === "skills" ? { groups: skillGroups } : null
  }))
}

/**
 * Rows for a new resume's sections, numbered from the order given.
 *
 * Positions are assigned here rather than by each caller, so a resume created
 * with a generated Summary above the core three cannot end up with two sections
 * claiming the same place.
 */
export function newSections(resumeId: string, sections: NewSection[]) {
  return sections.map((section, position) => ({
    ...section,
    id: createId(),
    resumeId,
    position
  }))
}

/** Where a generated section sits against the core three. */
type Placement = "above" | "below"

/**
 * The extra sections a generation is allowed to add, and how each draws.
 *
 * A fixed allowlist rather than free choice: a model picking sections is a
 * model making layout decisions with no knowledge of what the components can
 * render. It lives here, beside the section rows it produces, rather than with
 * the prompt — what a resume may contain is this module's to say.
 *
 * A `Map` rather than an object literal because the key is a string the *model*
 * wrote: `generated["constructor"]` on an object finds `Object.prototype`'s and
 * walks straight past a truthiness check.
 *
 * A summary is the part of a resume most specific to the posting, so it sits
 * above the core sections; strengths are a footnote to a history, so below.
 */
const generatedSectionAllowlist = new Map<
  string,
  {
    componentType: SectionComponentType
    placement: Placement
    /** Turns the model's entries into the shape that component renders. */
    content: (entries: string[]) => AnySectionContent
  }
>([
  [
    "Summary",
    {
      componentType: "richText",
      placement: "above",
      // One entry per paragraph, joined the way markdown separates them.
      content: (entries) => ({ markdown: entries.join("\n\n") })
    }
  ],
  [
    "Strengths",
    {
      componentType: "tagList",
      placement: "below",
      // Short capability phrases, drawn as marks a reader takes in at a
      // glance rather than a second, weaker Experience.
      content: (entries) => ({ tags: entries })
    }
  ]
])

/** One extra section as the model asked for it, before the allowlist is applied. */
type RequestedSection = { label: string; entries: string[] }

/**
 * A generated resume's sections, in render order: the core three with whatever
 * the generation was allowed to add arranged around them.
 *
 * A label outside the allowlist is dropped and the rest of the resume is kept —
 * one section the components don't know how to draw is not a reason to throw
 * away a whole generation. A repeated label is dropped for the same reason a
 * second Summary would be: the resume has one of each.
 */
export function sectionsFromGeneration(
  requested: RequestedSection[],
  skillGroups: SkillGroup[]
): NewSection[] {
  const taken = new Set<string>()

  const accepted = requested.flatMap((section) => {
    const allowed = generatedSectionAllowlist.get(section.label)
    const entries = section.entries.filter((entry) => entry.trim())

    if (!allowed || taken.has(section.label) || !entries.length) return []

    taken.add(section.label)

    return [
      {
        placement: allowed.placement,
        section: {
          kind: "custom" as const,
          label: section.label,
          componentType: allowed.componentType,
          content: allowed.content(entries)
        }
      }
    ]
  })

  const at = (placement: Placement) =>
    accepted
      .filter((entry) => entry.placement === placement)
      .map((entry) => entry.section)

  return [...at("above"), ...defaultSections(skillGroups), ...at("below")]
}

/** Appends a custom section, empty, at the end of the resume. */
export async function add(
  db: Database,
  userId: string,
  input: AddSectionInput
) {
  const resumeId = input.resumeId

  await assertOwnsResume(db, userId, resumeId)

  const position = await repo.nextSectionPosition(db, resumeId)

  const [created] = await repo.insertSections(db, [
    {
      id: createId(),
      resumeId,
      kind: "custom",
      label: input.label,
      componentType: input.componentType,
      position,
      content: emptySectionContent(input.componentType)
    }
  ])

  if (!created) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Section not created"
    })
  }

  return { sectionId: created.id }
}

/**
 * Removes a section, core or custom.
 *
 * A core section's typed rows are deliberately left alone: removing Education
 * takes it off the page, and re-adding it should not have cost the user the
 * schools they typed in onboarding.
 */
export async function remove(
  db: Database,
  userId: string,
  input: RemoveSectionInput
) {
  await assertOwnsResume(db, userId, input.resumeId)

  const deleted = await repo.deleteSection(db, input.resumeId, input.sectionId)

  if (!deleted.length) throw sectionNotFound()

  return { sectionId: input.sectionId }
}

/**
 * Rewrites every position from the order given.
 *
 * The list must be exactly the resume's sections — a partial list would leave
 * the omitted ones holding positions that now mean something else.
 */
export async function reorder(
  db: Database,
  userId: string,
  input: ReorderSectionsInput
) {
  await assertOwnsResume(db, userId, input.resumeId)

  const existing = await repo.findSections(db, input.resumeId)

  assertCoversExactly(existing, input.sectionIds, "section of the resume")

  await db.transaction(async (tx) => {
    for (const [position, sectionId] of input.sectionIds.entries()) {
      await repo.updateSection(tx, input.resumeId, sectionId, { position })
    }
  })

  return { sectionIds: input.sectionIds }
}

/** Renames a section. The heading is the user's; the `kind` under it is not. */
export async function writeLabel(
  db: DbOrTx,
  resumeId: string,
  sectionId: string,
  value: string
) {
  const updated = await repo.updateSection(db, resumeId, sectionId, {
    label: value
  })

  if (!updated.length) throw sectionNotFound()
}

/**
 * Writes one string inside a custom section's content.
 *
 * Three things are checked, in this order, because each makes the next
 * meaningful: the section is custom (a core section has no content to write),
 * the path is addressed in the component type the section actually renders, and
 * the element it names already exists.
 */
export async function writeContent(
  db: Database,
  resumeId: string,
  sectionId: string,
  target: SectionContentTarget,
  value: string
) {
  await db.transaction(async (tx) => {
    const found = await loadCustomSection(tx, resumeId, sectionId)

    if (found.componentType !== target.componentType) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Section renders as ${found.componentType}, not ${target.componentType}`
      })
    }

    const next = replaceSectionContentString(target, found.content, value)

    if (!next)
      throw new TRPCError({ code: "NOT_FOUND", message: "Field not found" })

    await repo.updateSection(tx, resumeId, sectionId, { content: next })
  })
}

/**
 * Replaces a custom section's whole content payload.
 *
 * `writeContent` edits a string that already exists; this is how the set of
 * strings changes — a bullet added to a list, a tag removed. The payload is
 * validated against the component that has to render it, so a tag list cannot
 * be handed rich text however it arrives.
 */
export async function setContent(
  db: Database,
  userId: string,
  input: SetSectionContentInput
) {
  await assertOwnsResume(db, userId, input.resumeId)

  await db.transaction(async (tx) => {
    const found = await loadCustomSection(tx, input.resumeId, input.sectionId)
    const content = parseSectionContent(found.componentType, input.content)

    if (!content) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Content does not match a ${found.componentType} section`
      })
    }

    await repo.updateSection(tx, input.resumeId, input.sectionId, { content })
  })

  return { sectionId: input.sectionId }
}

/**
 * The section, refused unless it is one whose content the user owns.
 *
 * A core section's content *is* its typed rows — there is nothing here to
 * write, and letting one be written would be the restructuring the whole
 * core/custom split exists to prevent.
 */
async function loadCustomSection(
  tx: DbOrTx,
  resumeId: string,
  sectionId: string
) {
  const found = await repo.findSection(tx, resumeId, sectionId)

  if (!found) throw sectionNotFound()

  if (isCoreSectionKind(found.kind)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A core section's content is its own rows, not free text"
    })
  }

  return found
}
