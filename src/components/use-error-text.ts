"use client"

import { useTranslations } from "next-intl"

/**
 * The tRPC codes a user can actually cause, and so the ones worth translating.
 *
 * The same shape as the better-auth mapping in `auth-modal`: a code we know
 * gets our copy, and anything else falls back to the message the server sent.
 * A `TRPCError`'s message is a diagnostic written for whoever reads the logs —
 * translating those instead would mean keeping a Spanish copy of every string
 * the server throws, and rewriting one would silently change what a log says.
 */
const translatedCodes = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "TIMEOUT",
  "TOO_MANY_REQUESTS",
  "INTERNAL_SERVER_ERROR"
] as const

/** What went wrong, in the interface's language, for a failed procedure. */
export function useErrorText() {
  const t = useTranslations("errors")

  return (error: {
    message: string
    data?: { code?: string } | null
  }): string => {
    const code = translatedCodes.find((known) => known === error.data?.code)

    return code ? t(code) : error.message
  }
}
