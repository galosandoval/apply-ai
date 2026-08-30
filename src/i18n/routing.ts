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
