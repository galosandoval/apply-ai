import { and, asc, eq, isNull, sql } from "drizzle-orm"
import { type PgUpdateSetSource } from "drizzle-orm/pg-core"
import { type Locale, toLocale } from "~/i18n/routing"
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
export type SnapshotTable = typeof work | typeof school

export type SnapshotValues<Table extends SnapshotTable> =
  PgUpdateSetSource<Table>

export async function findResume(db: DbOrTx, resumeId: string) {
  const rows = await db.select().from(resume).where(eq(resume.id, resumeId))

  return rows[0] ?? null
}

/**
 * The language the resume is written in, for the headings written into it.
 *
 * Its own read rather than a column off `findResume`: a caller that needs the
 * language is not loading a resume, and the default locale for a row that has
 * vanished is the same answer the column's default gives.
 *
 * Narrowed to a `Locale` here, at the read, so no caller downstream has to
 * decide what an unshipped tag in a `text` column means.
 */
export async function findResumeLanguage(
  db: DbOrTx,
  resumeId: string
): Promise<Locale> {
  const rows = await db
    .select({ language: resume.language })
    .from(resume)
    .where(eq(resume.id, resumeId))

  return toLocale(rows[0]?.language)
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

export async function findContact(db: DbOrTx, resumeId: string) {
  const rows = await db
    .select()
    .from(contact)
    .where(eq(contact.resumeId, resumeId))

  return rows[0] ?? null
}

/**
 * Which owner's sections a read or a write is about.
 *
 * A section belongs to a resume or to the account, never to both — the two
 * spellings of that are the two members here, so no caller can build a query
 * that asks for a row with an ambiguous owner. The check constraint that makes
 * the same thing true of the table is #96.
 */
export type SectionOwner = { resumeId: string } | { userId: string }

/**
 * The `WHERE` that scopes every section query to one owner.
 *
 * The account's own sections are spelled `resume_id IS NULL` as well, like the
 * master rows in `work`, `school` and `contact`: without it an account would
 * read every snapshot its resumes hold.
 *
 * Scoping to the owner rather than to the section id alone is what makes a
 * section id from somewhere else *find nothing* instead of being edited.
 */
function ownedBy(owner: SectionOwner) {
  return "resumeId" in owner
    ? eq(section.resumeId, owner.resumeId)
    : and(eq(section.userId, owner.userId), isNull(section.resumeId))
}

export async function findSections(db: DbOrTx, owner: SectionOwner) {
  return db
    .select()
    .from(section)
    .where(ownedBy(owner))
    .orderBy(asc(section.position), asc(section.id))
}

export async function findSection(
  db: DbOrTx,
  owner: SectionOwner,
  sectionId: string
) {
  const rows = await db
    .select()
    .from(section)
    .where(and(eq(section.id, sectionId), ownedBy(owner)))

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
  owner: SectionOwner,
  sectionId: string
) {
  return db
    .delete(section)
    .where(and(eq(section.id, sectionId), ownedBy(owner)))
    .returning({ id: section.id })
}

export async function updateSection(
  db: DbOrTx,
  owner: SectionOwner,
  sectionId: string,
  values: Partial<typeof section.$inferInsert>
) {
  return db
    .update(section)
    .set(values)
    .where(and(eq(section.id, sectionId), ownedBy(owner)))
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
 * The snapshot tables — `section`, `work`, `school` and `contact` — all cascade
 * from `resumeId`, so this one statement is the whole delete. A master copy is
 * spelled with `resumeId` null, which no cascade from a resume can reach, so it
 * survives untouched.
 */
export async function deleteResume(db: DbOrTx, resumeId: string) {
  return db
    .delete(resume)
    .where(eq(resume.id, resumeId))
    .returning({ id: resume.id })
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
      profession: user.profession,
      locale: user.locale
    })
    .from(user)
    .where(eq(user.id, userId))

  return rows[0] ?? null
}

/**
 * The language the account writes in — the headings a section of *its* own is
 * created with, where a resume's come from `resume.language`.
 *
 * Narrowed here, like `findResumeLanguage`, so no caller downstream has to
 * decide what an unshipped tag in a `text` column means.
 */
export async function findAccountLanguage(
  db: DbOrTx,
  userId: string
): Promise<Locale> {
  const rows = await db
    .select({ locale: user.locale })
    .from(user)
    .where(eq(user.id, userId))

  return toLocale(rows[0]?.locale)
}

export async function findAccountSkills(db: DbOrTx, userId: string) {
  return db
    .select()
    .from(skill)
    .where(eq(skill.userId, userId))
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

/** The next free `position` on one owner's sections. */
export async function nextSectionPosition(db: DbOrTx, owner: SectionOwner) {
  const rows = await db
    .select({ max: sql<number | null>`max(${section.position})` })
    .from(section)
    .where(ownedBy(owner))

  return (rows[0]?.max ?? -1) + 1
}
