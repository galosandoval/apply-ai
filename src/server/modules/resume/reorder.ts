import { TRPCError } from "@trpc/server"

/**
 * Refuses a reorder that isn't a permutation of what's already there.
 *
 * Both reorders — sections against each other, and rows within one — rewrite
 * every position from the list they're given. A list that repeats an id or
 * omits one would leave positions colliding, and a collision falls back to the
 * arbitrary id order the position columns were added to replace.
 */
export function assertCoversExactly(
  existing: { id: string }[],
  ids: string[],
  what: string
) {
  const given = new Set(ids)

  if (
    given.size !== ids.length ||
    given.size !== existing.length ||
    existing.some((row) => !given.has(row.id))
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Reorder must list every ${what} exactly once`
    })
  }
}
