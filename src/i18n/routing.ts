import { hasLocale } from "next-intl"
import { defineRouting } from "next-intl/routing"

/**
 * The locales the app ships in, and how they appear in the URL.
 *
 * `as-needed` keeps English on its existing unprefixed paths — every link
 * already in the wild stays valid — and puts Spanish under `/es`. Spanish is
 * `es` rather than `es-419` because there is no Castilian build to distinguish
 * it from; the LatAm register is a convention of the message files, not a tag.
 */
export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  localePrefix: "as-needed"
})

export type Locale = (typeof routing.locales)[number]

/**
 * A stored language tag as one of the locales the app ships.
 *
 * `user.locale` and `resume.language` are `text` columns, so that adding a
 * locale is a deploy and not a migration — which means every read of one has
 * to answer this question. Answering it here, once, at the boundary, is what
 * lets everything downstream take a `Locale` and carry no fallback of its own:
 * a per-locale table typed `Record<Locale, T>` is exhaustive, so the next
 * locale is a compile error at each table rather than a silent English answer
 * in production.
 */
export function toLocale(value: string | null | undefined): Locale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale
}
