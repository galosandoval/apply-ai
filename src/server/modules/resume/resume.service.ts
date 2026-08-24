import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import {
  type ContactColumn,
  parseResumeFieldPath,
  type ResumeFieldTarget
} from "~/lib/resume-field-path"
import { assertOwnsResume } from "~/server/api/ownership"
import { school, work, skill } from "~/server/db/schema"
import { type Database, type DbOrTx } from "~/server/db/types"
import { assertCoversExactly } from "./reorder"
import * as repo from "./resume.repository"
import {
  type AddRowInput,
  type CreateResumeInput,
  type RemoveRowInput,
  type ReorderRowsInput,
  type RowSectionName,
  type SetBulletsInput,
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

/**
 * Skills are one row per group in the database and one comma-separated line on
 * the page. The document is the contract, so the split and the join both live
 * here rather than in two places that could disagree.
 */
const toSkillLine = (entries: string[]) => entries.join(", ")

const fromSkillLine = (line: string) =>
  line
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)

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

  const [experience, education, skills, contact, sectionRows] =
    await Promise.all([
      repo.findExperience(db, resumeId),
      repo.findEducation(db, resumeId),
      repo.findSkills(db, resumeId),
      repo.findContact(db, resumeId),
      repo.findSections(db, resumeId)
    ])

  return {
    ...found,
    experience,
    education,
    skill: skills.map((group) => ({
      id: group.id,
      category: group.category,
      all: toSkillLine(group.all)
    })),
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
 * Creates a resume from a draft, snapshotting everything it renders.
 *
 * One transaction: a resume that saved its jobs but not its skills would render
 * as a document with a section silently missing.
 */
export async function create(
  db: Database,
  userId: string,
  input: CreateResumeInput
) {
  const resumeId = await db.transaction(async (tx) => {
    const created = await repo.insertResume(tx, {
      id: createId(),
      profession: input.profession,
      jobDescription: input.jobDescription,
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
    await repo.insertSections(tx, sections.coreSections(id))

    return id
  })

  return { resumeId }
}

/** The resume's own copy of the skills and contact details it renders. */
async function writeSnapshot(
  tx: DbOrTx,
  resumeId: string,
  userId: string,
  input: Pick<CreateResumeInput, "skill" | "contact">
) {
  await repo.insertSkills(
    tx,
    input.skill.map((group, position) => ({
      id: createId(),
      category: group.category,
      all: fromSkillLine(group.all),
      position,
      userId,
      resumeId
    }))
  )

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

  const [accountSkills, accountContact, account] = await Promise.all([
    repo.findAccountSkills(db, userId),
    repo.findAccountContact(db, userId),
    repo.findAccount(db, userId)
  ])

  await db.transaction(async (tx) => {
    await repo.deleteSnapshotSkills(tx, resumeId)
    await repo.deleteSnapshotContact(tx, resumeId)

    await writeSnapshot(tx, resumeId, userId, {
      skill: accountSkills.map((group) => ({
        category: group.category,
        all: toSkillLine(group.all)
      })),
      contact: {
        fullName:
          `${account?.firstName ?? ""} ${account?.lastName ?? ""}`.trim(),
        email: account?.email ?? "",
        location: accountContact?.location ?? "",
        phone: accountContact?.phone ?? "",
        linkedIn: accountContact?.linkedIn ?? "",
        portfolio: accountContact?.portfolio ?? ""
      }
    })
  })

  return { resumeId }
}

const orderedTables = { experience: work, education: school, skills: skill }

const findRows = {
  experience: repo.findExperience,
  education: repo.findEducation,
  skills: repo.findSkills
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
        bullets: []
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
    ]),

  skills: (db, row) =>
    repo.insertSkills(db, [{ ...row, category: "", all: [] }])
}

/**
 * Appends a blank job, school or skill group to one of a resume's lists.
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
 * Replaces a job's whole bullet list — how a bullet is added, removed or moved.
 *
 * `updateField` rewrites one bullet that already exists and cannot change how
 * many there are; taking the array wholesale also means a reorder never leaves
 * an index pointing at a different bullet than the one the user moved.
 */
export async function setBullets(
  db: Database,
  userId: string,
  input: SetBulletsInput
) {
  await assertOwnsResume(db, userId, input.resumeId)

  await writeRow(db, work, input.resumeId, input.rowId, {
    bullets: input.bullets
  })

  return { rowId: input.rowId }
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
 * (`experience.<id>.bullets.2`), so it survives reordering.
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

    case "skill":
      await writeRow(
        db,
        skill,
        resumeId,
        target.row,
        // `all` is one line on the page and one row per entry in the database.
        target.column === "all"
          ? { all: fromSkillLine(value) }
          : { category: value }
      )

      return

    case "education":
      await writeRow(db, school, resumeId, target.row, {
        [target.column]: value
      })

      return

    case "experience":
      if (target.kind === "bullet") {
        await updateBullet(db, {
          resumeId,
          rowId: target.row,
          bulletIndex: target.bulletIndex,
          value
        })

        return
      }

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

/**
 * Replaces one entry of a job's `bullets` array.
 *
 * Postgres can assign to an array subscript directly, but assigning past the
 * end silently pads the array with NULLs — so the current value is read and
 * bounds-checked inside a transaction rather than written blind.
 */
async function updateBullet(
  db: Database,
  {
    resumeId,
    rowId,
    bulletIndex,
    value
  }: { resumeId: string; rowId: string; bulletIndex: number; value: string }
) {
  await db.transaction(async (tx) => {
    const found = await repo.findJobBullets(tx, resumeId, rowId)

    if (!found || bulletIndex >= found.bullets.length) throw fieldNotFound()

    const bullets = found.bullets.map((bullet, index) =>
      index === bulletIndex ? value : bullet
    )

    await writeRow(tx, work, resumeId, rowId, { bullets })
  })
}
