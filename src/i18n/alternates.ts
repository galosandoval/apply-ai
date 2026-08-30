import { routing } from "./routing"

/**
 * `hreflang` links for a public path, so search engines index the Spanish page
 * as a translation rather than as duplicate content.
 *
 * Only the three public routes need this — the signed-in app is not indexed,
 * so those pages get a localized title and nothing more.
 */
export function localeAlternates(path: string) {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [
      locale,
      locale === routing.defaultLocale ? path : `/${locale}${path}`
    ])
  )

  return { canonical: path, languages }
}
