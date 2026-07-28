import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import { type Database, type DbOrTx } from "~/server/db/types"
import * as repo from "./profile.repository"
import {
  type AddEducationInput,
  type AddExperienceInput,
  type ImportFromPdfInput,
  type ReplaceSkillsInput,
  type UpdateDetailsInput,
  type UpsertNameAndContactInput
} from "./profile.schema"
import {
  extractPdfText,
  extractResumeFields,
  type ParsedResume
} from "./resume-pdf"

/**
 * Business rules for the profile aggregate.
 *
 * Services take a `userId` rather than a session, own every ownership check and
 * transaction boundary, and are the only layer that raises `TRPCError`.
 */

const notFound = (message: string) =>
  new TRPCError({ code: "NOT_FOUND", message })

/**
 * Being signed in doesn't imply owning the row the client named, so every id
 * that arrives from input has to be checked before it reaches a `WHERE`.
 *
 * Throws NOT_FOUND rather than FORBIDDEN so callers can't probe which ids exist.
 */
async function assertOwnsProfile(
  db: DbOrTx,
  userId: string,
  profileId: string
) {
  const owned = await repo.findOwnedById(db, profileId, userId)

  if (!owned) throw notFound("Profile not found")
}

/**
 * Ids arrive both at the top level of an input and on each nested row. Every
 * one of them ends up in a `WHERE`, so all of them need checking.
 */
async function assertOwnsEveryProfile(
  db: DbOrTx,
  userId: string,
  ids: (string | null | undefined)[]
) {
  const unique = new Set(ids.filter((id): id is string => !!id))

  for (const id of unique) {
    await assertOwnsProfile(db, userId, id)
  }
}

/** The profile aggregate: profile row plus contact, education, experience, skills. */
export async function read(db: Database, userId: string) {
  const found = await repo.findByUserId(db, userId)

  if (!found) throw notFound("Profile not found")

  const [email, contact, education, experience, skills] = await Promise.all([
    repo.findEmailByUserId(db, userId),
    repo.findContact(db, found.id),
    repo.findEducation(db, found.id),
    repo.findExperience(db, found.id),
    repo.findSkills(db, found.id)
  ])

  return { ...found, email, contact, education, experience, skills }
}

export async function upsertNameAndContact(
  db: Database,
  userId: string,
  input: UpsertNameAndContactInput
) {
  const {
    id: profileId,
    firstName,
    lastName,
    profession,
    linkedIn,
    location,
    phone,
    portfolio
  } = input

  if (!profileId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Profile ID not found"
    })
  }

  await assertOwnsProfile(db, userId, profileId)

  // The name lives on `profile` and the rest on `contact`; a half-applied save
  // would show the user a form that disagrees with itself.
  return db.transaction(async (tx) => {
    const updated = await repo.updateNameAndProfession(tx, profileId, {
      firstName,
      lastName,
      profession
    })

    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Profile not updated"
      })
    }

    const contactValues = { linkedIn, location, phone, portfolio }
    const existing = await repo.findContact(tx, profileId)

    const saved = existing
      ? await repo.updateContact(tx, profileId, contactValues)
      : await repo.insertContact(tx, {
          ...contactValues,
          id: createId(),
          profileId
        })

    if (!saved) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: existing ? "Contact not updated" : "Contact not created"
      })
    }

    return updated
  })
}

export async function updateDetails(
  db: Database,
  userId: string,
  input: UpdateDetailsInput
) {
  const { profession, interests, introduction } = input

  return repo.updateDetails(db, userId, { profession, interests, introduction })
}

/** Replaces the profile's education with `input.education`. */
export async function replaceEducation(
  db: Database,
  userId: string,
  input: AddEducationInput
) {
  const { education, profileId } = input

  await assertOwnsEveryProfile(db, userId, [
    profileId,
    ...education.map((e) => e.profileId)
  ])

  const schoolsToInsert = education.map((e) => ({
    ...e,
    id: e?.id ? e.id : createId(),
    keyAchievements: []
  }))

  return db.transaction(async (tx) => {
    if (profileId) await repo.deleteEducation(tx, profileId)

    return repo.upsertEducation(tx, schoolsToInsert)
  })
}

