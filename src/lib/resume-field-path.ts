/**
 * The grammar for addressing one editable string on a resume, shared by the
 * template, the optimistic cache patch, and the server write.
 *
 * Paths come in two flavours with the same shape. The template speaks in array
 * indices (`experience.1.name`) because that's what react-hook-form paths look
 * like; the mutation speaks in row ids (`experience.<cuid>.name`) because an
 * index doesn't survive reordering. `row` is whichever token the path carried,
 * so one parser serves both — use `withRow` to swap an index for an id.
 */

import {
  formatSectionContentPath,
  parseSectionContentPath,
  type SectionContentTarget
} from "./section-content"

export type { SectionContentTarget }

/**
 * Columns reachable from a path, by section. Anything absent is unaddressable:
 * a path arrives as a plain string, so this is the only thing between it and an
 * arbitrary column write.
 *
 * `body` is one of them, and used to not be: an entry's body was an array of
 * bullets addressed per element, and is one markdown string now, which is
 * exactly what a column write is for.
 *
 * `position`, `userId` and `resumeId` are absent: what a row belongs to and
 * where it sits are not string writes.
 */
export const editableColumns = {
  resume: ["profession"],
  experience: ["name", "title", "startDate", "endDate", "body"],
  education: ["name", "degree", "startDate", "endDate", "body"],
  contact: ["fullName", "email", "location", "phone", "linkedIn", "portfolio"]
} as const

export type ResumeColumn = (typeof editableColumns.resume)[number]
export type ExperienceColumn = (typeof editableColumns.experience)[number]
export type EducationColumn = (typeof editableColumns.education)[number]
export type ContactColumn = (typeof editableColumns.contact)[number]

export type ResumeFieldTarget =
  | { section: "resume"; kind: "column"; column: ResumeColumn }
  | {
      section: "experience"
      kind: "column"
      row: string
      column: ExperienceColumn
    }
  | {
      section: "education"
      kind: "column"
      row: string
      column: EducationColumn
    }
  | { section: "contact"; kind: "column"; column: ContactColumn }
  | { section: "section"; kind: "label"; row: string }
  | {
      section: "section"
      kind: "content"
      row: string
      content: SectionContentTarget
    }

/**
 * The sections addressed a row at a time, as opposed to the ones the resume
 * holds a single copy of. Every one of them is a list keyed by row id, so a
 * caller can index the resume by the section name alone.
 */
export const rowSections = ["experience", "education"] as const

export type RowSection = (typeof rowSections)[number]

export type RowTarget = Extract<ResumeFieldTarget, { section: RowSection }>

/** True when `target` addresses one row of a list rather than the resume. */
export function isRowTarget(target: ResumeFieldTarget): target is RowTarget {
  return (rowSections as readonly string[]).includes(target.section)
}

/** True when `value` names a section the resume addresses a row at a time. */
export function isRowSection(value: string | undefined): value is RowSection {
  return (rowSections as readonly string[]).includes(value ?? "")
}

/**
 * A column target for one row of a core section, or `null` when that section
 * has no such column.
 *
 * A caller holding the section as a union cannot prove the section/column pair
 * to the type system, because the pair is legal for only some members of it. So
 * the pairing is checked here, against the same whitelist everything else
 * reads, and the one widening that check earns lives in the grammar rather than
 * at each call.
 */
export function rowColumnTarget(
  section: RowSection,
  row: string,
  column: string
): RowTarget | null {
  const known = (editableColumns[section] as readonly string[]).includes(column)

  return known ? ({ section, kind: "column", row, column } as RowTarget) : null
}

/**
 * Parses a resume field path. Returns `null` for anything that isn't an
 * editable field — an unknown section, a non-whitelisted column, a container
 * rather than a string inside it, or a malformed index.
 */
export function parseResumeFieldPath(path: string): ResumeFieldTarget | null {
  const own = editableColumns.resume.find((name) => name === path)

  if (own) return { section: "resume", kind: "column", column: own }

  const segments = path.split(".")
  const [section, row, third] = segments

  if (section === "contact") {
    if (segments.length !== 2 || !row) return null

    const column = editableColumns.contact.find((name) => name === row)

    return column ? { section, kind: "column", column } : null
  }

  if (!row) return null

  if (section === "section") return parseSectionPath(row, segments)

  if (!isRowSection(section)) return null

  if (segments.length !== 3 || !third) return null

  return rowColumnTarget(section, row, third)
}

/**
 * `section.<id>.label`, or one string inside `section.<id>.content`.
 *
 * `kind`, `componentType` and `position` are absent on purpose: a user renames
 * and reorders a section, but cannot restructure one — that is what keeps a
 * core section's typed rows machine-readable.
 */
function parseSectionPath(
  row: string,
  segments: string[]
): ResumeFieldTarget | null {
  const [, , third] = segments

  if (third === "label") {
    return segments.length === 3
      ? { section: "section", kind: "label", row }
      : null
  }

  if (third !== "content") return null

  // Everything after `section.<id>.content.` is the component's own grammar.
  const content = parseSectionContentPath(segments.slice(3))

  return content ? { section: "section", kind: "content", row, content } : null
}

/** Re-addresses a target at a different row, e.g. an index swapped for an id. */
export function withRow(
  target: ResumeFieldTarget,
  row: string
): ResumeFieldTarget {
  return target.section === "resume" || target.section === "contact"
    ? target
    : { ...target, row }
}

/** Renders a target back to its path string. */
export function formatResumeFieldPath(target: ResumeFieldTarget): string {
  if (target.section === "resume") return target.column

  if (target.section === "contact") return `contact.${target.column}`

  if (target.section === "section") {
    return target.kind === "label"
      ? `section.${target.row}.label`
      : `section.${target.row}.content.${formatSectionContentPath(target.content)}`
  }

  return `${target.section}.${target.row}.${target.column}`
}
