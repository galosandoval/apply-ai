import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import { type Locale } from "~/i18n/routing"
import {
  type AnySectionContent,
  coreSectionDefaults,
  emptySectionContent,
  isCoreSectionKind,
  isSectionComponentType,
  isSectionKind,
  parseSectionContent,
  replaceSectionContentString,
  type SectionComponentType,
  type SectionContentTarget,
  type SectionKind
} from "~/lib/section-content"
import {
  type ImportedSection,
  matchSectionPreset,
  resolveSectionHeading
} from "~/lib/section-heading"
import { assertOwnsResume } from "~/server/api/ownership"
import { type Database, type DbOrTx } from "~/server/db/types"
import { assertCoversExactly } from "./reorder"
import * as repo from "./resume.repository"
import { isResumeOwner, type SectionOwner } from "./resume.repository"
import {
  presetLabelPath,
  sectionCatalogTranslatorFor,
  type SectionLanguage,
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
 * The sections a new resume is created with: the account's own, snapshotted.
 *
 * The account is the master copy — its order is the order a new resume starts
 * in, and a section added to it is on every resume made afterwards without
 * anyone adding it again. Snapshotted rather than referenced, like contact and
 * skills: editing the account afterwards must not rewrite a document already
 * created.
 *
 * The account's *order* is what carries, not its numbers: these come back in
 * the account's order and `newSections` renumbers them from zero. An account
 * whose positions have gaps in them — a removed section leaves one — would
 * otherwise seed a resume with the same gaps, and a generated Summary has to
 * be placed among them.
 *
 * Read through `readAccountSections` rather than from the rows directly, so an
 * account the backfill has not reached is answered by the same fallback the
 * profile shows. Two readers with a fallback each would be two places to
 * disagree about what a pre-migration account has.
 *
 * Skills is the one section whose content is not the account's to hold: the
 * account keeps `skill` rows, and this is where they become the section's
 * content.
 */
export async function sectionsForNewResume(
  db: Database,
  userId: string,
  skillGroups: SkillGroup[]
): Promise<NewSection[]> {
  const rows = await readAccountSections(db, userId)

  // `kind`, `component_type` and `content` are a text and a jsonb column, so a
  // stored row arrives as `string` and `unknown`. Narrowed rather than cast:
  // the write path is the only one that *should* have filled these, but the
  // backfill wrote rows that never went through it, and a cast here would copy
  // whatever it left onto every resume made afterwards — unread until
  // something tried to draw it.
  return rows.flatMap((row) => {
    // A component type nothing can render is not a section the user loses by
    // it being dropped: there is no component to draw it with either way.
    if (!isSectionKind(row.kind) || !isSectionComponentType(row.componentType))
      return []

    return [
      {
        kind: row.kind,
        label: row.label,
        componentType: row.componentType,
        // Content that doesn't match the component it is filed under is
        // dropped and the section kept: an empty Certifications is a heading
        // the user can refill, where dropping it is a section that vanished.
        content:
          row.kind === "skills"
            ? { groups: skillGroups }
            : parseSectionContent(row.componentType, row.content)
      }
    ]
  })
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

/** Where a generated section sits against the sections the resume is seeded with. */
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
 * above the sections the resume was seeded with; strengths are a footnote to a
 * history, so below. Above and below *the account's* sections, whatever those
 * are — the seed has been the account's own list since #97, and a placement
 * pinned to the core three would put a generated Summary under a Certifications
 * the user had moved to the top.
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
 * A generated resume's sections, in render order: the ones it is seeded with
 * and whatever the generation was allowed to add arranged around them.
 *
 * A kind outside the allowlist is dropped and the rest of the resume is kept —
 * one section the components don't know how to draw is not a reason to throw
 * away a whole generation. A repeated kind is dropped for the same reason a
 * second Summary would be: the resume has one of each.
 *
 * The seed counts towards that one-of-each. A generation adds sections; it
 * never displaces one the user keeps, so a Summary the account already carries
 * is the Summary the resume gets — with the label, the shape and the content
 * the user gave it — and the generated one is dropped rather than written
 * beside it or over it.
 *
 * The headings come from `label`, like the seeded ones: what the generation
 * decides is which sections a resume has, never what language it is in.
 */
export function sectionsFromGeneration(
  requested: RequestedSection[],
  seed: NewSection[],
  language: SectionLanguage
): NewSection[] {
  const taken = new Set<GeneratedSectionKind>(carriedKinds(seed, language))

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
          label: language.label(sectionLabelPath(section.kind), section.kind),
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

  return [...at("above"), ...seed, ...at("below")]
}

/**
 * The generated kinds the seeded sections already cover.
 *
 * Read off the *heading*, through the same catalog matching an imported one
 * gets, because the heading is the only thing that says which section this is:
 * `kind` is `custom` for everything but the core rows and the skills marker, so
 * a stored Summary and a stored Certifications are the same kind on the same
 * table. Matching also means the account's own word for it counts — an account
 * whose imported resume called it "Profile" carries a summary, and generation
 * has nothing to add.
 *
 * The allowlist's kinds are catalog preset ids on purpose, so the preset a
 * heading matches is directly the kind a generation would have asked for. They
 * are also the only candidates the heading is matched against, which is what
 * keeps the question to the one being asked: a heading reading "Strengths and
 * Skills" carries a strengths, and a match open to the whole catalog would let
 * the skills candidate take it first and report neither.
 */
function carriedKinds(
  seed: NewSection[],
  language: SectionLanguage
): GeneratedSectionKind[] {
  return seed.flatMap((section) => {
    const presetId = matchSectionPreset(
      section.label,
      language.catalog,
      generatedSectionKinds
    )

    return presetId && isGeneratedSectionKind(presetId) ? [presetId] : []
  })
}

const isGeneratedSectionKind = (kind: string): kind is GeneratedSectionKind =>
  (generatedSectionKinds as readonly string[]).includes(kind)

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
export async function readAccountSections(db: DbOrTx, userId: string) {
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
 * Writes an imported document's sections onto the account, replacing whatever a
 * previous import left.
 *
 * The headings are the user's: each one is written verbatim, in the language
 * the document used, and `resolveSectionHeading` contributes only the shape it
 * draws as and the preset it matched. A heading that matches nothing is still a
 * section — that is the whole of #93's fallback, and dropping it here would
 * undo it.
 *
 * The document's order is kept among the imported sections, appended after the
 * core three. The extraction reports where each section sat relative to the
 * others it returned; it does not report where Experience sat among them, so
 * interleaving would mean inventing a position the document never gave us.
 *
 * Replace rather than append: a user who imports a second resume is correcting
 * the first, not adding to it, and appending would leave them deleting a second
 * copy of every heading by hand. The core three are exempt and keep the
 * headings and the order the user gave them.
 *
 * The bluntness of that is known, and is data loss the day it stops being
 * onboarding's: a section row carries no provenance, so a custom section the
 * user added from the picker is indistinguishable from one the last import
 * wrote, and a re-import deletes both. It is survivable only because this is
 * reachable from onboarding alone, which runs before there is anything to add
 * by hand.
 *
 * So this is a precondition, not a preference. Anything that lets an existing
 * profile re-import — the editor, a settings page, a second upload after
 * onboarding — must add provenance to the section row and scope the delete to
 * it *first* (#111); wiring a second caller to this function as it stands
 * silently deletes the user's own sections.
 *
 * @returns how many of the document's own sections were written — the core
 * three are not counted, because they are the account's and are there whether
 * the document had anything to put in them or not.
 */
export async function replaceImportedSections(
  tx: DbOrTx,
  userId: string,
  imported: ImportedSection[]
) {
  // An account the backfill never reached reads as the defaults and holds no
  // rows. Writing them first — it takes the account's lock — is what keeps the
  // core three once this appends. See `writeStandInSections`.
  await writeStandInSections(tx, userId)
  await repo.deleteCustomSections(tx, { userId })

  const kept = await repo.findSections(tx, { userId })
  const t = await sectionCatalogTranslatorFor(
    await repo.findAccountLanguage(tx, userId)
  )

  // After the last section the account keeps, by *position* rather than by
  // count: a user who removed a section leaves a gap behind, and numbering the
  // imported ones from the count would land one of them on a position a core
  // section already holds.
  const start = Math.max(-1, ...kept.map((row) => row.position)) + 1

  const rows = imported.map((section, index) => {
    const resolved = resolveSectionHeading(section.heading, section.content, t)

    return {
      id: createId(),
      userId,
      resumeId: null,
      // `resolved.kind` is deliberately not written. It can only be `skills`,
      // which is provenance — it says which section a refresh from the account
      // puts the `skill` rows back into — and the account already holds exactly
      // one section making that claim. #93 leaves the choice here on purpose:
      // "keeping one of them as the account's is the writer's call, made where
      // the sibling sections are visible". This is that call, and it keeps the
      // one already there. A second heading that reads as skills ("Soft
      // Skills") arrives with its content and its own label intact, as a
      // section the user owns rather than as a rival claim on the same rows.
      kind: "custom" as const,
      label: resolved.label,
      componentType: resolved.componentType,
      position: start + index,
      content: resolved.content
    }
  })

  await repo.insertSections(tx, rows)

  return rows.length
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
  return isResumeOwner(owner)
    ? repo.findResumeLanguage(db, owner.resumeId)
    : repo.findAccountLanguage(db, owner.userId)
}

/** The columns that say who owns a row, as an insert takes them. */
function ownerColumns(owner: SectionOwner) {
  return isResumeOwner(owner)
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
  const label = await presetLabel(db, owner, input)

  const created = await db.transaction(async (tx) => {
    // In one transaction with the write below: a set of defaults written
    // without the section they were written for would be the user adding
    // Certifications and getting three sections that are not it.
    if (!isResumeOwner(owner)) await writeStandInSections(tx, owner.userId)

    const position = await repo.nextSectionPosition(tx, owner)

    const [row] = await repo.insertSections(tx, [
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

    return row
  })

  if (!created) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Section not created"
    })
  }

  return { sectionId: created.id }
}

/**
 * Writes the defaults an account has been *reading* as its own rows, once,
 * before the first section is added to it.
 *
 * An account the backfill never reached has no rows and reads as the default
 * set — `readAccountSections` stands them in. Appending to that account without
 * this would leave it holding the one row that was appended, so the profile,
 * and every resume seeded from it afterwards, would silently lose Skills,
 * Experience and Education.
 *
 * The stand-ins are what gets written, read back from `readAccountSections`
 * rather than rebuilt here: a second builder of the same defaults is a second
 * place for them to disagree, and the whole point is that the user ends up
 * owning exactly the sections they were already being shown. All this adds is
 * an id apiece — a stand-in carries its `kind` as one, and a real row needs a
 * real one.
 */
async function writeStandInSections(tx: DbOrTx, userId: string) {
  await repo.lockAccount(tx, userId)

  const rows = await readAccountSections(tx, userId)

  // An account already holding rows of its own is one the user has been
  // editing — there is nothing being stood in for.
  if (rows.some((row) => !row.isDefault)) return

  await repo.insertSections(
    tx,
    rows.map(({ isDefault: _isDefault, ...row }) => ({
      ...row,
      id: createId()
    }))
  )
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
    isResumeOwner(owner) ? "section of the resume" : "section of the profile"
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
