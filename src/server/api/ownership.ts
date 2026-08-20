import { TRPCError } from "@trpc/server"
import { and, eq } from "drizzle-orm"
import { type db } from "~/server/db"
import { resume } from "~/server/db/schema"

type Database = typeof db

/**
 * `protectedProcedure` proves the caller is signed in, not that they own the
 * row they named. Any procedure that accepts an id from the client must assert
 * ownership before reading or writing it.
 *
 * There is one ownership concept now: rows belong to a user. `assertOwnsProfile`
 * is gone with the `profile` table — a profile id whose only legal value was
 * "the one this session owns" was a check against a value the client should
 * never have been sending.
 *
 * Throws NOT_FOUND rather than FORBIDDEN so a caller can't probe which ids exist.
 */

/** Throws unless `resumeId` belongs to `userId`. */
export async function assertOwnsResume(
  database: Database,
  userId: string,
  resumeId: string
) {
  const found = await database
    .select({ id: resume.id })
    .from(resume)
    .where(and(eq(resume.id, resumeId), eq(resume.userId, userId)))

  if (!found.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Resume not found" })
  }
}
