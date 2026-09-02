import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import {
  type ContactColumn,
  parseResumeFieldPath,
  type ResumeFieldTarget
} from "~/lib/resume-field-path"
import { type Locale, toLocale } from "~/i18n/routing"
import { assertOwnsResume } from "~/server/api/ownership"
import {
  generatedResumeSchema,
  generateResume
} from "~/server/modules/profile/generate-resume"
import { resumeStyleStamp } from "~/lib/resume-style"
import { school, work } from "~/server/db/schema"
import { type Database, type DbOrTx } from "~/server/db/types"
import { assertCoversExactly } from "./reorder"
import * as repo from "./resume.repository"
import { sectionLabelerFor } from "./section-labels"
import {
  type AddRowInput,
  type CreateResumeInput,
  type GenerateInput,
  type RemoveRowInput,
  type ReorderRowsInput,
  type RowSectionName,
  type SetStyleInput,
  type UpdateFieldInput
} from "./resume.schema"
import * as sections from "./section.service"

// Business rules for the resume aggregate.
//
// A resume owns everything it renders: its sections, its `work` / `school`
// rows, and — since spec B — its own copy of the skills and contact details it
// was created with. The account keeps a master copy that seeds a new resume and
// nothing more, so tailoring one application cannot rewrite one already sent.

const fieldNotFound = () =>
  new TRPCError({ code: "NOT_FOUND", message: "Field not found" })

/** The account's skill rows as the Skills section stores them. */
const skillGroupsFrom = (
  rows: { category: string; all: string[] }[]
): sections.SkillGroup[] =>
  rows.map((group) => ({ label: group.category, items: group.all }))

export async function list(db: Database, userId: string) {
  return repo.listResumes(db, userId)
}

/**
 * A saved resume, with everything it owns, in render order.
 *
 * `contact` is always an object: a resume created before snapshots existed may
 * have no row, and the document needs the fields to exist so they can be filled
 * in rather than being unreachable.
 */
export async function readById(db: Database, userId: string, resumeId: string) {
  await assertOwnsResume(db, userId, resumeId)

  const found = await repo.findResume(db, resumeId)

  if (!found)
    throw new TRPCError({ code: "NOT_FOUND", message: "Resume not found" })

  const [experience, education, contact, sectionRows] = await Promise.all([
    repo.findExperience(db, resumeId),
    repo.findEducation(db, resumeId),
    repo.findContact(db, resumeId),
    repo.findSections(db, resumeId)
  ])

  return {
    ...found,
    experience,
    education,
    contact: {
      fullName: contact?.fullName ?? "",
      email: contact?.email ?? "",
      location: contact?.location ?? "",
      phone: contact?.phone ?? "",
      linkedIn: contact?.linkedIn ?? "",
      portfolio: contact?.portfolio ?? ""
    },
    sections: sectionRows
  }
}

/**
 * What a caller already knows about the resume being created, so it is not
 * looked up twice: the sections a generation produced, and the language it was
 * drafted in. Everything here has an answer the account can supply, so a
 * caller that has neither passes nothing.
 */
type CreateOptions = {
  /**
   * What a generation produced — the core three with its own arranged around
   * them. A resume created any other way gets the core three, which is why
   * they are the default rather than the caller's to remember.
   */
  sections?: sections.NewSection[]
  /** The language it is written in. Defaults to the account's `locale`. */
  language?: Locale
}

/**
 * Creates a resume from a draft, snapshotting everything it renders.
 *
 * One transaction: a resume that saved its jobs but not its skills would render
 * as a document with a section silently missing.
 *
 * The language is taken from the account once, here, and stored on the row: a
 * resume owns everything it renders, and switching the interface to English
 * later must not retitle a Spanish document.
 */
export async function create(
  db: Database,
  userId: string,
  input: CreateResumeInput,
  options: CreateOptions = {}
) {
  const language = options.language ?? (await readUserLocale(db, userId))

  // Read before the transaction opens: the default sections carry the
  // account's skills as content, so building them is a query and not a
  // rearrangement of what the caller passed.
  const list =
    options.sections ??
    sections.defaultSections(
      skillGroupsFrom(await repo.findAccountSkills(db, userId)),
      await sectionLabelerFor(language)
    )

  const resumeId = await db.transaction(async (tx) => {
    const created = await repo.insertResume(tx, {
      id: createId(),
      profession: input.profession,
      jobDescription: input.jobDescription,
      language,
      userId
    })

    if (!created) throw new Error("Resume not created")

    const id = created.id

    await repo.insertExperience(
      tx,
      input.experience.map((job, position) => ({
        ...job,
        id: createId(),
        position,
        resumeId: id
      }))
    )

    await repo.insertEducation(
      tx,
      input.education.map((entry, position) => ({
        ...entry,
        id: createId(),
        position,
        resumeId: id
      }))
    )

    await writeSnapshot(tx, id, userId, input)

    await repo.insertSections(tx, sections.newSections(id, list))

    return id
  })

  return { resumeId }
}

