import { and, asc, eq, sql } from "drizzle-orm"
import { type DbOrTx } from "~/server/db/types"
import { contact, profile, school, skill, user, work } from "~/server/db/schema"

/**
 * Data access for the profile aggregate (profile, contact, education,
 * experience, skills).
 *
 * Every function takes a `DbOrTx` handle as its first argument so services can
 * compose them inside a transaction. Nothing here throws `TRPCError` or reads
 * the session — missing rows come back as `null`/`[]` and the service decides
 * what that means.
 */

export async function findByUserId(db: DbOrTx, userId: string) {
  const rows = await db.select().from(profile).where(eq(profile.userId, userId))

  return rows[0] ?? null
}

/** Returns the profile only if it belongs to `userId`. */
export async function findOwnedById(
  db: DbOrTx,
  profileId: string,
  userId: string
) {
  const rows = await db
    .select({ id: profile.id })
    .from(profile)
    .where(and(eq(profile.id, profileId), eq(profile.userId, userId)))

  return rows[0] ?? null
}

export async function findEmailByUserId(db: DbOrTx, userId: string) {
  const rows = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))

  return rows[0]?.email ?? null
}

export async function findContact(db: DbOrTx, profileId: string) {
  const rows = await db
    .select()
    .from(contact)
    .where(eq(contact.profileId, profileId))

  return rows[0] ?? null
}

export async function findEducation(db: DbOrTx, profileId: string) {
  return db.select().from(school).where(eq(school.profileId, profileId))
}

export async function findExperience(db: DbOrTx, profileId: string) {
  return db.select().from(work).where(eq(work.profileId, profileId))
}

export async function findSkills(db: DbOrTx, profileId: string) {
  return db
    .select({
      category: skill.category,
      all: skill.all,
      position: skill.position,
      id: skill.id
    })
    .from(skill)
    .where(eq(skill.profileId, profileId))
    .orderBy(asc(skill.position))
}

type NameAndProfession = {
  firstName: string
  lastName: string
  profession: string
}

export async function updateNameAndProfession(
  db: DbOrTx,
  profileId: string,
  values: NameAndProfession
) {
  const rows = await db
    .update(profile)
    .set(values)
    .where(eq(profile.id, profileId))
    .returning()

  return rows[0] ?? null
}

type ProfileDetails = {
  profession?: string
  interests?: string | null
  introduction?: string | null
}

export async function updateDetails(
  db: DbOrTx,
  userId: string,
  values: ProfileDetails
) {
  return db.update(profile).set(values).where(eq(profile.userId, userId))
}

type ContactValues = {
  location: string
  phone?: string | null
  linkedIn?: string | null
  portfolio?: string | null
}

export async function updateContact(
  db: DbOrTx,
  profileId: string,
  values: ContactValues
) {
  const rows = await db
    .update(contact)
    .set(values)
    .where(eq(contact.profileId, profileId))
    .returning()

  return rows[0] ?? null
}

export async function insertContact(
  db: DbOrTx,
  values: ContactValues & { id: string; profileId: string }
) {
  const rows = await db.insert(contact).values(values).returning()

  return rows[0] ?? null
}

export async function deleteEducation(db: DbOrTx, profileId: string) {
  return db.delete(school).where(eq(school.profileId, profileId))
}

type SchoolValues = typeof school.$inferInsert

export async function upsertEducation(db: DbOrTx, values: SchoolValues[]) {
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
        profileId: sql`excluded.profile_id`,
        id: sql`excluded.id`
      }
    })
}

export async function deleteExperience(db: DbOrTx, profileId: string) {
  return db.delete(work).where(eq(work.profileId, profileId))
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
        description: sql`excluded.description`,
        endDate: sql`excluded.end_date`,
        title: sql`excluded.title`,
        startDate: sql`excluded.start_date`,
        profileId: sql`excluded.profile_id`,
        id: sql`excluded.id`
      }
    })
}

export async function deleteSkills(db: DbOrTx, profileId: string) {
  return db.delete(skill).where(eq(skill.profileId, profileId))
}

type SkillValues = typeof skill.$inferInsert

export async function insertSkills(db: DbOrTx, values: SkillValues[]) {
  // Drizzle rejects an empty VALUES list, and clearing every skill is a legal
  // save.
  if (!values.length) return

  return db.insert(skill).values(values)
}
