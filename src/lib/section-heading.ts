/**
 * What an imported heading draws as.
 *
 * A resume PDF arrives as headings and text under them. The extraction returns
 * exactly that — the user's own words, in the document's own language — and
 * never a component type: a model picking a shape is a model making a layout
 * decision with no knowledge of what the components can render, which is the
 * same rule the generation allowlist enforces for the same reason.
 *
 * So the decision is made here, from data the app already has. Matching is on
 * the *translated* preset labels and hints — the pairs `searchSectionCatalog`
 * already searches — so a Spanish resume's "Pasatiempos" finds the same preset
 * an English resume's "Hobbies" does, with no second table of synonyms to keep
 * in step with the catalog.
 *
 * Two things never happen here. A heading is never dropped: one that matches
 * nothing still becomes a section, shaped by what its content looks like. And a
 * heading is never translated — the label a section is written with is the
 * user's text, not app copy, and a matched preset contributes its shape and its
 * id, never its wording.
 */

import { sectionPresets, type SectionCatalogTranslate } from "./section-catalog"
import {
  fromItemLine,
  neutralMeterLevel,
  type AnySectionContent,
  type SectionComponentType,
  type SectionContent,
  type SectionKind
} from "./section-content"

/**
 * A section as the extraction hands it over: a run of entries, or a block of
 * prose. Which one a document gives is a fact about the document, not a choice
 * about the section — the shape is decided below, from both.
 */
export type ImportedSectionContent =
  { type: "prose"; text: string } | { type: "entries"; entries: string[] }

export type ResolvedSection = {
  /** The heading, exactly as the document wrote it. */
  label: string
  /** The catalog preset the heading matched, or `null` when none did. */
  presetId: string | null
  kind: SectionKind
  componentType: SectionComponentType
  content: AnySectionContent
}

/**
 * The catalog key whose title is the word for skills in the user's language —
 * the same string `sectionLabels.skills` writes a section with.
 *
 * Skills is the one heading that resolves to a *kind* rather than a preset. It
 * is content-bearing like any custom section, and a kind of its own only so
 * that it can still be found: a resume refreshed from the account has to know
 * which section its skills go back into, and a label the user is free to rename
 * cannot answer that. It is provenance, not storage — and it has no preset,
 * because the picker does not offer a second Skills.
 */
const skillsHeadingKey = "groups.skills"

type Candidate = {
  presetId: string | null
  kind: SectionKind
  componentType: SectionComponentType
  /** Normalized label and hint — what the heading is actually compared with. */
  label: string
  hint: string
}

/**
 * Resolves one imported heading onto a preset id, a component type and a
 * content value.
 *
 * Pure: everything it knows arrives in its arguments, and `t` is the catalog
 * translator the picker already uses (`useTranslations("sectionCatalog")`, or
 * the resume-language labeler on the server).
 *
 * More than one translator may be given, and each is tried in turn. A document
 * is not written in its reader's language — a Spanish CV uploaded from an
 * English session is an ordinary import, not an edge case — so the caller
 * passes the languages worth trying, most likely first, and a heading matches
 * in whichever of them wrote it.
 *
 * The section resolved from one heading is the whole answer. Two headings that
 * both name skills — "Technical Skills" and "Soft Skills" — therefore both come
 * back with the skills kind, because neither is wrong on its own; keeping one
 * of them as the account's is the writer's call, made where the sibling
 * sections are visible.
 */
export function resolveSectionHeading(
  heading: string,
  content: ImportedSectionContent,
  t: SectionCatalogTranslate | SectionCatalogTranslate[]
): ResolvedSection {
  const match = matchHeading(heading, Array.isArray(t) ? t : [t])
  const entries = toEntries(content)
  const componentType =
    match?.componentType ?? fallbackComponentType(content, entries)

  return {
    label: heading,
    presetId: match?.presetId ?? null,
    kind: match?.kind ?? "custom",
    componentType,
    content: buildContent(componentType, entries, toProse(content, entries))
  }
}

/**
 * How a heading may match a candidate, in the order the rules are tried.
 *
 * Exact first, so "Languages" is the preset called Languages rather than
 * whatever else mentions the word. Then a candidate whose name the heading
 * qualifies ("Technical Skills"), then a shared stem, which is what carries a
 * document's "Certifications" onto the catalog's "Certificates" across a
 * suffix neither language spells the same way. The hint is tried last and is
 * the widest: it is where a heading the catalog calls something else — a
 * "Profile" that is a Summary — is caught, and it is the same label-and-hint
 * text the picker's own search reads.
 */
