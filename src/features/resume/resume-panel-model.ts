import toast from "react-hot-toast"
import { formatResumeFieldPath, rowColumnTarget } from "~/lib/resume-field-path"
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

type Select = (selection: ResumeSelection) => void

type SavedSection = SavedResume["sections"][number]

/** One row of a core section: a job, a school, or a skill group. */
type CoreRow = SavedResume[RowListName][number]

/**
 * A selection with the thing it points at, or `null` when that thing is no
 * longer on the resume.
 *
 * One resolution rather than a switch on `kind` at every question about a
 * selection: whether it still exists and what the panel should draw for it are
 * the same lookup asked twice.
 */
export type ResolvedSelection =
  | { kind: "header" }
  | { kind: "section"; index: number; section: SavedSection }
  | { kind: "row"; list: RowListName; index: number; row: CoreRow }

/** What `selection` points at, or `null` when the resume no longer holds it. */
export function resolveSelection(
  resume: SavedResume,
  selection: ResumeSelection
): ResolvedSelection | null {
  switch (selection.kind) {
    case "header":
      return { kind: "header" }

    case "section": {
      const index = resume.sections.findIndex(
        (row) => row.id === selection.sectionId
      )
      const section = resume.sections[index]

      return section ? { kind: "section", index, section } : null
    }

    case "row": {
      const rows: CoreRow[] = resume[selection.list]
      const index = rows.findIndex((row) => row.id === selection.rowId)
      const row = rows[index]

      return row ? { kind: "row", list: selection.list, index, row } : null
    }
  }
}

/**
 * The panel for whatever is selected.
 *
 * Pure: a resume, a selection and the operations available, in — a description
 * of a panel, out. One function rather than one component per selectable thing,
 * because which fields exist and what can be added to them is decided by the
 * selected thing's shape — so a sixth section shape is a registry entry in
 * `section-content` rather than a sixth panel.
 *
 * A selection the resume no longer holds falls back to the resume itself, which
 * is the same thing the editor derives when a selected row is deleted.
 */
export function buildPanel({
  resume,
  selected,
  select,
  structure
}: {
  resume: SavedResume
  selected: ResumeSelection | null
  select: Select
  structure: StructureActions
}): PanelModel {
  const resolved = selected && resolveSelection(resume, selected)

  if (!resolved) return resumePanel(resume, select, structure)

  switch (resolved.kind) {
    case "header":
      return headerPanel(resume)
    case "row":
      return rowPanel(resume, resolved, structure)
    case "section":
      return sectionPanel(resume, resolved, select, structure)
  }
}

/**
 * The remove and move handlers for a list of rows addressed by id.
 *
 * Four lists want exactly this — the resume's sections, a core section's
 * entries, and the row and section panels' own actions — so turning the index
 * the panel clicked back into an id happens here rather than at each of them.
 */
function byRowId(
  ids: string[],
  {
    onRemove,
    onReorder
  }: {
    onRemove: (id: string) => void
    onReorder: (ids: string[]) => void
  }
) {
  return {
    onRemove: (index: number) => {
      const id = ids[index]

      if (id) onRemove(id)
    },
    onMove: (index: number, to: number) => onReorder(moveItem(ids, index, to))
  }
}

/** Nothing selected: the resume itself, which owns its sections. */
function resumePanel(
  resume: SavedResume,
  select: Select,
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
        ...byRowId(ids, {
          onRemove: structure.removeSection,
          onReorder: structure.reorderSections
        })
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

type ColumnOf<List extends RowListName> = Extract<
  keyof SavedResume[List][number],
  string
>

/**
 * The columns of one row of a core section, by row list.
 *
 * Checked against the row types rather than trusted: a column this table names
 * but the row does not have is a compile error here, which is what lets the
 * panel read one by name without asking whether it is there.
 */
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
  ]
} as const satisfies {
  [List in RowListName]: readonly (readonly [ColumnOf<List>, string])[]
}

/** A column some core row has — the ones `rowColumns` names, and only those. */
type CoreColumn = (typeof rowColumns)[RowListName][number][0]