/**
 * The parts of the account's master copy a resume is snapshotted from: the name
 * and email on `user`, and the contact and skills filed under it.
 *
 * Read together because they are written together — a snapshot taken from two
 * reads a moment apart is a resume that half agrees with the account.
 */
async function readAccountSeed(db: Database, userId: string) {
  const [details, accountContact, skills] = await Promise.all([
    repo.findAccount(db, userId),
    repo.findAccountContact(db, userId),
    repo.findAccountSkills(db, userId)
  ])

  return { details, contact: accountContact, skills }
}

type AccountSeed = Awaited<ReturnType<typeof readAccountSeed>>

/** The account's interface language — what a new resume is written in. */
async function readUserLocale(db: Database, userId: string): Promise<Locale> {
  const account = await repo.findAccount(db, userId)

  return toLocale(account?.locale)
}

/**
 * The contact details and skills a new resume is snapshotted from.
 *
 * Every field is present even when the account has nothing for it: a resume
 * created with a field missing is a field the editor cannot reach, where an
 * empty one is a field the user can fill in.
 */
function seedFrom(account: AccountSeed): Pick<CreateResumeInput, "contact"> {
  const { details, contact: accountContact } = account

  return {
    contact: {
      fullName: `${details?.firstName ?? ""} ${details?.lastName ?? ""}`.trim(),
      email: details?.email ?? "",
      location: accountContact?.location ?? "",
      phone: accountContact?.phone ?? "",
      linkedIn: accountContact?.linkedIn ?? "",
      portfolio: accountContact?.portfolio ?? ""
    }
  }
}

/**
 * The account's master history, as the prompt takes it: serialized, and only
 * the columns that describe what the user did. Ids and positions are ours, not
 * the model's.
 */
async function readHistoryFor(db: Database, userId: string) {
  const [experience, education] = await Promise.all([
    repo.findAccountExperience(db, userId),
    repo.findAccountEducation(db, userId)
  ])

  return {
    experience: JSON.stringify(
      experience.map((job) => ({
        name: job.name,
        title: job.title,
        startDate: job.startDate,
        endDate: job.endDate,
        body: job.body
      }))
    ),
    education: JSON.stringify(
      education.map((entry) => ({
        name: entry.name,
        degree: entry.degree,
        body: entry.body,
        startDate: entry.startDate,
        endDate: entry.endDate,
        gpa: entry.gpa
      }))
    )
  }
}

/**
 * Drafts a resume against a posting, saves it, and hands back where it went.
 *
 * Generating **creates** rather than previews: a draft the user navigated away
 * from used to be simply lost, and the editor spec D built is the one place a
 * resume is edited. The cost is a row for a draft the user dislikes, which is
 * what deleting is for.
 *
 * The history comes off the account here rather than from the client. A
 * generation the caller supplies its own history for is a generation the caller
 * can put anything in — and the resume is snapshotted from the same rows in the
 * same call, so the two cannot disagree about what the user has done.
 */
export async function generate(
  db: Database,
  userId: string,
  input: GenerateInput
) {
  const [account, history] = await Promise.all([
    readAccountSeed(db, userId),
    readHistoryFor(db, userId)
  ])

  // The account's own language, not the one the request came in on: this is
  // the resume's language from here on, and it is what the model is told to
  // write in.
  const language = toLocale(account.details?.locale)

  const drafted = await generateResume({
    profession: account.details?.profession ?? "",
    ...history,
    jobDescription: input.jobDescription,
    language
  })

  // Re-validated rather than trusted: a response that isn't the agreed shape is
  // a typed failure with nothing written, not a half-built resume the user has
  // to find and delete.
  const parsed = generatedResumeSchema.safeParse(drafted)

  if (!parsed.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The model returned a resume we couldn't read. Try again."
    })
  }

  return create(
    db,
    userId,
    {
      ...seedFrom(account),
      profession: parsed.data.profession,
      // The posting travels with the resume: it is what tells one resume from
      // another in the list, and what scoring will score against.
      jobDescription: input.jobDescription,
      experience: parsed.data.experience,
      education: parsed.data.education
    },
    {
      language,
      sections: sections.sectionsFromGeneration(
        parsed.data.sections,
        skillGroupsFrom(account.skills),
        await sectionLabelerFor(language)
      )
    }
  )
}

