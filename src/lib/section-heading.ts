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
 * the *translated* preset text — the same `catalogPresets` pairs the picker's
 * own search reads, through the same normalizer — so a Spanish resume's
 * "Pasatiempos" finds the same preset an English resume's "Hobbies" does, with
 * no second table of synonyms to keep in step with the catalog.
 *
 * Two things never happen here. A heading is never dropped: one that matches
 * nothing still becomes a section, shaped by what its content looks like. And a
 * heading is never translated — the label a section is written with is the
 * user's text, not app copy, and a matched preset contributes its shape and its
 * id, never its wording.
 */

import {
  catalogPresets,
  matchableText,
  normalizeCatalogText,
  type SectionCatalogTranslate,
  type SectionPreset
} from "./section-catalog"
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
  presetId: SectionPreset["id"] | null
  kind: SectionKind
  componentType: SectionComponentType
  content: AnySectionContent
}

/**
 * The catalog key whose title is the word for skills in the user's language.
 *
 * A *group* title rather than a preset's label, because there is no Skills
 * preset to borrow one from: skills is the one heading that resolves to a
 * *kind*. It is content-bearing like any custom section, and a kind of its own
 * only so that it can still be found — a resume refreshed from the account has
 * to know which section its skills go back into, and a label the user is free
 * to rename cannot answer that. It is provenance, not storage, and it has no
 * preset because the picker does not offer a second Skills.
 */
const skillsHeadingKey = "groups.skills"

type Candidate = {
  presetId: SectionPreset["id"] | null
  kind: SectionKind
  componentType: SectionComponentType
  /** Normalized label — what an exact or qualifying match compares with. */
  label: string
  /** Normalized label, hint and aliases together — the widest match. */
  text: string
}

/**
 * Resolves one imported heading onto a preset id, a component type and a
 * content value.
 *
 * Pure: everything it knows arrives in its arguments, and `t` is the catalog
 * translator the picker already uses (`useTranslations("sectionCatalog")`, or
 * the resume-language labeler on the server) — so the language a heading is
 * matched against is the language that translator speaks.
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
  t: SectionCatalogTranslate
): ResolvedSection {
  const match = matchHeading(heading, t)
  const readings = toReadings(content)
  const componentType = match?.componentType ?? fallbackComponentType(readings)

  return {
    label: heading,
    presetId: match?.presetId ?? null,
    kind: match?.kind ?? "custom",
    componentType,
    content: contentBuilders[componentType](readings)
  }
}

/**
 * How a heading may match a candidate, in the order the rules are tried.
 *
 * Exact first, so "Languages" is the preset called Languages rather than
 * whatever else mentions the word. Then a candidate whose name the heading
 * qualifies ("Technical Skills"), then a shared stem, which is what carries a
 * document's "Certifications" onto the catalog's "Certificates" across a
 * suffix neither language spells the same way. The candidate's whole text is
 * tried last and is the widest: it is where a heading the catalog calls
 * something else — a "Profile" that is a Summary — is caught by the alias the
 * catalog records for it.
 */
const matchRules: ((heading: string, candidate: Candidate) => boolean)[] = [
  (heading, candidate) => heading === candidate.label,
  (heading, candidate) => containsWord(heading, candidate.label),
  (heading, candidate) => shareStem(heading, candidate.label),
  (heading, candidate) => containsWord(candidate.text, heading)
]

function matchHeading(heading: string, t: SectionCatalogTranslate) {
  const needle = normalizeCatalogText(heading)

  if (!needle) return null

  const candidates = candidatesFor(t)

  for (const rule of matchRules) {
    const match = candidates.find((candidate) => rule(needle, candidate))

    if (match) return match
  }

  return null
}

