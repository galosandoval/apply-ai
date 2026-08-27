import { and, asc, eq, isNull, sql } from "drizzle-orm"
import { type DbOrTx } from "~/server/db/types"
import { contact, school, skill, user, work } from "~/server/db/schema"

// Data access for the profile aggregate (the user's own row, contact,
// education, experience, skills).
//
// Every query here is the account's **master copy** — the rows a new resume is
// seeded from. `resumeId IS NULL` is what says so: the same tables also hold
// each resume's snapshot of those rows, and without that predicate a profile
// read would collect every resume's copy and a profile write would overwrite
// resumes the user already sent.
//
// Every function takes a `DbOrTx` handle as its first argument so services can
// compose them inside a transaction. Nothing here throws `TRPCError` or reads
// the session — missing rows come back as `null`/`[]` and the service decides
// what that means.

export async function findByUserId(db: DbOrTx, userId: string) {
  const rows = await db.select().from(user).where(eq(user.id, userId))

  return rows[0] ?? null
}

export async function findContact(db: DbOrTx, userId: string) {
  const rows = await db
    .select()
    .from(contact)
    .where(and(eq(contact.userId, userId), isNull(contact.resumeId)))

  return rows[0] ?? null
}

export async function findEducation(db: DbOrTx, userId: string) {
  return db
    .select()
    .from(school)
    .where(and(eq(school.userId, userId), isNull(school.resumeId)))
    .orderBy(asc(school.position), asc(school.id))
}

export async function findExperience(db: DbOrTx, userId: string) {
  return db
    .select()
    .from(work)
    .where(and(eq(work.userId, userId), isNull(work.resumeId)))
    .orderBy(asc(work.position), asc(work.id))
}

export async function findSkills(db: DbOrTx, userId: string) {
  return db
    .select({
      category: skill.category,
      all: skill.all,
      position: skill.position,
      id: skill.id
    })
    .from(skill)
    .where(eq(skill.userId, userId))
    .orderBy(asc(skill.position))
}

type NameAndProfession = {
  firstName: string
  lastName: string
  profession: string
}

export async function updateNameAndProfession(
  db: DbOrTx,
  userId: string,
  values: NameAndProfession
) {
  const rows = await db
    .update(user)
    .set(values)
    .where(eq(user.id, userId))
    .returning()

  return rows[0] ?? null
}

type ProfileDetails = {
  profession?: string
}

export async function updateDetails(
  db: DbOrTx,
  userId: string,
  values: ProfileDetails
) {
  return db.update(user).set(values).where(eq(user.id, userId))
}

type ContactValues = {
  location: string
  phone?: string | null
  linkedIn?: string | null
  portfolio?: string | null
}

export async function updateContact(
  db: DbOrTx,
  userId: string,
  values: ContactValues
) {
  const rows = await db
    .update(contact)
    .set(values)
    .where(and(eq(contact.userId, userId), isNull(contact.resumeId)))
    .returning()

  return rows[0] ?? null
}

export async function insertContact(
  db: DbOrTx,
  values: ContactValues & { id: string; userId: string }
) {
  const rows = await db.insert(contact).values(values).returning()

  return rows[0] ?? null
}

export async function deleteEducation(db: DbOrTx, userId: string) {
  return db
    .delete(school)
    .where(and(eq(school.userId, userId), isNull(school.resumeId)))
}

type SchoolValues = typeof school.$inferInsert

export async function upsertEducation(db: DbOrTx, values: SchoolValues[]) {
  // Drizzle rejects an empty VALUES list, and a user with no degree saving an
  // empty education history is a legal save.
  if (!values.length) return

  return db
    .insert(school)
    .values(values)
    .onConflictDoUpdate({
      target: school.id,
      set: {
        degree: sql`excluded.degree`,
        description: sql`excluded.description`,
        endDate: sql`excluded.end_date`,
        gpa: sql`excluded.gpa`,
        location: sql`excluded.location`,
        name: sql`excluded.name`,
        startDate: sql`excluded.start_date`,
        userId: sql`excluded.user_id`,
        id: sql`excluded.id`
      }
    })
}

export async function deleteExperience(db: DbOrTx, userId: string) {
  return db
    .delete(work)
    .where(and(eq(work.userId, userId), isNull(work.resumeId)))
}

type WorkValues = typeof work.$inferInsert

export async function upsertExperience(db: DbOrTx, values: WorkValues[]) {
  return db
    .insert(work)
    .values(values)
    .onConflictDoUpdate({
      target: work.id,
      set: {
        name: sql`excluded.name`,
        bullets: sql`excluded.bullets`,
        endDate: sql`excluded.end_date`,
        title: sql`excluded.title`,
        startDate: sql`excluded.start_date`,
        userId: sql`excluded.user_id`,
        id: sql`excluded.id`
      }
    })
}

export async function deleteSkills(db: DbOrTx, userId: string) {
  return db.delete(skill).where(eq(skill.userId, userId))
}

type SkillValues = typeof skill.$inferInsert

export async function insertSkills(db: DbOrTx, values: SkillValues[]) {
  // Drizzle rejects an empty VALUES list, and clearing every skill is a legal
  // save.
  if (!values.length) return

  return db.insert(skill).values(values)
}
