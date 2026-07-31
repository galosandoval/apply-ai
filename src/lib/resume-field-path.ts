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

/**
 * Columns reachable from a path, by section. Anything absent is unaddressable:
 * a path arrives as a plain string, so this is the only thing between it and an
 * arbitrary column write.
 *
 * `bullets` is deliberately absent — it's an array, addressed per element.
 */
export const editableColumns = {
  experience: ["name", "title", "startDate", "endDate"],
  education: ["name", "degree", "startDate", "endDate", "description"]
} as const

export type ExperienceColumn = (typeof editableColumns.experience)[number]
export type EducationColumn = (typeof editableColumns.education)[number]

export type ResumeFieldTarget =
  | { section: "resume"; kind: "column"; column: "profession" }
  | {
      section: "experience"
      kind: "column"
      row: string
      column: ExperienceColumn
    }
  | { section: "experience"; kind: "bullet"; row: string; bulletIndex: number }
  | { section: "education"; kind: "column"; row: string; column: EducationColumn }

/**
 * Parses a resume field path. Returns `null` for anything that isn't an
 * editable field — an unknown section, a non-whitelisted column, the `bullets`
 * array itself, or a malformed bullet index.
 */
export function parseResumeFieldPath(path: string): ResumeFieldTarget | null {
  if (path === "profession") {
    return { section: "resume", kind: "column", column: "profession" }
  }

  const [section, row, third, fourth] = path.split(".")
  const segments = path.split(".").length

  if (!row) return null

  if (section === "experience") {
    if (third === "bullets") {
      // Digits only: `Number("")` is 0, so a trailing-dot path would otherwise
      // coerce into a write to bullet 0.
      if (segments !== 4 || !fourth || !/^\d+$/.test(fourth)) return null

      return {
        section,
        kind: "bullet",
        row,
        bulletIndex: Number(fourth)
      }
    }

    if (segments !== 3) return null

    const column = editableColumns.experience.find((name) => name === third)

    return column ? { section, kind: "column", row, column } : null
  }

  if (section === "education") {
    if (segments !== 3) return null

    const column = editableColumns.education.find((name) => name === third)

    return column ? { section, kind: "column", row, column } : null
  }

  return null
}

/** True when `path` addresses a field the resume itself owns. */
export function isEditableResumePath(path: string) {
  return parseResumeFieldPath(path) !== null
}

/** Re-addresses a target at a different row, e.g. an index swapped for an id. */
export function withRow(
  target: ResumeFieldTarget,
  row: string
): ResumeFieldTarget {
  return target.section === "resume" ? target : { ...target, row }
}

/** Renders a target back to its path string. */
export function formatResumeFieldPath(target: ResumeFieldTarget) {
  if (target.section === "resume") return target.column

  if (target.kind === "bullet") {
    return `${target.section}.${target.row}.bullets.${target.bulletIndex}`
  }

  return `${target.section}.${target.row}.${target.column}`
}