/** The resume's own copy of the contact details it renders. */
async function writeSnapshot(
  tx: DbOrTx,
  resumeId: string,
  userId: string,
  input: Pick<CreateResumeInput, "contact">
) {
  await repo.insertContact(tx, {
    ...input.contact,
    id: createId(),
    userId,
    resumeId
  })
}

/**
 * Replaces a resume's snapshot with the account's current details.
 *
 * Editing the account deliberately does not reach existing resumes, so this is
 * how a genuinely stale one gets refreshed: on the user's say-so, never
 * silently.
 */
export async function refreshFromAccount(
  db: Database,
  userId: string,
  resumeId: string
) {
  await assertOwnsResume(db, userId, resumeId)

  const account = await readAccountSeed(db, userId)

  const existing = await repo.findSections(db, resumeId)
  const skillsSection = existing.find((row) => row.kind === "skills")

  await db.transaction(async (tx) => {
    await repo.deleteSnapshotContact(tx, resumeId)

    await writeSnapshot(tx, resumeId, userId, seedFrom(account))

    // Only where the resume still has one. Skills is an ordinary section now,
    // so it can be deleted — and re-adding a section the user removed is not a
    // refresh, it is overruling them.
    if (skillsSection) {
      await repo.updateSection(tx, resumeId, skillsSection.id, {
        componentType: "groupedList",
        content: { groups: skillGroupsFrom(account.skills) }
      })
    }
  })

  return { resumeId }
}

const orderedTables = { experience: work, education: school }

const findRows = {
  experience: repo.findExperience,
  education: repo.findEducation
}

/** What a blank row of one list looks like, and how it is inserted. */
type InsertBlankRow = (
  db: DbOrTx,
  row: { id: string; resumeId: string; position: number; userId: string }
) => Promise<unknown>

/**
 * How a blank row of each list is inserted.
 *
 * Blank rather than placeholder text: the row is added because the user is
 * about to type into it, and "Job title" stored as a job title is worse than an
 * empty field the panel shows a placeholder for. The columns are `NOT NULL` and
 * stay so — an empty string is a value, where a half-null row would be a second
 * empty state for every reader to handle.
 *
 * `userId` is carried onto `skill` because that table's rows are filed under
 * the account as well as the resume; `work` and `school` snapshots are not.
 */
const addableRows: Record<RowSectionName, InsertBlankRow> = {
  experience: (db, row) =>
    repo.insertExperience(db, [
      {
        ...row,
        userId: null,
        name: "",
        title: "",
        startDate: "",
        endDate: "",
        body: ""
      }
    ]),

  education: (db, row) =>
    repo.insertEducation(db, [
      {
        ...row,
        userId: null,
        name: "",
        degree: "",
        startDate: "",
        endDate: ""
      }
    ])
}

/**
 * Appends a blank job or school to one of a resume's lists.
 *
 * The position is read from the rows that exist rather than counted, so a list
 * a row was removed from does not hand the next one a position already taken.
 */
export async function addRow(db: Database, userId: string, input: AddRowInput) {
  await assertOwnsResume(db, userId, input.resumeId)

  const table = orderedTables[input.section]
  const position = await repo.nextRowPosition(db, table, input.resumeId)
  const rowId = createId()

  await addableRows[input.section](db, {
    id: rowId,
    resumeId: input.resumeId,
    position,
    userId
  })

  return { rowId }
}

/** Removes one job, school or skill group from a resume. */
export async function removeRow(
  db: Database,
  userId: string,
  input: RemoveRowInput
) {
  await assertOwnsResume(db, userId, input.resumeId)

  const deleted = await repo.deleteSnapshotRow(
    db,
    orderedTables[input.section],
    { resumeId: input.resumeId, rowId: input.rowId }
  )

  if (!deleted.length) throw fieldNotFound()

  return { rowId: input.rowId }
}

/**
 * Sets the resume's typographic direction, and stamps it with the accent that
 * direction currently fixes.
 *
 * The accent is copied rather than referenced so a resume already sent keeps
 * the document it was sent as, even if the style is retuned later.
 */
export async function setStyle(
  db: Database,
  userId: string,
  { resumeId, style }: SetStyleInput
) {
  await assertOwnsResume(db, userId, resumeId)

  await repo.updateResumeStyle(db, resumeId, resumeStyleStamp(style))

  return { style }
}