/** Which of those columns is a paragraph rather than a line. */
const multilineColumns: ReadonlySet<CoreColumn> = new Set(["description"])

/**
 * One column of a core row, as the panel shows it.
 *
 * The row is only *some* of the lists' rows, so a column another list owns is
 * absent rather than wrong — and an absent or null column reads as empty, which
 * is what an input needs anyway.
 */
function stringAt(
  row: Partial<Record<CoreColumn, string | null>>,
  column: CoreColumn
) {
  const value = row[column]

  return typeof value === "string" ? value : ""
}

/** What a core row is called in a list of them, or "" when it has no name. */
function entryLabel(row: CoreRow) {
  return stringAt(row, "name")
}

/** One job or school: its own fields, and what it owns. */
function rowPanel(
  resume: SavedResume,
  selected: Extract<ResolvedSelection, { kind: "row" }>,
  structure: StructureActions
): PanelModel {
  const { list, row, index } = selected
  const ids = resume[list].map((current) => current.id)

  const fields = rowColumns[list].flatMap(([column, label]) => {
    const target = rowColumnTarget(list, row.id, column)

    if (!target) return []

    return [
      {
        path: formatResumeFieldPath(target),
        label,
        value: stringAt(row, column),
        input: multilineColumns.has(column) ? "textarea" : "text"
      } satisfies PanelField
    ]
  })

  // Only a job owns a list the panel edits in place; a school's description is
  // one field, and a skill group's line is one field. Read back off the typed
  // array rather than off the selection, which holds the union of all three.
  const bullets =
    list === "experience"
      ? (resume.experience.find((job) => job.id === row.id)?.bullets ?? [])
      : []

  const ops = byRowId(ids, {
    onRemove: (id) => structure.removeRow(list, id),
    onReorder: (rowIds) => structure.reorderRows(list, rowIds)
  })

  return {
    title: entryLabel(row) || "Entry",
    fields,
    lists:
      list === "experience" ? [bulletList(bullets, row.id, structure)] : [],
    actions: moveAndRemove({
      index,
      count: ids.length,
      onMove: (to) => ops.onMove(index, to),
      onRemove: () => ops.onRemove(index)
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
          path: formatResumeFieldPath({
            section: "experience",
            kind: "bullet",
            row: rowId,
            bulletIndex: index
          }),
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
  selected: Extract<ResolvedSelection, { kind: "section" }>,
  select: Select,
  structure: StructureActions
): PanelModel {
  const { section, index } = selected

  const labelField: PanelField = {
    path: formatResumeFieldPath({
      section: "section",
      kind: "label",
      row: section.id
    }),
    label: "Name",
    value: section.label,
    input: "text"
  }

  const core = rowListFor(section.kind)

  const contentFields = core
    ? []
    : sectionContentFields(section.componentType, section.content).map(
        (field) => ({
          path: contentPath(section.id, field.target),
          label: field.label,
          value: field.value,
          input: field.input
        })
      )

  const ops = byRowId(
    resume.sections.map((row) => row.id),
    {
      onRemove: structure.removeSection,
      onReorder: structure.reorderSections
    }
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
      onMove: (to) => ops.onMove(index, to),
      onRemove: () => ops.onRemove(index)
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
  select: Select,
  structure: StructureActions
): PanelList {
  const rows: CoreRow[] = resume[core.key]

  return {
    title: "Entries",
    noun: core.noun,
    items: rows.map((row) => ({
      key: row.id,
      label: entryLabel(row) || `Untitled ${core.noun}`,
      fields: [],
      onSelect: () => select({ kind: "row", list: core.key, rowId: row.id })
    })),
    onAdd: () => structure.addRow(core.key),
    ...byRowId(
      rows.map((row) => row.id),
      {
        onRemove: (id) => structure.removeRow(core.key, id),
        onReorder: (rowIds) => structure.reorderRows(core.key, rowIds)
      }
    )
  }
}

/** A custom section's content, as the shape registry describes it. */
function contentList(
  section: SavedSection,
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
