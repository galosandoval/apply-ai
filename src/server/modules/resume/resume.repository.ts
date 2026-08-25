import { and, asc, eq, isNull, sql } from "drizzle-orm"
import { type PgUpdateSetSource } from "drizzle-orm/pg-core"
import { type ContactColumn, type ResumeColumn } from "~/lib/resume-field-path"
import { type ResumeStyleStamp } from "~/lib/resume-style"
import { type DbOrTx } from "~/server/db/types"
import {
  contact,
  resume,
  school,
  section,
  skill,
  user,
  work
} from "~/server/db/schema"

// Data access for the resume aggregate: the resume row, its sections, and the
// `work` / `school` / `skill` / `contact` rows snapshotted onto it.
//
// A resume owns every row it renders. Nothing here reads the account's master
// copy except `findAccount*`, which exists only to seed a snapshot — see
// `resume.service`.
//
// Every function takes a `DbOrTx` so services can compose them in one
// transaction, and returns `null` / `[]` rather than throwing.

/**
 * The snapshotted row tables, and the columns of one of them.
 *
 * `SnapshotValues` is what keeps a write honest: a `work` column cannot be set
 * on a `school` row, because the table decides which keys the values may carry.
 */
export type SnapshotTable = typeof work | typeof school | typeof skill

export type SnapshotValues<Table extends SnapshotTable> =
  PgUpdateSetSource<Table>

export async function findResume(db: DbOrTx, resumeId: string) {
  const rows = await db.select().from(resume).where(eq(resume.id, resumeId))

  return rows[0] ?? null
}

export async function listResumes(db: DbOrTx, userId: string) {
  return db
    .select({
      id: resume.id,
      createdAt: resume.createdAt,
      profession: resume.profession,
      jobDescription: resume.jobDescription
    })
    .from(resume)
    .where(eq(resume.userId, userId))
    .orderBy(asc(resume.createdAt))
}

export async function insertResume(
  db: DbOrTx,
  values: typeof resume.$inferInsert
) {
  const rows = await db.insert(resume).values(values).returning()

  return rows[0] ?? null
}

/**
 * The style and the accent it fixed, written together.
 *
 * One update because a `ResumeStyleStamp` is one decision: a row holding a
 * style with another style's accent is a document nobody chose.
 */
export async function updateResumeStyle(
  db: DbOrTx,
  resumeId: string,
  stamp: ResumeStyleStamp
) {
  return db.update(resume).set(stamp).where(eq(resume.id, resumeId))
}

export async function updateResumeColumn(
  db: DbOrTx,
  resumeId: string,
  column: ResumeColumn,
  value: string
) {
  return db
    .update(resume)
    .set({ [column]: value })
    .where(eq(resume.id, resumeId))
}

/**
 * Snapshotted rows in render order.
 *
 * `position` decides it now; `id` only breaks ties, so rows that shared the
 * pre-migration default still come back in a stable order.
 */
export async function findExperience(db: DbOrTx, resumeId: string) {
  return db
    .select()
    .from(work)
    .where(eq(work.resumeId, resumeId))
    .orderBy(asc(work.position), asc(work.id))
}

export async function findEducation(db: DbOrTx, resumeId: string) {
  return db
    .select()
    .from(school)
    .where(eq(school.resumeId, resumeId))
    .orderBy(asc(school.position), asc(school.id))
}

export async function findSkills(db: DbOrTx, resumeId: string) {
  return db
    .select()
    .from(skill)
    .where(eq(skill.resumeId, resumeId))
    .orderBy(asc(skill.position), asc(skill.id))
}

export async function findContact(db: DbOrTx, resumeId: string) {
  const rows = await db
    .select()
    .from(contact)
    .where(eq(contact.resumeId, resumeId))

  return rows[0] ?? null
}

export async function findSections(db: DbOrTx, resumeId: string) {
  return db
    .select()
    .from(section)
    .where(eq(section.resumeId, resumeId))
    .orderBy(asc(section.position), asc(section.id))
}

export async function findSection(
  db: DbOrTx,
  resumeId: string,
  sectionId: string
) {
  const rows = await db
    .select()
    .from(section)
    .where(and(eq(section.id, sectionId), eq(section.resumeId, resumeId)))

  return rows[0] ?? null
}

export async function insertSections(
  db: DbOrTx,
  values: (typeof section.$inferInsert)[]
) {
  if (!values.length) return []

  return db.insert(section).values(values).returning()
}

export async function deleteSection(
  db: DbOrTx,
  resumeId: string,
  sectionId: string
) {
  return db
    .delete(section)
    .where(and(eq(section.id, sectionId), eq(section.resumeId, resumeId)))
    .returning({ id: section.id })
}

export async function updateSection(
  db: DbOrTx,
  resumeId: string,
  sectionId: string,
  values: Partial<typeof section.$inferInsert>
) {
  return db
    .update(section)
    .set(values)
    .where(and(eq(section.id, sectionId), eq(section.resumeId, resumeId)))
    .returning({ id: section.id })
}

export async function insertExperience(
  db: DbOrTx,
  values: (typeof work.$inferInsert)[]
) {
  if (!values.length) return []

  return db.insert(work).values(values).returning({ id: work.id })
}

export async function insertEducation(
  db: DbOrTx,
  values: (typeof school.$inferInsert)[]
) {
  if (!values.length) return []

  return db.insert(school).values(values).returning({ id: school.id })
}

export async function insertSkills(
  db: DbOrTx,
  values: (typeof skill.$inferInsert)[]
) {
  if (!values.length) return []

  return db.insert(skill).values(values).returning({ id: skill.id })
}

/**
 * Writes one column of a snapshotted row.
 *
 * Scoping the write to `resumeId` as well as the row id is what stops a caller
 * editing another resume's rows through a resume they do own.
 */
