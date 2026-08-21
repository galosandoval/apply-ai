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
 * `bullets` is deliberately absent — it's an array, addressed per element. So
 * are `position`, `userId` and `resumeId`: what a row belongs to and where it
 * sits are not string writes.
 */
export const editableColumns = {
  experience: ["name", "title", "startDate", "endDate"],
  education: ["name", "degree", "startDate", "endDate", "description"],
  skill: ["category", "all"],
  contact: ["fullName", "email", "location", "phone", "linkedIn", "portfolio"]
} as const

export type ExperienceColumn = (typeof editableColumns.experience)[number]
export type EducationColumn = (typeof editableColumns.education)[number]
export type SkillColumn = (typeof editableColumns.skill)[number]
export type ContactColumn = (typeof editableColumns.contact)[number]

/**
 * One string inside a custom section's content.
 *
 * Every shape belongs to exactly one component type, so the path alone says
 * which component the write is for — which is how a write addressed in one
 * component's shape can be refused on a section that renders as another.
 */
export type SectionContentTarget =
  | { componentType: "richText"; field: "markdown" }
  | { componentType: "list"; index: number }
  | { componentType: "tagList"; index: number }
  | { componentType: "twoColumn"; index: number; side: "left" | "right" }
  | { componentType: "iconList"; index: number; field: "icon" | "text" }

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
  | { section: "skill"; kind: "column"; row: string; column: SkillColumn }
  | { section: "contact"; kind: "column"; column: ContactColumn }
  | { section: "section"; kind: "label"; row: string }
  | {
      section: "section"
      kind: "content"
      row: string
      content: SectionContentTarget
    }

/**
 * Parses a resume field path. Returns `null` for anything that isn't an
 * editable field — an unknown section, a non-whitelisted column, a container
 * rather than a string inside it, or a malformed index.
 */
export function parseResumeFieldPath(path: string): ResumeFieldTarget | null {
  if (path === "profession") {
    return { section: "resume", kind: "column", column: "profession" }
  }

  const segments = path.split(".")
  const [section, row, third] = segments

  if (section === "contact") {
    if (segments.length !== 2 || !row) return null

    const column = editableColumns.contact.find((name) => name === row)

    return column ? { section, kind: "column", column } : null
  }

  if (!row) return null

  if (section === "section") return parseSectionPath(row, segments)

  if (section === "experience") {
    if (third === "bullets") return parseBulletPath(row, segments)

    if (segments.length !== 3) return null

    const column = editableColumns.experience.find((name) => name === third)

    return column ? { section, kind: "column", row, column } : null
  }

  if (section === "education" || section === "skill") {
    if (segments.length !== 3) return null

    const column = editableColumns[section].find((name) => name === third)

    // `find` widens to the union of both column types; the section decides.
    return column
      ? ({ section, kind: "column", row, column } as ResumeFieldTarget)
      : null
  }

  return null
}

function parseBulletPath(
  row: string,
  segments: string[]
): ResumeFieldTarget | null {
  const index = parseIndex(segments, 3)

  if (index === null) return null

  return { section: "experience", kind: "bullet", row, bulletIndex: index }
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

  const content = parseSectionContentPath(segments)

  return content ? { section: "section", kind: "content", row, content } : null
}

function parseSectionContentPath(
  segments: string[]
): SectionContentTarget | null {
  const [, , , field, fifth] = segments

  if (field === "markdown") {
    return segments.length === 4
      ? { componentType: "richText", field: "markdown" }
      : null
  }

  if (field === "items" || field === "tags") {
    const index = parseIndex(segments, 4)

    if (index === null) return null

    return field === "items"
      ? { componentType: "list", index }
      : { componentType: "tagList", index }
  }

  if (field === "rows" || field === "icons") {
    if (segments.length !== 6 || !isIndex(fifth)) return null

    const index = Number(fifth)
    const leaf = segments[5]

    if (field === "rows") {
      return leaf === "left" || leaf === "right"
        ? { componentType: "twoColumn", index, side: leaf }
        : null
    }

    return leaf === "icon" || leaf === "text"
      ? { componentType: "iconList", index, field: leaf }
      : null
  }

  return null
}

/**
 * Reads the index that must be the last segment of `segments`.
 *
 * Digits only, and the arity is checked here too: `Number("")` is 0, so a
 * trailing-dot path would otherwise coerce into a write to element 0.
 */
function parseIndex(segments: string[], at: number) {
  if (segments.length !== at + 1) return null

  const token = segments[at]

  return isIndex(token) ? Number(token) : null
}

function isIndex(token: string | undefined): token is string {
  return !!token && /^\d+$/.test(token)
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
      : `section.${target.row}.content.${formatContentPath(target.content)}`
  }

  if (target.kind === "bullet") {
    return `${target.section}.${target.row}.bullets.${target.bulletIndex}`
  }

  return `${target.section}.${target.row}.${target.column}`
}

function formatContentPath(content: SectionContentTarget) {
  switch (content.componentType) {
    case "richText":
      return "markdown"
    case "list":
      return `items.${content.index}`
    case "tagList":
      return `tags.${content.index}`
    case "twoColumn":
      return `rows.${content.index}.${content.side}`
    case "iconList":
      return `icons.${content.index}.${content.field}`
  }
}
