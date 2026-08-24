import toast from "react-hot-toast"
import { formatResumeFieldPath } from "~/lib/resume-field-path"
import { moveItem } from "~/lib/move-item"
import {
  type ResumeSelection,
  type RowListName,
  rowListFor
} from "~/lib/resume-selection"
import {
  addSectionContentEntry,
  type AnySectionContent,
  moveSectionContentEntry,
  removeSectionContentEntry,
  type SectionComponentType,
  sectionContentEntries,
  sectionContentFields,
  sectionContentNoun,
  type SectionContentTarget
} from "~/lib/section-content"
import { type SavedResume } from "./resume-field-lens"

// What the panel draws, for whatever is selected.
//
// Pure: a resume, a selection and the operations available, in — a description
// of a panel, out. Which fields exist and what can be added to them is decided
// by the selected thing's shape, so a sixth section shape is a registry entry
// in `section-content` rather than a sixth panel.

/** One editable string, as the panel draws it. */
export type PanelField = {
  /** The id-addressed field path — the same grammar the server writes by. */
  path: string
  label: string
  value: string
  input: "text" | "textarea" | "markdown"
}

/**
 * One element of a repeated thing: a bullet, a list item, an entry of a core
 * section.
 *
 * An item with `fields` is edited here; an item with `onSelect` is edited by
 * selecting it, and shows only its name — a section panel holding four jobs and
 * twenty bullets is exactly what item-level selection exists to avoid.
 */
export type PanelListItem = {
  key: string
  label?: string
  fields: PanelField[]
  onSelect?: () => void
}

export type PanelList = {
  title: string
  noun: string
  items: PanelListItem[]
  onAdd?: () => void
  onRemove?: (index: number) => void
  onMove?: (index: number, to: number) => void
}

/** A whole-thing operation: where it sits, and whether it stays. */
export type PanelAction = {
  label: string
  onClick: () => void
  variant?: "destructive"
}

/**
 * What the panel draws, generated from the selected thing's shape.
 *
 * The panel renders this and nothing else, so adding a section type is a
 * registry entry in `section-content` rather than a new panel by hand.
 */
export type PanelModel = {
  title: string
  fields: PanelField[]
  lists: PanelList[]
  actions: PanelAction[]
}

/**
 * Everything the panel can do that changes the *set* of things on the resume,
 * rather than one string on it.
 *
 * Named as an interface rather than inferred from the hook that implements it,
 * so this module stays pure and the two can be read apart.
 */
export type StructureActions = {
  setBullets: (rowId: string, bullets: string[]) => void
  addRow: (list: RowListName) => void
  removeRow: (list: RowListName, rowId: string) => void
  reorderRows: (list: RowListName, rowIds: string[]) => void
  addSection: (label: string, componentType: SectionComponentType) => void
  removeSection: (sectionId: string) => void
  reorderSections: (sectionIds: string[]) => void
  setContent: (sectionId: string, content: AnySectionContent) => void
}

/**
 * The panel for whatever is selected.
 *
 * One function rather than one component per selectable thing: the panel is
 * generated from the shape of what was selected, so a new section type does not
 * mean a new panel.
 */
export function buildPanel({
  resume,
  selected,
  select,
  structure
}: {
  resume: SavedResume
  selected: ResumeSelection | null
  select: (selection: ResumeSelection) => void
  structure: StructureActions
}): PanelModel {
  if (!selected) return resumePanel(resume, select, structure)

  switch (selected.kind) {
    case "header":
      return headerPanel(resume)
    case "row":
      return rowPanel(resume, selected.list, selected.rowId, structure)
    case "section":
      return sectionPanel(resume, selected.sectionId, select, structure)
  }
}

/** Nothing selected: the resume itself, which owns its sections. */
function resumePanel(
  resume: SavedResume,
  select: (selection: ResumeSelection) => void,
  structure: StructureActions
): PanelModel {
  const ids = resume.sections.map((row) => row.id)

  return {
    title: "Resume",
    fields: [],
    lists: [
      {
        title: "Sections",
        noun: "section",
        items: resume.sections.map((row) => ({
          key: row.id,
          label: row.label,
          fields: [],
          onSelect: () => select({ kind: "section", sectionId: row.id })
        })),
        onRemove: (index) => {
          const id = ids[index]

          if (id) structure.removeSection(id)
        },
        onMove: (index, to) =>
          structure.reorderSections(moveItem(ids, index, to))
      }
    ],
    actions: []
  }
}

