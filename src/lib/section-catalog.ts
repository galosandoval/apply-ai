/**
 * The named sections a user can add, and which shape each one draws as.
 *
 * A section type is a *configuration* of a shape, never a renderer of its own —
 * so this catalog is data, not code: an entry is a label, a shape and a line of
 * help. Adding "Patents" costs one entry and no rendering, no schema and no
 * migration.
 *
 * It lives on the client on purpose. The server takes a label and a shape and
 * validates both; it has no opinion about which pairs a picker offers, so a
 * catalog the server enforced would be a second, weaker copy of the shape
 * registry. What a section *is* stays in `section-content.ts`.
 *
 * `text` is the base entry — a title and rich text, nothing else — and it is
 * first in the first group because it is the answer whenever no other entry
 * fits.
 */

import { type SectionComponentType } from "./section-content"

export type SectionPreset = {
  /** Stable id, for the picker's keys and for tests. Never stored. */
  id: string
  /** The heading the section starts with. Editable afterwards, like any label. */
  label: string
  componentType: SectionComponentType
  /** What the entry is for, in the picker. One line, no period. */
  hint: string
}

export type SectionPresetGroup = {
  title: string
  presets: SectionPreset[]
}

export const sectionCatalog: SectionPresetGroup[] = [
  {
    title: "Writing",
    presets: [
      {
        id: "text",
        label: "Text",
        componentType: "richText",
        hint: "A title and rich text — the plain one"
      },
      {
        id: "summary",
        label: "Summary",
        componentType: "richText",
        hint: "A short opening paragraph"
      },
      {
        id: "objective",
        label: "Objective",
        componentType: "richText",
        hint: "What you are looking for"
      },
      {
        id: "goal",
        label: "Goal",
        componentType: "richText",
        hint: "What you are working toward"
      },
      {
        id: "additional",
        label: "Additional information",
        componentType: "richText",
        hint: "Anything that fits nowhere else"
      }
    ]
  },
  {
    title: "Work",
    presets: [
      {
        id: "projects",
        label: "Projects",
        componentType: "twoColumn",
        hint: "What you built, and when"
      },
      {
        id: "achievements",
        label: "Achievements",
        componentType: "list",
        hint: "Results worth their own section"
      },
      {
        id: "publications",
        label: "Publications",
        componentType: "list",
        hint: "Papers, articles, posts"
      },
      {
        id: "patents",
        label: "Patents",
        componentType: "list",
        hint: "Filed or granted"
      },
      {
        id: "speaking",
        label: "Speaking",
        componentType: "twoColumn",
        hint: "Talks, panels, workshops"
      },
      {
        id: "volunteering",
        label: "Volunteering",
        componentType: "twoColumn",
        hint: "Unpaid work worth showing"
      },
      {
        id: "extracurriculars",
        label: "Extracurriculars",
        componentType: "twoColumn",
        hint: "Clubs, teams, societies"
      }
    ]
  },
  {
    title: "Credentials",
    presets: [
      {
        id: "certificates",
        label: "Certificates",
        componentType: "twoColumn",
        hint: "What you earned, and when"
      },
      {
        id: "licenses",
        label: "Licenses",
        componentType: "twoColumn",
        hint: "Licences you hold"
      },
      {
        id: "awards",
        label: "Awards",
        componentType: "twoColumn",
        hint: "Prizes and honours"
      },
      {
        id: "courses",
        label: "Courses",
        componentType: "twoColumn",
        hint: "Training beyond a degree"
      },
      {
        id: "memberships",
        label: "Memberships",
        componentType: "twoColumn",
        hint: "Professional bodies"
      },
      {
        id: "conferences",
        label: "Conferences",
        componentType: "twoColumn",
        hint: "Where you attended or presented"
      },
      {
        id: "military",
        label: "Military service",
        componentType: "twoColumn",
        hint: "Branch, role, dates"
      }
    ]
  },
  {
    title: "Skills",
    presets: [
      {
        id: "tools",
        label: "Tools",
        componentType: "tagList",
        hint: "Short names, read at a glance"
      },
      {
        id: "languages",
        label: "Languages",
        componentType: "meter",
        hint: "A level per language, drawn as a bar"
      },
      {
        id: "graphs",
        label: "Graphs",
        componentType: "meter",
        hint: "Anything you rate out of a hundred"
      }
    ]
  },
  {
    title: "Personal",
    presets: [
      {
        id: "hobbies",
        label: "Hobbies",
        componentType: "tagList",
        hint: "What you do outside work"
      },
      {
        id: "interests",
        label: "Interests",
        componentType: "tagList",
        hint: "Subjects you follow"
      },
      {
        id: "socialMedia",
        label: "Social media",
        componentType: "iconList",
        hint: "An icon and a handle per network"
      },
      {
        id: "portfolio",
        label: "Portfolio",
        componentType: "iconList",
        hint: "Links worth an icon"
      },
      {
        id: "references",
        label: "References",
        componentType: "twoColumn",
        hint: "A name and how to reach them"
      }
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
 * Matching is on the label and the hint together, so "bar" finds Graphs and
 * "link" finds Portfolio — a picker that only matched titles would hide the
 * entry whose title the user does not yet know.
 *
 * Empty groups are dropped rather than drawn empty: a heading with nothing
 * under it reads as a section that failed to load.
 */
export function searchSectionCatalog(query: string): SectionPresetGroup[] {
  const needle = query.trim().toLowerCase()

  if (!needle) return sectionCatalog

  return sectionCatalog
    .map((group) => ({
      title: group.title,
      presets: group.presets.filter((preset) =>
        `${preset.label} ${preset.hint}`.toLowerCase().includes(needle)
      )
    }))
    .filter((group) => group.presets.length > 0)
}