/** Every name a heading can match, skills before the presets, in catalog order. */
function candidatesFor(t: SectionCatalogTranslate): Candidate[] {
  const skills = normalizeCatalogText(t(skillsHeadingKey))

  return [
    {
      presetId: null,
      kind: "skills" as const,
      componentType: "groupedList" as const,
      label: skills,
      text: skills
    },
    ...catalogPresets(t).map((preset) => ({
      presetId: preset.id,
      kind: "custom" as const,
      componentType: preset.componentType,
      label: normalizeCatalogText(preset.label),
      text: normalizeCatalogText(matchableText(preset))
    }))
  ].filter((candidate) => candidate.label)
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
 * Both readings of the imported content, because a component needs whichever it
 * draws: a list handed prose still has to become items, and rich text handed
 * entries still has to become a paragraph. They travel together because every
 * builder below may want either.
 */
type ImportedReadings = {
  entries: string[]
  prose: string
  /** Which reading the document actually gave — the one the fallback trusts. */
  fromProse: boolean
}

function toReadings(content: ImportedSectionContent): ImportedReadings {
  const lines =
    content.type === "entries" ? content.entries : content.text.split(/\r?\n/)
  const entries = lines
    .map((line) => line.replace(/^\s*[-*•·]\s+/, "").trim())
    .filter(Boolean)

  return {
    entries,
    prose:
      content.type === "prose"
        ? content.text.trim()
        : entries.map((entry) => `- ${entry}`).join("\n"),
    fromProse: content.type === "prose"
  }
}

/**
 * The shape an unmatched heading's content gives it.
 *
 * Read off the content because it is the only evidence left: a run of dates is
 * a two-column section whatever it is called, and a handful of short strings is
 * a row of tags. A section with nothing under it — a heading the user is about
 * to write into — is rich text, the shape that holds anything.
 *
 * *Most* entries dated rather than all of them: a real credentials list has the
 * one line whose year the document never printed, and letting that single line
 * flatten the whole section into tags would lose every date beside it.
 */
function fallbackComponentType({
  entries,
  fromProse
}: ImportedReadings): SectionComponentType {
  if (fromProse || !entries.length) return "richText"

  const dated = entries.filter((entry) => splitDated(entry).right).length

  if (dated * 2 > entries.length) return "twoColumn"

  return entries.every(isShort) ? "tagList" : "list"
}

/**
 * Short enough to read at a glance, which is what a tag is.
 *
 * The test for punctuation is a *sentence break* — a stop followed by a space —
 * rather than the mark itself: "Node.js" is a tag and so is "Chess.", while
 * "Shipped it. Twice." is two sentences and belongs in a list.
 */
const isShort = (entry: string) =>
  entry.length <= 32 && entry.split(/\s+/).length <= 4 && !/[.;:]\s/.test(entry)

/**
 * Each component's content, built from the same pair of readings.
 *
 * One entry per shape, beside each other, for the reason `sectionComponents` is
 * one registry: an eighth shape is an entry here, not a case hidden in a switch
 * somebody has to find.
 */
const contentBuilders: {
  [Type in SectionComponentType]: (
    readings: ImportedReadings
  ) => SectionContent[Type]
} = {
  richText: ({ prose }) => ({ markdown: prose }),
  list: ({ entries }) => ({ items: entries }),
  tagList: ({ entries }) => ({
    tags: entries.flatMap(splitSegments).flatMap(fromItemLine)
  }),
  twoColumn: ({ entries }) => ({ rows: entries.map(splitDated) }),
  iconList: ({ entries }) => ({
    // The document has no icon in it — the text is what it said, and the icon
    // is the user's to pick from the panel.
    icons: entries.map((text) => ({ icon: "", text }))
  }),
  meter: ({ entries }) => ({
    // A resume writes "Fluent", not "80". The neutral level a new meter starts
    // at is the honest reading of that, and the user moves it.
    meters: entries.map((entry) => ({
      label: nameBeforeLevel(entry),
      level: neutralMeterLevel
    }))
  }),
  groupedList: ({ entries }) => ({
    groups: toGroups(entries.flatMap(splitSegments))
  })
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
 * Up to two words may come with the year, because a document introduces a date
 * as well as writing one — "Issued Mar 2024" is the date column whole, and
 * leaving "Issued" behind would strand a word that means nothing without it.
 *
 * A line with no year keeps the whole of itself on the left. An empty right
 * column is a column the user fills in, where text moved into it because it sat
 * after a dash would be a claim the document never made.
 */
const dateTail = /[\s,;:|·—–-]*\(?((?:\p{L}+\.?\s+){0,2}\d{4}\b.*)$/u

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
