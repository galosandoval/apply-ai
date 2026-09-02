import { createId } from "@paralleldrive/cuid2"
import { TRPCError } from "@trpc/server"
import { type Database, type DbOrTx } from "~/server/db/types"
import * as repo from "./profile.repository"
import {
  type AddEducationInput,
  type AddExperienceInput,
  type ImportFromPdfInput,
  type ReplaceSkillsInput,
  type SetLocaleInput,
  type UpdateDetailsInput,
  type UpsertNameAndContactInput
} from "./profile.schema"
import {
  extractPdfText,
  extractResumeFields,
  type ParsedResume
} from "./parse-resume-pdf"

// Business rules for the profile aggregate.
//
// Services take a `userId` rather than a session, own every transaction
// boundary, and are the only layer that raises `TRPCError`.
//
// There are no ownership checks left here. Every row the profile owns is keyed
// by `userId`, and `userId` comes from the session — so a client cannot name a
// row it doesn't own, rather than naming one and being told no.

const notFound = (message: string) =>
  new TRPCError({ code: "NOT_FOUND", message })

/** The profile aggregate: the user's row plus contact, education, experience, skills. */
export async function read(db: Database, userId: string) {
  const found = await repo.findByUserId(db, userId)

  if (!found) throw notFound("User not found")

  const [contact, education, experience, skills] = await Promise.all([
    repo.findContact(db, userId),
    repo.findEducation(db, userId),
    repo.findExperience(db, userId),
    repo.findSkills(db, userId)
  ])

  return { ...found, contact, education, experience, skills }
}

export async function upsertNameAndContact(
  db: Database,
  userId: string,
  input: UpsertNameAndContactInput
) {
  const {
    firstName,
    lastName,
    profession,
    linkedIn,
    location,
    phone,
    portfolio
  } = input

  // The name lives on `user` and the rest on `contact`; a half-applied save
  // would show the user a form that disagrees with itself.
  return db.transaction(async (tx) => {
    const updated = await repo.updateNameAndProfession(tx, userId, {
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
    const existing = await repo.findContact(tx, userId)

    const saved = existing
      ? await repo.updateContact(tx, userId, contactValues)
      : await repo.insertContact(tx, {
          ...contactValues,
          id: createId(),
          userId
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
  return repo.updateDetails(db, userId, { profession: input.profession })
}

/**
 * Records the language the account reads the app in.
 *
 * Only the interface: resumes already written keep their own `language`, so
 * switching never retitles a document that has been sent. New resumes are
 * written in whatever this last recorded.
 */
export async function setLocale(
  db: Database,
  userId: string,
  input: SetLocaleInput
) {
  return repo.updateLocale(db, userId, input.locale)
}

/** Replaces the profile's education with `input.education`. */
export async function replaceEducation(
  db: Database,
  userId: string,
  input: AddEducationInput
) {
  const schoolsToInsert = input.education.map((e, position) => ({
    ...e,
    id: e.id ?? createId(),
    position,
    userId
  }))

  return db.transaction(async (tx) => {
    await repo.deleteEducation(tx, userId)

    return repo.upsertEducation(tx, schoolsToInsert)
  })
}

/** Replaces the profile's work experience with `input.experience`. */
export async function replaceExperience(
  db: Database,
  userId: string,
  input: AddExperienceInput
) {
  const workToInsert = input.experience.map((e, position) => ({
    id: e.id ?? createId(),
    position,
    name: e.name,
    bullets: e.bullets,
    endDate: e.endDate,
    startDate: e.startDate,
    title: e.title,
    userId
  }))

  return db.transaction(async (tx) => {
    await repo.deleteExperience(tx, userId)

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

  await db.transaction((tx) => writeParsedResume(tx, userId, parsed))

  return {
    experience: parsed.experience.length,
    education: parsed.education.length,
    skills: parsed.skills.length
  }
}

async function writeParsedResume(
  tx: DbOrTx,
  userId: string,
  parsed: ParsedResume
) {
  await repo.updateNameAndProfession(tx, userId, {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    profession: parsed.profession
  })

  const contactValues = {
    location: parsed.location,
    phone: parsed.phone,
    linkedIn: parsed.linkedIn,
    portfolio: parsed.portfolio
  }

  const existingContact = await repo.findContact(tx, userId)

  if (existingContact) {
    await repo.updateContact(tx, userId, contactValues)
  } else {
    await repo.insertContact(tx, {
      ...contactValues,
      id: createId(),
      userId
    })
  }

  await repo.deleteExperience(tx, userId)
  await repo.deleteEducation(tx, userId)
  await repo.deleteSkills(tx, userId)

  if (parsed.experience.length) {
    await repo.upsertExperience(
      tx,
      parsed.experience.map((e, position) => ({
        ...e,
        id: createId(),
        position,
        userId
      }))
    )
  }

  if (parsed.education.length) {
    await repo.upsertEducation(
      tx,
      parsed.education.map((e, position) => ({
        ...e,
        id: createId(),
        position,
        userId
      }))
    )
  }

  if (parsed.skills.length) {
    await repo.insertSkills(
      tx,
      parsed.skills.map((s, position) => ({
        ...s,
        position,
        id: createId(),
        userId
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
  await db.transaction(async (tx) => {
    await repo.deleteSkills(tx, userId)
    await repo.insertSkills(
      tx,
      // Reuse the id the form sent back so a skill keeps its identity across
      // saves; this delete-and-reinsert would otherwise mint a new one each time.
      input.skills.map((s) => ({ ...s, userId, id: s.id ?? createId() }))
    )
  })

  return { success: true }
}