/** Replaces the profile's work experience with `input.experience`. */
export async function replaceExperience(
  db: Database,
  userId: string,
  input: AddExperienceInput
) {
  const { experience, profileId } = input

  await assertOwnsEveryProfile(db, userId, [
    profileId,
    ...experience.map((e) => e.profileId)
  ])

  const workToInsert = experience.map((e) => ({
    id: e?.id ? e.id : createId(),
    name: e.name,
    description: e.description,
    endDate: e.endDate,
    startDate: e.startDate,
    title: e.title,
    profileId: e.profileId
  }))

  return db.transaction(async (tx) => {
    if (profileId) await repo.deleteExperience(tx, profileId)

    return repo.upsertExperience(tx, workToInsert)
  })
}

/**
 * Fills the profile from an uploaded resume PDF, replacing whatever is already
 * there. The extracted values are deliberately not validated against the strict
 * onboarding schemas — the user reviews and corrects every step afterwards, and
 * a missing GPA shouldn't cost them the whole import.
 */
export async function importFromPdf(
  db: Database,
  userId: string,
  input: ImportFromPdfInput
) {
  const found = await repo.findByUserId(db, userId)

  if (!found) throw notFound("Profile not found")

  // A PDF we can't read is the user's problem to fix (wrong file, a scan); a
  // failed extraction is ours. They need different messages.
  const text = await extractPdfText(
    Buffer.from(input.fileBase64, "base64")
  ).catch((error: unknown) => {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        error instanceof Error
          ? error.message
          : "We couldn't read that PDF. Try a different file."
    })
  })

  const parsed = await extractResumeFields(text).catch(() => {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "We couldn't pull your details out of that resume. Try again."
    })
  })

  await db.transaction((tx) => writeParsedResume(tx, userId, found.id, parsed))

  return {
    experience: parsed.experience.length,
    education: parsed.education.length,
    skills: parsed.skills.length
  }
}

async function writeParsedResume(
  tx: DbOrTx,
  userId: string,
  profileId: string,
  parsed: ParsedResume
) {
  await repo.updateNameAndProfession(tx, profileId, {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    profession: parsed.profession
  })

  await repo.updateDetails(tx, userId, {
    profession: parsed.profession,
    introduction: parsed.introduction
  })

  const contactValues = {
    location: parsed.location,
    phone: parsed.phone,
    linkedIn: parsed.linkedIn,
    portfolio: parsed.portfolio
  }

  const existingContact = await repo.findContact(tx, profileId)

  if (existingContact) {
    await repo.updateContact(tx, profileId, contactValues)
  } else {
    await repo.insertContact(tx, {
      ...contactValues,
      id: createId(),
      profileId
    })
  }

  await repo.deleteExperience(tx, profileId)
  await repo.deleteEducation(tx, profileId)
  await repo.deleteSkills(tx, profileId)

  if (parsed.experience.length) {
    await repo.upsertExperience(
      tx,
      parsed.experience.map((e) => ({ ...e, id: createId(), profileId }))
    )
  }

  if (parsed.education.length) {
    await repo.upsertEducation(
      tx,
      parsed.education.map((e) => ({ ...e, id: createId(), profileId }))
    )
  }

  if (parsed.skills.length) {
    await repo.insertSkills(
      tx,
      parsed.skills.map((s, position) => ({
        ...s,
        position,
        id: createId(),
        profileId
      }))
    )
  }
}

/** Replaces the profile's skills with `input.skills`. */
export async function replaceSkills(
  db: Database,
  userId: string,
  input: ReplaceSkillsInput
) {
  const { skills, profileId } = input

  await assertOwnsProfile(db, userId, profileId)

  await db.transaction(async (tx) => {
    await repo.deleteSkills(tx, profileId)
    await repo.insertSkills(
      tx,
      skills.map((s) => ({ ...s, profileId, id: createId() }))
    )
  })

  return { success: true }
}
