import { createId } from "@paralleldrive/cuid2"
import { appRouter } from "~/server/api/root"
import { type TestDatabase } from "~/server/db/test-database"

/**
 * A caller with the session a better-auth cookie would have produced, pointed
 * at the test database.
 *
 * Only `user.id` is read by any procedure, so the rest is the minimum the type
 * wants. `null` builds the signed-out caller the ownership tests ask for.
 *
 * Shared by every router integration test rather than copied into each: three
 * copies of a session literal is three places for "what a caller looks like" to
 * drift from what `createTRPCContext` actually builds.
 */
export function callerFor(db: TestDatabase, userId: string | null) {
  if (!userId) return appRouter.createCaller({ db, session: null })

  const now = new Date()

  return appRouter.createCaller({
    db,
    session: {
      user: {
        id: userId,
        name: "Test User",
        email: `${userId}@test.dev`,
        emailVerified: false,
        image: null,
        createdAt: now,
        updatedAt: now
      },
      session: {
        id: createId(),
        token: createId(),
        userId,
        expiresAt: new Date(now.getTime() + 60_000),
        createdAt: now,
        updatedAt: now
      }
    }
  })
}
