import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"
import { type db } from "~/server/db"
import { profile, resume } from "~/server/db/schema"

type Database = typeof db

/**
 * `protectedProcedure` proves the caller is signed in, not that they own the
 * row they named. Any procedure that accepts an id from the client must assert
 * ownership before reading or writing it.
 *
 * These throw NOT_FOUND rather than FORBIDDEN so a caller can't probe which ids
 * exist.
 */

/** Throws unless `profileId` belongs to `userId`. */
export async function assertOwnsProfile(
  database: Database,
  userId: string,
  profileId: string
) {
  const found = await database
    .select({ id: profile.id })
    .from(profile)
    .where(and(eq(profile.id, profileId), eq(profile.userId, userId)))

  if (!found.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" })
  }
}

/** Throws unless `resumeId` belongs to a profile owned by `userId`. */
export async function assertOwnsResume(
  database: Database,
  userId: string,
  resumeId: string
) {
  const found = await database
    .select({ id: resume.id })
    .from(resume)
    .innerJoin(profile, eq(resume.profileId, profile.id))
    .where(and(eq(resume.id, resumeId), eq(profile.userId, userId)))

  if (!found.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Resume not found" })
  }
}