const matchRules: ((heading: string, candidate: Candidate) => boolean)[] = [
  (heading, candidate) => heading === candidate.label,
  (heading, candidate) => containsWord(heading, candidate.label),
  (heading, candidate) => shareStem(heading, candidate.label),
  (heading, candidate) =>
    containsWord(`${candidate.label} ${candidate.hint}`, heading)
]

function matchHeading(heading: string, translators: SectionCatalogTranslate[]) {
  const needle = normalize(heading)

  if (!needle) return null

  const candidates = translators.flatMap(candidatesFor)

  for (const rule of matchRules) {
    const match = candidates.find((candidate) => rule(needle, candidate))

    if (match) return match
  }

  return null
}

/** Every name a heading can match, skills before the presets, in catalog order. */
function candidatesFor(t: SectionCatalogTranslate): Candidate[] {
  return [
    {
      presetId: null,
      kind: "skills" as const,
      componentType: "groupedList" as const,
      label: normalize(t(skillsHeadingKey)),
      hint: ""
    },
    ...sectionPresets.map((preset) => ({
      presetId: preset.id,
      kind: "custom" as const,
      componentType: preset.componentType,
      label: normalize(t(`presets.${preset.id}.label`)),
      hint: normalize(t(`presets.${preset.id}.hint`))
    }))
  ].filter((candidate) => candidate.label)
}

/**
 * A heading reduced to the letters and digits in it: lowercase, unaccented, and
 * with punctuation and runs of space flattened to single spaces.
 *
 * Accents are stripped rather than compared because a document's heading is
 * typed by a person — "Formacion" is the same heading as "Formación", and a
 * match that turned on the tilde would send one of them to rich text.
 */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

/** True when `needle` appears in `haystack` as whole words. */
function containsWord(haystack: string, needle: string) {
  return Boolean(needle) && ` ${haystack} `.includes(` ${needle} `)
}

/**
 * True when two single words start with the same six letters.
 *
 * Six rather than four: "interests" and "internships" agree on four and are not
 * the same section, while every pair worth catching — certificates and
 * certifications, publications and publishing — agrees on more.
 */
function shareStem(heading: string, label: string) {
  const shortest = Math.min(heading.length, label.length)

  if (heading.includes(" ") || label.includes(" ") || shortest < 6) return false

  return heading.slice(0, 6) === label.slice(0, 6)
}

/**
 * The shape an unmatched heading's content gives it.
 *
 * Read off the content because it is the only evidence left: a run of dates is
 * a two-column section whatever it is called, and a handful of short strings is
 * a row of tags. Prose — and a section with nothing under it, which is a
 * heading the user is about to write into — is rich text, the shape that holds
 * anything.
 */
function fallbackComponentType(
  content: ImportedSectionContent,
  entries: string[]
): SectionComponentType {
  if (content.type === "prose" || !entries.length) return "richText"

  if (entries.every((entry) => splitDated(entry).right)) return "twoColumn"

  return entries.every(isShort) ? "tagList" : "list"
}

/** Short enough to read at a glance, which is what a tag is. */
const isShort = (entry: string) =>
  entry.length <= 32 && entry.split(/\s+/).length <= 4 && !/[.;:]/.test(entry)

/**
 * Both readings of the imported content, because a component needs whichever
 * it draws: a list handed prose still has to become items, and rich text handed
 * entries still has to become a paragraph.
 */
function toEntries(content: ImportedSectionContent) {
  const lines =
    content.type === "entries" ? content.entries : content.text.split(/\r?\n/)

  return lines
    .map((line) => line.replace(/^\s*[-*•·]\s+/, "").trim())
    .filter(Boolean)
}

function toProse(content: ImportedSectionContent, entries: string[]) {
  return content.type === "prose"
    ? content.text.trim()
    : entries.map((entry) => `- ${entry}`).join("\n")
}

/**
 * Each component's content, built from the same pair of readings.
 *
 * One entry per shape, beside each other, for the reason `sectionComponents` is
 * one registry: an eighth shape is an entry here, not a case hidden in a switch
 * somebody has to find.
 */