export async function updateSnapshotColumn<Table extends SnapshotTable>(
  db: DbOrTx,
  table: Table,
  {
    resumeId,
    rowId,
    values
  }: {
    resumeId: string
    rowId: string
    values: SnapshotValues<Table>
  }
) {
  return db
    .update(table)
    .set(values)
    .where(and(eq(table.id, rowId), eq(table.resumeId, resumeId)))
    .returning({ id: table.id })
}

export async function updateRowPosition(
  db: DbOrTx,
  table: SnapshotTable,
  {
    resumeId,
    rowId,
    position
  }: { resumeId: string; rowId: string; position: number }
) {
  return db
    .update(table)
    .set({ position })
    .where(and(eq(table.id, rowId), eq(table.resumeId, resumeId)))
    .returning({ id: table.id })
}

/**
 * Deletes one snapshotted row, scoped to the resume as well as the row id — so
 * a row belonging to another resume deletes nothing, and nothing is what the
 * service reports as a missing row.
 */
export async function deleteSnapshotRow<Table extends SnapshotTable>(
  db: DbOrTx,
  table: Table,
  { resumeId, rowId }: { resumeId: string; rowId: string }
) {
  return db
    .delete(table)
    .where(and(eq(table.id, rowId), eq(table.resumeId, resumeId)))
    .returning({ id: table.id })
}

/**
 * The next free `position` in one of a resume's row lists.
 *
 * Read rather than counted: removing a row leaves a gap, and a count would hand
 * the next row a position another row already holds.
 */
export async function nextRowPosition(
  db: DbOrTx,
  table: SnapshotTable,
  resumeId: string
) {
  const rows = await db
    .select({ max: sql<number | null>`max(${table.position})` })
    .from(table)
    .where(eq(table.resumeId, resumeId))

  return (rows[0]?.max ?? -1) + 1
}

/**
 * Deletes a resume, and every row snapshotted onto it.
 *
 * `section` cascades from the resume; `work`, `school`, `skill` and `contact`
 * do not — a nullable `resumeId` is also how a master copy is spelled, so the
 * foreign key cannot carry the delete. They are cleaned up here instead, in one
 * transaction, or the rows would outlive the only thing that referenced them.
 */
export async function deleteResume(db: DbOrTx, resumeId: string) {
  await db.delete(work).where(eq(work.resumeId, resumeId))
  await db.delete(school).where(eq(school.resumeId, resumeId))
  await db.delete(skill).where(eq(skill.resumeId, resumeId))
  await db.delete(contact).where(eq(contact.resumeId, resumeId))

  return db
    .delete(resume)
    .where(eq(resume.id, resumeId))
    .returning({ id: resume.id })
}

export async function deleteSnapshotSkills(db: DbOrTx, resumeId: string) {
  return db.delete(skill).where(eq(skill.resumeId, resumeId))
}

export async function deleteSnapshotContact(db: DbOrTx, resumeId: string) {
  return db.delete(contact).where(eq(contact.resumeId, resumeId))
}

export async function insertContact(
  db: DbOrTx,
  values: typeof contact.$inferInsert
) {
  const rows = await db.insert(contact).values(values).returning()

  return rows[0] ?? null
}

export async function updateContactColumn(
  db: DbOrTx,
  resumeId: string,
  column: ContactColumn,
  value: string
) {
  return db
    .update(contact)
    .set({ [column]: value })
    .where(eq(contact.resumeId, resumeId))
    .returning({ id: contact.id })
}

/**
 * The account's master copies, read only to seed a new snapshot.
 *
 * `resumeId IS NULL` is what separates a master row from a resume's copy of it;
 * without it, seeding a resume would pick up every other resume's snapshot.
 */
export async function findAccount(db: DbOrTx, userId: string) {
  const rows = await db
    .select({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profession: user.profession
    })
    .from(user)
    .where(eq(user.id, userId))

  return rows[0] ?? null
}

export async function findJobBullets(
  db: DbOrTx,
  resumeId: string,
  rowId: string
) {
  const rows = await db
    .select({ bullets: work.bullets })
    .from(work)
    .where(and(eq(work.id, rowId), eq(work.resumeId, resumeId)))

  return rows[0] ?? null
}

export async function findAccountSkills(db: DbOrTx, userId: string) {
  return db
    .select()
    .from(skill)
    .where(and(eq(skill.userId, userId), isNull(skill.resumeId)))
    .orderBy(asc(skill.position), asc(skill.id))
}

/**
 * The account's master work history — the rows onboarding and the import write,
 * which is what a generation is drafted from. `resumeId IS NULL` again: a
 * resume's own snapshot is not part of the history it was written from.
 */
export async function findAccountExperience(db: DbOrTx, userId: string) {
  return db
    .select()
    .from(work)
    .where(and(eq(work.userId, userId), isNull(work.resumeId)))
    .orderBy(asc(work.position), asc(work.id))
}

export async function findAccountEducation(db: DbOrTx, userId: string) {
  return db
    .select()
    .from(school)
    .where(and(eq(school.userId, userId), isNull(school.resumeId)))
    .orderBy(asc(school.position), asc(school.id))
}

export async function findAccountContact(db: DbOrTx, userId: string) {
  const rows = await db
    .select()
    .from(contact)
    .where(and(eq(contact.userId, userId), isNull(contact.resumeId)))

  return rows[0] ?? null
}

/** The next free `position` on a resume's sections. */
export async function nextSectionPosition(db: DbOrTx, resumeId: string) {
  const rows = await db
    .select({ max: sql<number | null>`max(${section.position})` })
    .from(section)
    .where(eq(section.resumeId, resumeId))

  return (rows[0]?.max ?? -1) + 1
}
