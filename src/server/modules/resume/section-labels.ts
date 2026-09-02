/**
 * The headings a section is written with, in the language of the resume it
 * belongs to.
 *
 * A section's `label` is a stored string, not a key resolved at render time —
 * the user renames it, and a renamed heading cannot be looked up again. So the
 * language question is settled once, on write, and this is where. What is
 * translated is keyed by the stable thing: a section's `kind`, a generated
 * section's kind, or a catalog preset's id.
 *
 * The messages are read here rather than through `next-intl`'s server API
 * because this runs inside a tRPC procedure, where the *request's* locale is
 * not the answer: a resume is written in `resume.language`, whoever happens to
 * be looking at it in whichever interface language.
 */

import { hasLocale } from "next-intl"
import { routing } from "~/i18n/routing"

type Messages = Record<string, unknown>

/** Walks a dotted message path into the tree, or `undefined` if it isn't one. */
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

async function readMessages(locale: string) {
  return (await import(`../../../../messages/${locale}.json`))
    .default as Messages
}

/**
 * Resolves one heading from a message path.
 *
 * Returns `null` for a path neither language has, which is how an unknown
 * preset id is told apart from a translated one — the caller keeps whatever
 * the client displayed rather than writing a raw key onto the resume.
 */
export type SectionLabeler = (path: string) => string | null

/**
 * A labeler for one resume's language, with the same English fallback the UI
 * has: a heading in the wrong language is survivable, a `sectionLabels.skills`
 * on a document someone sends out is not.
 */
export async function sectionLabelerFor(
  language: string
): Promise<SectionLabeler> {
  const locale = hasLocale(routing.locales, language)
    ? language
    : routing.defaultLocale

  const [messages, english] = await Promise.all([
    readMessages(locale),
    locale === routing.defaultLocale
      ? Promise.resolve(null)
      : readMessages(routing.defaultLocale)
  ])

  return (path) =>
    lookup(messages, path) ?? (english ? lookup(english, path) : null) ?? null
}

/** The heading a core or generated section is created with. */
export const sectionLabelPath = (kind: string) => `sectionLabels.${kind}`

/** The heading a section added from the catalog picker is created with. */
export const presetLabelPath = (presetId: string) =>
  `sectionCatalog.presets.${presetId}.label`
