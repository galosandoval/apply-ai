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
 *
 * `current` is one of them and is a boolean column rather than text — see
 * `isFlagColumn` for how a flag travels down a grammar whose values are
 * strings.
 */
export const editableColumns = {
  resume: ["profession"],
  experience: ["name", "title", "startDate", "endDate", "current", "body"],
  education: ["name", "degree", "startDate", "endDate", "current", "body"],
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

/**
 * The addressable columns that hold a flag rather than a line of text.
 *
 * `current` (#71) is the first and, so far, only one. The grammar's value is a
 * string at every stage — the panel's input, the debounce, the optimistic
 * patch, the mutation's payload, the rollback — and widening all of that to
 * `string | boolean` to carry one checkbox would have been a change to five
 * things to describe one. So the flag is *serialized* into the string instead,
 * and the two ends that have to know — the cache lens and the column write —
 * read it back through `parseFieldFlag`.
 */
const flagColumns: ReadonlySet<string> = new Set(["current"])

/** True when `column` is written as a flag rather than as text. */
export function isFlagColumn(column: string) {
  return flagColumns.has(column)
}

/** The only string `parseFieldFlag` reads as set. */
const flagSet = "true"

/** A flag as the grammar carries it. */
export function formatFieldFlag(on: boolean | null | undefined) {
  return on ? flagSet : ""
}

/**
 * A carried flag, read back.
 *
 * Exact rather than truthy: a path arrives as a client-supplied string, and
 * anything that is not the one value the formatter writes is unset — so `"1"`
 * or `"yes"` from somewhere that never asked this module cannot quietly mark a
 * job current.
 */
export function parseFieldFlag(value: string) {
  return value === flagSet
}

/**
 * One column of a row as the grammar carries it — a flag serialized, text as it
 * stands — or `undefined` for a column this row does not have.
 *
 * The inverse of `rowPatch`, and here for the same reason: the cache lens and
 * the panel both read a row into the grammar's strings, and the two disagreeing
 * about what a ticked box looks like would be a box drawn from one rule and
 * written back by another.
 */
export function readRowColumn(
  row: Record<string, unknown>,
  column: string
): string | undefined {
  const value = row[column]

  if (isFlagColumn(column)) return formatFieldFlag(Boolean(value))

  return typeof value === "string" ? value : undefined
}

/**
 * The change one addressed write makes to a row.
 *
 * Lives beside the flag it reads because both the client's cache patch and the
 * server's column write need exactly this, and the two disagreeing about what a
 * ticked box is would be an optimistic row that does not match the stored one.
 * `current` is the only column where what a path carries and what a column
 * holds are different types.
 *
 * A write to either half of the current/end-date pair carries the other half
 * with it, which is what actually makes the contradictory row unrepresentable
 * (#71). The panel clears the end date when the box is ticked, but the panel is
 * a client: `updateField` addresses one column at a time, and nothing stopped a
 * caller from setting `current` on a row whose end date still held a date.
 * Pairing them here settles it once, for the optimistic patch and the column
 * write alike — and leaves the panel's job the one thing a schema cannot do,
 * which is *restoring* the date when the box is unticked.
 */
export function rowPatch(target: RowTarget, value: string) {
  const { column } = target

  if (isFlagColumn(column)) {
    const on = parseFieldFlag(value)

    // Ticking is saying the entry has no end date. Unticking is not saying what
    // it is, so it leaves the column alone for the restore to write.
    return on ? { current: true, endDate: "" } : { current: false }
  }

  // A date in the end column is the entry ending, which the flag cannot also
  // claim. Emptying it is not — a row the editor has just added has no dates.
  if (column === "endDate" && value) return { endDate: value, current: false }

  return { [column]: value }
}

/** The addressable columns holding a date rather than free text. */
const dateColumns: ReadonlySet<string> = new Set(["startDate", "endDate"])

/** True when `column` holds a date, and so has a shape a write must respect. */
export function isDateColumn(column: string) {
  return dateColumns.has(column)
}
