import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { routing } from "./routing"

type Messages = Record<string, unknown>

/** Named formats, so a date reads the same wherever it is rendered. */
const formats = {
  dateTime: {
    long: { dateStyle: "long" }
  }
} as const

/** Walks a dotted message path (`onboarding.import.title`) into the tree. */
function lookup(messages: Messages, path: string) {
  const value = path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        typeof node === "object" && node !== null
          ? (node as Messages)[key]
          : undefined,
      messages
    )

  return typeof value === "string" ? value : undefined
}

/**
 * Resolves the messages for a request. Called once per server render, so the
 * dictionary is loaded on the server and only the strings a client component
 * actually reads are serialized down.
 *
 * There is no CI check that `es.json` covers every key in `en.json`, so a gap
 * is a matter of when, not if. In production a missing key falls back to the
 * English string — one English label in a Spanish page is survivable, a raw
 * `resume.panel.empty.cta` on screen is not. The miss is still logged either
 * way, so gaps show up in the server logs rather than vanishing. In
 * development the raw key renders too, so the gap gets noticed while it is
 * still cheap to close. Run `npm run check:messages` to find them all at once.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  const messages = (await import(`../../messages/${locale}.json`))
    .default as Messages

  const isDev = process.env.NODE_ENV === "development"

  if (isDev || locale === routing.defaultLocale) {
    return { locale, messages, formats }
  }

  const fallback = (await import(`../../messages/en.json`)).default as Messages

  return {
    locale,
    messages,
    formats,
    getMessageFallback: ({ namespace, key }) => {
      const path = [namespace, key].filter(Boolean).join(".")

      return lookup(fallback, path) ?? path
    }
  }
})
