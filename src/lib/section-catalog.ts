/**
 * The named sections a user can add, and which shape each one draws as.
 *
 * A section type is a *configuration* of a shape, never a renderer of its own —
 * so this catalog is data, not code: an entry is an id, a shape and a pair of
 * message keys. Adding "Patents" costs one entry and no rendering, no schema
 * and no migration.
 *
 * It lives on the client on purpose. The server takes a label and a shape and
 * validates both; it has no opinion about which pairs a picker offers, so a
 * catalog the server enforced would be a second, weaker copy of the shape
 * registry. What a section *is* stays in `section-content.ts`.
 *
 * The label and the hint are copy, so they are not here — they live under
 * `sectionCatalog` in the message files, keyed by these ids, and
 * `searchSectionCatalog` resolves them. The id is the stable thing: it keys the
 * picker, the tests, and the label a new section is written with.
 *
 * `text` is the base entry — a title and rich text, nothing else — and it is
 * first in the first group because it is the answer whenever no other entry
 * fits.
 */

import { type SectionComponentType } from "./section-content"

export type SectionPreset = {
  /** Stable id. Keys the picker, the tests, and the `sectionCatalog` messages. */
  id: string
  componentType: SectionComponentType
}

export type SectionPresetGroup = {
  id: string
  presets: SectionPreset[]
}

/** A preset with its copy resolved — what the picker actually draws. */
export type DisplaySectionPreset = SectionPreset & {
  /** The heading the section starts with. Editable afterwards, like any label. */
  label: string
  /** What the entry is for, in the picker. One line, no period. */
  hint: string
}

export type DisplaySectionPresetGroup = {
  id: string
  title: string
  presets: DisplaySectionPreset[]
}

/** The `t` from `useTranslations("sectionCatalog")`. */
export type SectionCatalogTranslate = (key: string) => string

export const sectionCatalog: SectionPresetGroup[] = [
  {
    id: "writing",
    presets: [
      { id: "text", componentType: "richText" },
      { id: "summary", componentType: "richText" },
      { id: "objective", componentType: "richText" },
      { id: "goal", componentType: "richText" },
      { id: "additional", componentType: "richText" }
    ]
  },
  {
    id: "work",
    presets: [
      { id: "projects", componentType: "twoColumn" },
      { id: "achievements", componentType: "list" },
      { id: "publications", componentType: "list" },
      { id: "patents", componentType: "list" },
      { id: "speaking", componentType: "twoColumn" },
      { id: "volunteering", componentType: "twoColumn" },
      { id: "extracurriculars", componentType: "twoColumn" }
    ]
  },
  {
    id: "credentials",
    presets: [
      { id: "certificates", componentType: "twoColumn" },
      { id: "licenses", componentType: "twoColumn" },
      { id: "awards", componentType: "twoColumn" },
      { id: "courses", componentType: "twoColumn" },
      { id: "memberships", componentType: "twoColumn" },
      { id: "conferences", componentType: "twoColumn" },
      { id: "military", componentType: "twoColumn" }
    ]
  },
  {
    id: "skills",
    presets: [
      { id: "tools", componentType: "tagList" },
      { id: "languages", componentType: "meter" },
      { id: "graphs", componentType: "meter" }
    ]
  },
  {
    id: "personal",
    presets: [
      { id: "hobbies", componentType: "tagList" },
      { id: "interests", componentType: "tagList" },
      { id: "socialMedia", componentType: "iconList" },
      { id: "portfolio", componentType: "iconList" },
      { id: "references", componentType: "twoColumn" }
    ]
  }
]

/** Every preset, flat — for searching, and for tests that check the set. */
export const sectionPresets: SectionPreset[] = sectionCatalog.flatMap(
  (group) => group.presets
)

/**
 * The catalog filtered by what has been typed, groups and all.
 *
 * Matching is on the *translated* label and hint together, so "bar" finds
 * Graphs and "link" finds Portfolio — a picker that only matched titles would
 * hide the entry whose title the user does not yet know, and one that matched
 * the English ids would not match what is on screen at all.
 *
 * Empty groups are dropped rather than drawn empty: a heading with nothing
 * under it reads as a section that failed to load.
 */
export function searchSectionCatalog(
  query: string,
  t: SectionCatalogTranslate
): DisplaySectionPresetGroup[] {
  const needle = query.trim().toLowerCase()

  return sectionCatalog
    .map((group) => ({
      id: group.id,
      title: t(`groups.${group.id}`),
      presets: group.presets
        .map((preset) => ({
          ...preset,
          label: t(`presets.${preset.id}.label`),
          hint: t(`presets.${preset.id}.hint`)
        }))
        .filter(
          (preset) =>
            !needle ||
            `${preset.label} ${preset.hint}`.toLowerCase().includes(needle)
        )
    }))
    .filter((group) => group.presets.length > 0)
}