const contentBuilders: {
  [Type in SectionComponentType]: (
    entries: string[],
    prose: string
  ) => SectionContent[Type]
} = {
  richText: (_entries, prose) => ({ markdown: prose }),
  list: (entries) => ({ items: entries }),
  tagList: (entries) => ({
    tags: entries.flatMap(splitSegments).flatMap(fromItemLine)
  }),
  twoColumn: (entries) => ({ rows: entries.map(splitDated) }),
  iconList: (entries) => ({
    // The document has no icon in it — the text is what it said, and the icon
    // is the user's to pick from the panel.
    icons: entries.map((text) => ({ icon: "", text }))
  }),
  meter: (entries) => ({
    // A resume writes "Fluent", not "80". The neutral level a new meter starts
    // at is the honest reading of that, and the user moves it.
    meters: entries.map((entry) => ({
      label: nameBeforeLevel(entry),
      level: neutralMeterLevel
    }))
  }),
  groupedList: (entries) => ({
    groups: toGroups(entries.flatMap(splitSegments))
  })
}

function buildContent(
  componentType: SectionComponentType,
  entries: string[],
  prose: string
): AnySectionContent {
  const build = contentBuilders[componentType] as (
    entries: string[],
    prose: string
  ) => AnySectionContent

  return build(entries, prose)
}

/**
 * The name on a levelled line — "Spanish" out of "Spanish — Native".
 *
 * The word after the separator is thrown away rather than read: a document's
 * word for a level is prose, and mapping "Native" onto a number would be this
 * module inventing a claim the resume never made. The level is neutral and the
 * name is what the user recognises when they come to move it.
 */
const nameBeforeLevel = (entry: string) =>
  // A bare hyphen only separates when it stands alone: "Front-end" is one name,
  // and "Spanish - Native" is a name and a level.
  entry.split(/\s*[—–|:(]\s*|\s+-\s+/)[0]?.trim() ?? entry

/**
 * A dated line as its two columns: what happened, and when.
 *
 * The cut is made at a *year* rather than at a separator, because the separator
 * is whatever the document's designer liked and the year is the part that means
 * something. It is the **first** year, and everything from there is the date
 * column: a credential that says "Issued Mar 2024, Expires Mar 2027" has one
 * date column with two dates in it, not a second date stranded in its title.
 *
 * A line with no year keeps the whole of itself on the left. An empty right
 * column is a column the user fills in, where text moved into it because it sat
 * after a dash would be a claim the document never made.
 */
const dateTail = /[\s,;:|·—–-]*\(?((?:\p{L}+\.?\s+)?\d{4}\b.*)$/u

/**
 * The same date, written first: "2024 — AWS Certified Developer".
 *
 * A range here may only close on another year, never on a word: "Present" is a
 * word, and so is the first word of every title a dash separates from its date.
 */
const dateHead =
  /^\(?((?:\p{L}+\.?\s+)?\d{4}(?:\s*[-–—]\s*(?:\p{L}+\.?\s+)?\d{4})?)\)?[\s,;:|·—–-]+(\p{L}.*)$/u

function splitDated(entry: string) {
  const head = dateHead.exec(entry)

  if (head?.[1] && head[2]) {
    return { left: head[2].trim(), right: trimDate(head[1]) }
  }

  const tail = dateTail.exec(entry)
  const left = entry.slice(0, tail?.index).trim()

  return left && tail?.[1]
    ? { left, right: trimDate(tail[1]) }
    : { left: entry, right: "" }
}

/** The date as the document wrote it, without the bracket it was wrapped in. */
const trimDate = (date: string) => date.trim().replace(/\)$/, "")

/**
 * The groups a run of skills lines writes: a category, a colon, and the short
 * names under it.
 *
 * A line with no category is not dropped and not invented a name for — it joins
 * the unlabelled group, which is what the editor draws as a plain row of items.
 * *Joins*, rather than starting one of its own: a document that writes one skill
 * per line is writing a list of skills, and a group per skill would be a page of
 * empty headings.
 */
function toGroups(segments: string[]) {
  const groups: { label: string; items: string[] }[] = []

  for (const segment of segments) {
    const [head, ...rest] = segment.split(":")
    const previous = groups.at(-1)

    if (rest.length) {
      groups.push({
        label: head?.trim() ?? "",
        items: fromItemLine(rest.join(":"))
      })
    } else if (previous && !previous.label) {
      previous.items.push(...fromItemLine(segment))
    } else {
      groups.push({ label: "", items: fromItemLine(segment) })
    }
  }

  return groups
}

/**
 * One imported line cut into the things it lists.
 *
 * A document separates with more than a comma — a semicolon between two skill
 * groups, a bullet or a pipe between two tags — and those are the document's
 * marks, not the panel's. The comma stays `fromItemLine`'s, so what the editor
 * splits and what the import splits cannot disagree about a trailing comma.
 */
const splitSegments = (line: string) =>
  line
    .split(/[;•|]/)
    .map((segment) => segment.trim())
    .filter(Boolean)
