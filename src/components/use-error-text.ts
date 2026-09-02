"use client"

import { type TRPCClientErrorLike } from "@trpc/client"
import { useTranslations } from "next-intl"
import { type AppRouter } from "~/server/api/root"

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

type TranslatedCode = (typeof translatedCodes)[number]

/** A `Set`, because the question asked of it is membership and nothing else. */
const translated = new Set<string>(translatedCodes)

const isTranslated = (code: string | undefined): code is TranslatedCode =>
  translated.has(code ?? "")

/** What went wrong, in the interface's language, for a failed procedure. */
export function useErrorText() {
  const t = useTranslations("errors")

  return (error: TRPCClientErrorLike<AppRouter>): string => {
    const code = error.data?.code

    return isTranslated(code) ? t(code) : error.message
  }
}