/**
 * Deletes a resume and everything snapshotted onto it.
 *
 * Generation creates a resume rather than previewing one, so a draft the user
 * dislikes has to be removable — and the rows it owns go with it, in one
 * transaction, rather than being stranded under a resume that no longer exists.
 */
export async function remove(db: Database, userId: string, resumeId: string) {
  await assertOwnsResume(db, userId, resumeId)

  await db.transaction(async (tx) => {
    await repo.deleteResume(tx, resumeId)
  })

  return { resumeId }
}

/**
 * Reorders rows within one section — the jobs in Experience, say.
 *
 * The section table orders sections against each other; this is the order
 * inside one of them, which is why the positions are separate columns.
 *
 * Like a section reorder, this takes the whole list: a partial one would leave
 * the rows it omitted holding positions that now collide, and a collision falls
 * back to the arbitrary id order this replaced.
 */
export async function reorderRows(
  db: Database,
  userId: string,
  input: ReorderRowsInput
) {
  await assertOwnsResume(db, userId, input.resumeId)

  const existing = await findRows[input.section](db, input.resumeId)

  assertCoversExactly(existing, input.rowIds, `row of ${input.section}`)

  const table = orderedTables[input.section]

  await db.transaction(async (tx) => {
    for (const [position, rowId] of input.rowIds.entries()) {
      const updated = await repo.updateRowPosition(tx, table, {
        resumeId: input.resumeId,
        rowId,
        position
      })

      // Scoped to the resume, so a row from another one updates nothing — and
      // the whole reorder is rolled back rather than half-applied.
      if (!updated.length) throw fieldNotFound()
    }
  })

  return { rowIds: input.rowIds }
}

/**
 * Writes one editable string. `path` addresses rows by id
 * (`experience.<id>.body`), so it survives reordering.
 *
 * The grammar and the set of writable columns live in `~/lib/resume-field-path`,
 * shared with the client so the template, the optimistic cache patch and this
 * write can't disagree about what's editable.
 */
export async function updateField(
  db: Database,
  userId: string,
  input: UpdateFieldInput
) {
  await assertOwnsResume(db, userId, input.resumeId)

  const target = parseResumeFieldPath(input.path)

  if (!target) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Not an editable field: ${input.path}`
    })
  }

  await writeTarget(
    db,
    { resumeId: input.resumeId, userId },
    target,
    input.value
  )
}

async function writeTarget(
  db: Database,
  { resumeId, userId }: { resumeId: string; userId: string },
  target: ResumeFieldTarget,
  value: string
) {
  switch (target.section) {
    case "resume":
      await repo.updateResumeColumn(db, resumeId, target.column, value)
      return

    case "contact":
      await writeContact(db, { resumeId, userId }, target.column, value)
      return

    case "section":
      if (target.kind === "label") {
        await sections.writeLabel(db, resumeId, target.row, value)
        return
      }

      await sections.writeContent(
        db,
        resumeId,
        target.row,
        target.content,
        value
      )
      return

    case "education":
      await writeRow(db, school, resumeId, target.row, {
        [target.column]: value
      })

      return

    case "experience":
      await writeRow(db, work, resumeId, target.row, { [target.column]: value })
  }
}

/**
 * Writes one snapshotted row, scoped to the resume as well as the row id — so a
 * row belonging to another resume updates nothing, and nothing is what this
 * reports as a missing field.
 */
async function writeRow<Table extends repo.SnapshotTable>(
  db: DbOrTx,
  table: Table,
  resumeId: string,
  rowId: string,
  values: repo.SnapshotValues<Table>
) {
  const updated = await repo.updateSnapshotColumn(db, table, {
    resumeId,
    rowId,
    values
  })

  if (!updated.length) throw fieldNotFound()
}

/**
 * A resume created before contact was snapshotted has no row to write to, and
 * refusing the edit would leave those fields permanently unreachable.
 *
 * The owner is the session's, not a re-read of the resume: `updateField` has
 * already proved the two match, and falling back to `""` would file the new row
 * under a user that doesn't exist.
 */
async function writeContact(
  db: Database,
  { resumeId, userId }: { resumeId: string; userId: string },
  column: ContactColumn,
  value: string
) {
  const updated = await repo.updateContactColumn(db, resumeId, column, value)

  if (updated.length) return

  await repo.insertContact(db, {
    id: createId(),
    location: "",
    userId,
    resumeId,
    [column]: value
  })
}
