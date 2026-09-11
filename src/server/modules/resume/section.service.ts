import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import { type Locale } from "~/i18n/routing"
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
import { type SectionOwner } from "./resume.repository"
import {
  presetLabelPath,
  type SectionLabeler,
  sectionLabelerFor,
  sectionLabelPath
} from "./section-labels"
import {
  type AddSectionInput,
  claimsOneOwner,
  oneOwnerMessage,
  type RemoveSectionInput,
  type RenameSectionInput,
  type ReorderSectionsInput,
  type SectionOwnerInput,
  type SetSectionContentInput
} from "./section.schema"

// The sections a resume is drawn from — and the ones the account is the master
// copy of, which are the same rows with the other owner set.
//
// Like `resume.service`, every entry point takes the session's `userId` and
// asserts ownership itself. Each query is scoped to the owner as well, so a
// section id belonging to another resume, or to another account, finds nothing
// rather than being edited.
//
// One service rather than a second copy for the account: rename, remove and
// reorder mean the same thing on either owner, and two implementations of that
// is two places for them to disagree.

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
 *
 * `label` writes the headings in the resume's own language, keyed by `kind`.
 * Its English answer is the same string `coreSectionDefaults` carries, which is
 * what the fallback below is for: the list stays readable on its own, and a
 * message file that has not caught up yet cannot leave a resume headless.
 */
