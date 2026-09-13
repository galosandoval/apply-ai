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

import { type SectionCatalogTranslate } from "~/lib/section-catalog"
import { type Locale, routing } from "~/i18n/routing"

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

async function readMessages(locale: Locale) {
  return (await import(`../../../../messages/${locale}.json`))
    .default as Messages
}

/**
 * Resolves one heading from a message path, falling back to what the caller
 * would otherwise have written.
 *
 * The fallback is a required argument rather than a `null` return every caller
 * remembers to handle: there is no call site that can do anything useful with
 * "no heading", and a path neither language has is how an unknown preset id
 * arrives — the caller keeps whatever the client displayed rather than writing
 * a raw key onto the resume.
 */
export type SectionLabeler = (path: string, fallback: string) => string

/**
 * A labeler for one resume's language, with the same English fallback the UI
 * has: a heading in the wrong language is survivable, a `sectionLabels.skills`
 * on a document someone sends out is not.
 */
export async function sectionLabelerFor(
  language: Locale
): Promise<SectionLabeler> {
  return labelerFrom(await messageReaderFor(language))
}

const labelerFrom =
  (read: MessageReader): SectionLabeler =>
  (path, fallback) =>
    read(path) ?? fallback

type MessageReader = (path: string) => string | undefined

/**
 * One message path in a language, or in English, or nowhere.
 *
 * English stands in per *path* rather than per file: the message files are kept
 * in step, so the only strings legitimately missing from one are the optional
 * ones — and a caller asking for one of those wants to know it is absent, not
 * to be handed the key.
 */
async function messageReaderFor(language: Locale): Promise<MessageReader> {
  const [messages, english] = await Promise.all([
    readMessages(language),
    language === routing.defaultLocale
      ? Promise.resolve(null)
      : readMessages(routing.defaultLocale)
  ])

  return (path: string) =>
    lookup(messages, path) ?? (english ? lookup(english, path) : undefined)
}

/** The heading a core or generated section is created with. */
export const sectionLabelPath = (kind: string) => `sectionLabels.${kind}`

/** The heading a section added from the catalog picker is created with. */
export const presetLabelPath = (presetId: string) =>
  `sectionCatalog.presets.${presetId}.label`

/**
 * The catalog translator, for a server caller that has to *match* copy rather
 * than write it.
 *
 * `SectionLabeler` cannot do this job: it takes a fallback and has no `has`, so
 * a missing alias would come back as whatever the caller passed instead of as
 * absent. This is the shape `useTranslations("sectionCatalog")` has, built over
 * the same message files, so `resolveSectionHeading` matches an imported
 * heading against exactly the copy the picker shows.
 *
 * Missing keys resolve to the empty string rather than to the key, so a preset
 * the messages have not caught up with contributes nothing to a match instead
 * of matching the word "presets".
 */
export async function sectionCatalogTranslatorFor(
  language: Locale
): Promise<SectionCatalogTranslate> {
  return catalogTranslatorFrom(await messageReaderFor(language))
}

function catalogTranslatorFrom(read: MessageReader): SectionCatalogTranslate {
  const at = (key: string) => read(`sectionCatalog.${key}`)

  const translate = (key: string) => at(key) ?? ""

  translate.has = (key: string) => at(key) !== undefined

  return translate
}

/**
 * Both halves of one resume's language: the labeler that *writes* a heading,
 * and the catalog translator that *matches* one.
 *
 * One value rather than two arguments travelling side by side. They are not
 * independent — both are built from the same `Locale`, and a caller resolving
 * them separately can pass a labeler for one language beside a catalog for
 * another, which would write a Spanish heading and then fail to recognise it.
 * Asking for both costs what asking for one did: the message files are read
 * once and both halves are built over that read.
 */
export type SectionLanguage = {
  label: SectionLabeler
  catalog: SectionCatalogTranslate
}

export async function sectionLanguageFor(
  language: Locale
): Promise<SectionLanguage> {
  const read = await messageReaderFor(language)

  return { label: labelerFrom(read), catalog: catalogTranslatorFrom(read) }
}