/** The name, the profession and the contact details — one of each per resume. */
function headerPanel(resume: SavedResume): PanelModel {
  const contact = (
    [
      ["fullName", "Full name"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["location", "Location"],
      ["linkedIn", "LinkedIn"],
      ["portfolio", "Portfolio"]
    ] as const
  ).map(([column, label]) => ({
    path: formatResumeFieldPath({ section: "contact", kind: "column", column }),
    label,
    value: resume.contact[column] ?? "",
    input: "text" as const
  }))

  return {
    title: "Header",
    fields: [
      {
        path: formatResumeFieldPath({
          section: "resume",
          kind: "column",
          column: "profession"
        }),
        label: "Profession",
        value: resume.profession,
        input: "text"
      },
      ...contact
    ],
    lists: [],
    actions: []
  }
}

/** The columns of one row of a core section, by row list. */
const rowColumns = {
  experience: [
    ["name", "Company"],
    ["title", "Title"],
    ["startDate", "Start"],
    ["endDate", "End"]
  ],
  education: [
    ["name", "School"],
    ["degree", "Degree"],
    ["startDate", "Start"],
    ["endDate", "End"],
    ["description", "Description"]
  ],
  skill: [
    ["category", "Category"],
    ["all", "Skills"]
  ]
} as const satisfies Record<RowListName, readonly (readonly [string, string])[]>

/** Which of those columns is a paragraph rather than a line. */
const multilineColumns = new Set(["description", "all"])

/** One job, school or skill group: its own fields, and what it owns. */
function rowPanel(
  resume: SavedResume,
  list: RowListName,
  rowId: string,
  structure: StructureActions
): PanelModel {
  const rows: { id: string }[] = resume[list]
  const index = rows.findIndex((row) => row.id === rowId)
  const row = resume[list].find((current) => current.id === rowId)

  if (!row)
    return { title: "Nothing selected", fields: [], lists: [], actions: [] }

  const fields: PanelField[] = rowColumns[list].map(([column, label]) => ({
    path: `${list}.${rowId}.${column}`,
    label,
    value: readColumn(row, column),
    input: multilineColumns.has(column) ? "textarea" : "text"
  }))

  return {
    title: rowTitle(list, row),
    fields,
    // Only a job owns a list the panel edits in place; a school's description
    // is one field, and a skill group's line is one field.
    lists:
      list === "experience"
        ? [bulletList(bulletsOf(row), rowId, structure)]
        : [],
    actions: moveAndRemove({
      index,
      count: rows.length,
      onMove: (to) =>
        structure.reorderRows(
          list,
          moveItem(
            rows.map((current) => current.id),
            index,
            to
          )
        ),
      onRemove: () => structure.removeRow(list, rowId)
    })
  }
}

/** A job's bullets: the one list the panel edits in place. */
function bulletList(
  bullets: string[],
  rowId: string,
  structure: StructureActions
): PanelList {
  return {
    title: "Bullets",
    noun: "bullet",
    items: bullets.map((bullet, index) => ({
      // Keyed by position within the job, which is what a bullet's identity
      // *is*: bullets are an array column, not rows with ids of their own.
      key: `${rowId}.${index}`,
      fields: [
        {
          path: `experience.${rowId}.bullets.${index}`,
          label: `Bullet ${index + 1}`,
          value: bullet,
          input: "textarea"
        }
      ]
    })),
    onAdd: () => structure.setBullets(rowId, [...bullets, ""]),
    onRemove: (index) =>
      structure.setBullets(
        rowId,
        bullets.filter((_bullet, at) => at !== index)
      ),
    onMove: (index, to) =>
      structure.setBullets(rowId, moveItem(bullets, index, to))
  }
}

/**
 * A section: its name, where it sits, whether it stays — and what it holds.
 *
 * A core section holds typed rows, which are selected and edited on their own;
 * a custom one holds content, whose fields and elements come from the shape
 * registry rather than from a panel written for it.
 */
function sectionPanel(
  resume: SavedResume,
  sectionId: string,
  select: (selection: ResumeSelection) => void,
  structure: StructureActions
): PanelModel {
  const index = resume.sections.findIndex((row) => row.id === sectionId)
  const section = resume.sections[index]

  if (!section)
    return { title: "Nothing selected", fields: [], lists: [], actions: [] }

  const labelField: PanelField = {
    path: `section.${sectionId}.label`,
    label: "Name",
    value: section.label,
    input: "text"
  }

  const core = rowListFor(section.kind)

  const contentFields = core
    ? []
    : sectionContentFields(section.componentType, section.content).map(
        (field) => ({
          path: contentPath(sectionId, field.target),
          label: field.label,
          value: field.value,
          input: field.input
        })
      )

  return {
    title: section.label || "Section",
    fields: [labelField, ...contentFields],
    lists: core
      ? [coreEntryList(resume, core, select, structure)]
      : contentList(section, structure),
    actions: moveAndRemove({
      index,
      count: resume.sections.length,
      onMove: (to) =>
        structure.reorderSections(
          moveItem(
            resume.sections.map((row) => row.id),
            index,
            to
          )
        ),
      onRemove: () => structure.removeSection(sectionId)
    })
  }
}

/**
 * A core section's entries, named rather than expanded.
 *
 * Selecting one is how it is edited — a panel holding four jobs and twenty
 * bullets is exactly what item-level selection exists to avoid — so this offers
 * the operations that belong to the section: add, remove, and order.
 */
function coreEntryList(
  resume: SavedResume,
  core: { key: RowListName; noun: string },
  select: (selection: ResumeSelection) => void,
  structure: StructureActions
): PanelList {
  const rows: { id: string }[] = resume[core.key]
  const ids = rows.map((row) => row.id)

  return {
    title: "Entries",
    noun: core.noun,
    items: resume[core.key].map((row) => ({
      key: row.id,
      label: entryLabel(core.key, row) || `Untitled ${core.noun}`,
      fields: [],
      onSelect: () => select({ kind: "row", list: core.key, rowId: row.id })
    })),
    onAdd: () => structure.addRow(core.key),
    onRemove: (index) => {
      const id = ids[index]

      if (id) structure.removeRow(core.key, id)
    },
    onMove: (index, to) =>
      structure.reorderRows(core.key, moveItem(ids, index, to))
  }
}

/** A custom section's content, as the shape registry describes it. */
function contentList(
  section: SavedResume["sections"][number],
  structure: StructureActions
): PanelList[] {
  const noun = sectionContentNoun(section.componentType)

  if (!noun) return []

  const entries = sectionContentEntries(section.componentType, section.content)

  const write = (next: AnySectionContent | null, what: string) => {
    if (!next) {
      toast.error(`Could not ${what} that.`)
      return
    }

    structure.setContent(section.id, next)
  }

  return [
    {
      title: "Entries",
      noun,
      items: entries.map((entry) => ({
        key: String(entry.index),
        fields: entry.fields.map((field) => ({
          path: contentPath(section.id, field.target),
          label: field.label,
          value: field.value,
          input: field.input
        }))
      })),
      onAdd: () =>
        write(
          addSectionContentEntry(section.componentType, section.content),
          "add"
        ),
      onRemove: (index) =>
        write(
          removeSectionContentEntry(
            section.componentType,
            section.content,
            index
          ),
          "remove"
        ),
      onMove: (index, to) =>
        write(
          moveSectionContentEntry(
            section.componentType,
            section.content,
            index,
            to
          ),
          "move"
        )
    }
  ]
}

/** Move up, move down, and remove — the operations a whole thing has. */
function moveAndRemove({
  index,
  count,
  onMove,
  onRemove
}: {
  index: number
  count: number
  onMove: (to: number) => void
  onRemove: () => void
}): PanelAction[] {
  const actions: PanelAction[] = []

  if (index > 0)
    actions.push({ label: "Move up", onClick: () => onMove(index - 1) })

  if (index < count - 1)
    actions.push({ label: "Move down", onClick: () => onMove(index + 1) })

  actions.push({ label: "Remove", onClick: onRemove, variant: "destructive" })

  return actions
}

/**
 * The path that writes one string of a custom section's content.
 *
 * Built through the grammar rather than concatenated, so the panel addresses a
 * field by exactly the string the server parses back.
 */
function contentPath(sectionId: string, content: SectionContentTarget) {
  return formatResumeFieldPath({
    section: "section",
    kind: "content",
    row: sectionId,
    content
  })
}

/** A job's bullets. The other row lists have none, and read as empty. */
function bulletsOf(row: object) {
  const bullets = (row as { bullets?: unknown }).bullets

  return Array.isArray(bullets) ? (bullets as string[]) : []
}

function readColumn(row: Record<string, unknown>, column: string) {
  const value = row[column]

  return typeof value === "string" ? value : ""
}

function rowTitle(list: RowListName, row: Record<string, unknown>) {
  return entryLabel(list, row) || "Entry"
}

function entryLabel(list: RowListName, row: Record<string, unknown>) {
  return readColumn(row, list === "skill" ? "category" : "name")
}