export function defaultSections(
  skillGroups: SkillGroup[],
  label: SectionLabeler
): NewSection[] {
  return coreSectionDefaults.map((section) => ({
    ...section,
    label: label(sectionLabelPath(section.kind), section.label),
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
 * The extra sections a generation may return, as the model names them.
 *
 * The enum lives here rather than with the prompt for the same reason the
 * allowlist does: what a resume may contain is this module's to say, and the
 * generation schema imports it so the two cannot drift. The heading each one is
 * written with is copy — see `sectionLabels` in the message files.
 */
export const generatedSectionKinds = ["summary", "strengths"] as const

export type GeneratedSectionKind = (typeof generatedSectionKinds)[number]

/**
 * The extra sections a generation is allowed to add, and how each draws.
 *
 * A fixed allowlist rather than free choice: a model picking sections is a
 * model making layout decisions with no knowledge of what the components can
 * render. It lives here, beside the section rows it produces, rather than with
 * the prompt — what a resume may contain is this module's to say.
 *
 * Keyed by `kind` rather than by the heading the model wrote. The heading is
 * copy — it has to be Spanish on a Spanish resume — and a set of allowed
 * sections that matched on English strings would accept nothing at all the
 * moment the prompt was translated. `generatedSectionKinds` is the enum the
 * model answers with; the heading is written from it, in the resume's language.
 *
 * A summary is the part of a resume most specific to the posting, so it sits
 * above the core sections; strengths are a footnote to a history, so below.
 */
type GeneratedSectionRule = {
  componentType: SectionComponentType
  placement: Placement
  /** Turns the model's entries into the shape that component renders. */
  content: (entries: string[]) => AnySectionContent
}

const generatedSectionAllowlist = new Map<
  GeneratedSectionKind,
  GeneratedSectionRule
>([
  [
    "summary",
    {
      componentType: "richText",
      placement: "above",
      // One entry per paragraph, joined the way markdown separates them.
      content: (entries) => ({ markdown: entries.join("\n\n") })
    }
  ],
  [
    "strengths",
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
type RequestedSection = { kind: GeneratedSectionKind; entries: string[] }

/**
 * A generated resume's sections, in render order: the core three with whatever
 * the generation was allowed to add arranged around them.
 *
 * A kind outside the allowlist is dropped and the rest of the resume is kept —
 * one section the components don't know how to draw is not a reason to throw
 * away a whole generation. A repeated kind is dropped for the same reason a
 * second Summary would be: the resume has one of each.
 *
 * The headings come from `label`, like the core three: what the generation
 * decides is which sections a resume has, never what language it is in.
 */
export function sectionsFromGeneration(
  requested: RequestedSection[],
  skillGroups: SkillGroup[],
  label: SectionLabeler
): NewSection[] {
  const taken = new Set<string>()

  const accepted = requested.flatMap((section) => {
    // A `Map` rather than an object: the kind is a string the model wrote, and
    // `generated["constructor"]` reaches `Object.prototype`'s on a plain
    // object. The schema already rejects it — a `Map` is what keeps that true
    // for any other caller, without a guard anyone can forget to write.
    const allowed = generatedSectionAllowlist.get(section.kind)
    const entries = section.entries.filter((entry) => entry.trim())

    if (!allowed || taken.has(section.kind) || !entries.length) return []

    taken.add(section.kind)

    return [
      {
        placement: allowed.placement,
        section: {
          kind: "custom" as const,
          label: label(sectionLabelPath(section.kind), section.kind),
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

  return [
    ...at("above"),
    ...defaultSections(skillGroups, label),
    ...at("below")
  ]
}

/**
 * The account's own sections, in its order — the master copy a new resume is
 * drawn from.
 *
 * An account with no rows of its own reads as the current default set rather
 * than as nothing, which is what lets the backfill and the code that reads it
 * ship in either order: an account the backfill has not reached behaves exactly
 * as it did before.
 *
 * Every entry says which it is. A stand-in carries its `kind` as an id, like
 * the renderer's own fallback, and a write naming one finds nothing — the
 * truthful answer, but a silent one. `isDefault` is the loud version: a caller
 * can tell an editable row from a placeholder without knowing that the ids of
 * one happen not to be cuid2s.
 *
 * Skills carries no content here, unlike on a resume: the account's skills are
 * the `skill` rows keyed by `userId`, and it is the snapshot onto a resume that
 * turns them into content.
 */
export async function readAccountSections(db: Database, userId: string) {
  const rows = await repo.findSections(db, { userId })

  if (rows.length) return rows.map((row) => ({ ...row, isDefault: false }))

  const label = await sectionLabelerFor(
    await repo.findAccountLanguage(db, userId)
  )

  return coreSectionDefaults.map((section, position) => ({
    id: section.kind,
    userId,
    resumeId: null,
    kind: section.kind,
    label: label(sectionLabelPath(section.kind), section.label),
    componentType: section.componentType,
    position,
    content: null,
    isDefault: true
  }))
}

/**
 * The owner the input named, once the session is allowed to write to it.
 *
 * A resume is asserted against the session; the account needs no assertion
 * because it *is* the session's — `userId` comes from the cookie, never from
 * the input, so there is no account a caller could name but not own.
 *
 * Exactly one has to be claimed. An input claiming both is a caller that has
 * not decided; one claiming neither is a caller that has lost its `resumeId`,
 * and answering that with the account would edit the master copy every resume
 * is drawn from.
 */
async function ownerFor(
  db: Database,
  userId: string,
  input: SectionOwnerInput
) {
  if (!claimsOneOwner(input)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: oneOwnerMessage })
  }

  if (!input.resumeId) return { userId }

  await assertOwnsResume(db, userId, input.resumeId)

  return { resumeId: input.resumeId }
}

/**
 * The language a new heading is written in: the resume's, or — for a section of
 * the account's own — the language the account reads in.
 */
async function languageOf(db: Database, owner: SectionOwner): Promise<Locale> {
  return "resumeId" in owner
    ? repo.findResumeLanguage(db, owner.resumeId)
    : repo.findAccountLanguage(db, owner.userId)
}

/** The columns that say who owns a row, as an insert takes them. */
function ownerColumns(owner: SectionOwner) {
  return "resumeId" in owner
    ? { resumeId: owner.resumeId, userId: null }
    : { userId: owner.userId, resumeId: null }
}

/**
 * Appends a custom section, empty, at the end of the resume — or at the end of
 * the account's own list.
 *
 * The heading is rewritten from the catalog preset the user picked, in the
 * owner's language rather than the interface's: the two are normally the same,
 * and where they are not it is the document that decides — a Spanish resume
 * being edited from an English session gets a Spanish heading. An id the
 * message files don't know keeps whatever the picker displayed.
 */
export async function add(
  db: Database,
  userId: string,
  input: AddSectionInput
) {
  const owner = await ownerFor(db, userId, input)

  const [position, label] = await Promise.all([
    repo.nextSectionPosition(db, owner),
    presetLabel(db, owner, input)
  ])

  const [created] = await repo.insertSections(db, [
    {
      id: createId(),
      ...ownerColumns(owner),
      kind: "custom",
      label,
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

/** The preset's heading in the owner's language, or the client's own label. */
async function presetLabel(
  db: Database,
  owner: SectionOwner,
  input: AddSectionInput
) {
  if (!input.presetId) return input.label

  const label = await sectionLabelerFor(await languageOf(db, owner))

  return label(presetLabelPath(input.presetId), input.label)
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
  const owner = await ownerFor(db, userId, input)

  const deleted = await repo.deleteSection(db, owner, input.sectionId)

  if (!deleted.length) throw sectionNotFound()

  return { sectionId: input.sectionId }
}

/**
 * Rewrites every position from the order given.
 *
 * The list must be exactly the owner's sections — a partial list would leave
 * the omitted ones holding positions that now mean something else.
 */
export async function reorder(
  db: Database,
  userId: string,
  input: ReorderSectionsInput
) {
  const owner = await ownerFor(db, userId, input)
  const existing = await repo.findSections(db, owner)

  assertCoversExactly(
    existing,
    input.sectionIds,
    "resumeId" in owner ? "section of the resume" : "section of the profile"
  )

  await db.transaction(async (tx) => {
    for (const [position, sectionId] of input.sectionIds.entries()) {
      await repo.updateSection(tx, owner, sectionId, { position })
    }
  })

  return { sectionIds: input.sectionIds }
}

/**
 * Renames a section, named by whoever owns it.
 *
 * A resume reaches this through `resume.updateField`'s path grammar, which has
 * already asserted the resume; the account reaches it through `rename`, which
 * asserts nothing because there is nothing to assert.
 */
export async function writeLabel(
  db: DbOrTx,
  owner: SectionOwner,
  sectionId: string,
  value: string
) {
  const updated = await repo.updateSection(db, owner, sectionId, {
    label: value
  })

  if (!updated.length) throw sectionNotFound()
}

/**
 * Renames one of the account's own sections. The heading is the user's; the
 * `kind` under it is not.
 *
 * The account only: a resume's heading is an editable string on the document
 * and is written through `resume.updateField`, which has already asserted the
 * resume by the time it reaches `writeLabel`. Nothing to assert here — the
 * account is the session's.
 */
export async function rename(
  db: Database,
  userId: string,
  input: RenameSectionInput
) {
  await writeLabel(db, { userId }, input.sectionId, input.label)

  return { sectionId: input.sectionId }
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
  owner: SectionOwner,
  sectionId: string,
  target: SectionContentTarget,
  value: string
) {
  await db.transaction(async (tx) => {
    const found = await loadCustomSection(tx, owner, sectionId)

    if (found.componentType !== target.componentType) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Section renders as ${found.componentType}, not ${target.componentType}`
      })
    }

    const next = replaceSectionContentString(target, found.content, value)

    if (!next)
      throw new TRPCError({ code: "NOT_FOUND", message: "Field not found" })

    await repo.updateSection(tx, owner, sectionId, { content: next })
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
  const owner = await ownerFor(db, userId, input)

  await db.transaction(async (tx) => {
    const found = await loadCustomSection(tx, owner, input.sectionId)
    const content = parseSectionContent(found.componentType, input.content)

    if (!content) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Content does not match a ${found.componentType} section`
      })
    }

    await repo.updateSection(tx, owner, input.sectionId, { content })
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
  owner: SectionOwner,
  sectionId: string
) {
  const found = await repo.findSection(tx, owner, sectionId)

  if (!found) throw sectionNotFound()

  if (isCoreSectionKind(found.kind)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A core section's content is its own rows, not free text"
    })
  }

  return found
}
