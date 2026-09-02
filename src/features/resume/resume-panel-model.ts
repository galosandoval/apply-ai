import toast from "react-hot-toast"
import {
  editableColumns,
  formatResumeFieldPath,
  rowColumnTarget
} from "~/lib/resume-field-path"
import { moveItem } from "~/lib/move-item"
import { type DisplaySectionPreset } from "~/lib/section-catalog"
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
  /** A plain line, or the constrained markdown subset with its toolbar. */
  input: "text" | "markdown"
}

/**
 * One element of a repeated thing: a list item, an entry of a core section.
 *
 * An item with `fields` is edited here; an item with `onSelect` is edited by
 * selecting it, and shows only its name — a section panel holding every job and
 * everything written under it is what item-level selection exists to avoid.
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
 * The catalog entry a new section is created from.
 *
 * The id travels with the label because the server rewrites the heading in the
 * resume's own language, and only the id survives translation — see
 * `addSectionSchema`.
 */
export type AddedSectionPreset = Pick<
  DisplaySectionPreset,
  "id" | "label" | "componentType"
>

/**
 * Everything the panel can do that changes the *set* of things on the resume,
 * rather than one string on it.
 *
 * Named as an interface rather than inferred from the hook that implements it,
 * so this module stays pure and the two can be read apart.
 */
export type StructureActions = {
  addRow: (list: RowListName) => void
  removeRow: (list: RowListName, rowId: string) => void
  reorderRows: (list: RowListName, rowIds: string[]) => void
  addSection: (preset: AddedSectionPreset) => void
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
/**
 * The `t` from `useTranslations("resumePanel")` — and, for `contentT`, from
 * `useTranslations("sectionContent")`.
 *
 * The panel is a model, not a component — it names every label and every empty
 * state — so the copy has to arrive from the hook that builds it rather than
 * from a hook of its own.
 */
export type PanelTranslate = (
  key: string,
  values?: Record<string, string>
) => string

export function buildPanel({
  resume,
  selected,
  select,
  structure,
  t,
  contentT
}: {
  resume: SavedResume
  selected: ResumeSelection | null
  select: Select
  structure: StructureActions
  t: PanelTranslate
  contentT: PanelTranslate
}): PanelModel {
  const resolved = selected && resolveSelection(resume, selected)

  if (!resolved) return resumePanel(resume, select, structure, t)

  switch (resolved.kind) {
    case "header":
      return headerPanel(resume, t)
    case "row":
      return rowPanel(resume, resolved, structure, t)
    case "section":
      return sectionPanel(resume, resolved, select, structure, t, contentT)
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
  structure: StructureActions,
  t: PanelTranslate
): PanelModel {
  const ids = resume.sections.map((row) => row.id)

  return {
    title: t("resume"),
    fields: [],
    lists: [
      {
        title: t("sections"),
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
function headerPanel(resume: SavedResume, t: PanelTranslate): PanelModel {
  const contact = (
    ["fullName", "email", "phone", "location", "linkedIn", "portfolio"] as const
  ).map((column) => ({
    path: formatResumeFieldPath({ section: "contact", kind: "column", column }),
    label: t(`contact.${column}`),
    value: resume.contact[column] ?? "",
    input: "text" as const
  }))

  return {
    title: t("header"),
    fields: [
      {
        path: formatResumeFieldPath({
          section: "resume",
          kind: "column",
          column: "profession"
        }),
        label: t("profession"),
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
 * Taken from `editableColumns` rather than restated: the panel may offer
 * exactly what a path can address, and the two lists drifting apart is a field
 * the panel edits into a write the parser refuses — or one it silently never
 * offers. Still checked against the row types, so a column the grammar names
 * but the row does not have is a compile error here, which is what lets the
 * panel read one by name without asking whether it is there.
 */
const rowColumns = {
  experience: editableColumns.experience,
  education: editableColumns.education
} as const satisfies {
  [List in RowListName]: readonly ColumnOf<List>[]
}

/** A column some core row has — the ones `rowColumns` names, and only those. */
type CoreColumn = (typeof rowColumns)[RowListName][number]

/**
 * Which of those columns is rich text rather than a line.
 *
 * The body is edited with the markdown toolbar, not as a list of one-line
 * inputs: a bullet is a `- ` line inside one field now, so adding, removing and
 * reordering one is typing rather than three buttons per bullet.
 */
const markdownColumns: ReadonlySet<CoreColumn> = new Set(["body"])

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
  structure: StructureActions,
  t: PanelTranslate
): PanelModel {
  const { list, row, index } = selected
  const ids = resume[list].map((current) => current.id)

  const fields = rowColumns[list].flatMap((column) => {
    const target = rowColumnTarget(list, row.id, column)

    if (!target) return []

    return [
      {
        path: formatResumeFieldPath(target),
        label: t(`${list}.${column}`),
        value: stringAt(row, column),
        input: markdownColumns.has(column) ? "markdown" : "text"
      } satisfies PanelField
    ]
  })

  const ops = byRowId(ids, {
    onRemove: (id) => structure.removeRow(list, id),
    onReorder: (rowIds) => structure.reorderRows(list, rowIds)
  })

  return {
    title: entryLabel(row) || t("untitledEntry"),
    fields,
    // An entry owns no list of its own any more: its body is one markdown
    // field, and the bullets inside it are lines of that field.
    lists: [],
    actions: moveAndRemove({
      index,
      count: ids.length,
      onMove: (to) => ops.onMove(index, to),
      onRemove: () => ops.onRemove(index),
      t
    })
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
  structure: StructureActions,
  t: PanelTranslate,
  contentT: PanelTranslate
): PanelModel {
  const { section, index } = selected

  const labelField: PanelField = {
    path: formatResumeFieldPath({
      section: "section",
      kind: "label",
      row: section.id
    }),
    label: t("sectionName"),
    value: section.label,
    input: "text"
  }

  const core = rowListFor(section.kind)

  const contentFields = core
    ? []
    : sectionContentFields(section.componentType, section.content).map(
        (field) => ({
          path: contentPath(section.id, field.target),
          label: contentT(field.labelKey),
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
    title: section.label || t("untitledSection"),
    fields: [labelField, ...contentFields],
    lists: core
      ? [coreEntryList(resume, core, select, structure, t)]
      : contentList(section, structure, t, contentT),
    actions: moveAndRemove({
      index,
      count: resume.sections.length,
      onMove: (to) => ops.onMove(index, to),
      onRemove: () => ops.onRemove(index),
      t
    })
  }
}

/**
 * A core section's entries, named rather than expanded.
 *
 * Selecting one is how it is edited — a panel holding every job and everything
 * written under it is what item-level selection exists to avoid — so this
 * offers the operations that belong to the section: add, remove, and order.
 */
function coreEntryList(
  resume: SavedResume,
  core: { key: RowListName; noun: string },
  select: Select,
  structure: StructureActions,
  t: PanelTranslate
): PanelList {
  const rows: CoreRow[] = resume[core.key]

  return {
    title: t("entries"),
    noun: core.noun,
    items: rows.map((row) => ({
      key: row.id,
      label: entryLabel(row) || t(`nouns.${core.noun}.untitled`),
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
  structure: StructureActions,
  t: PanelTranslate,
  contentT: PanelTranslate
): PanelList[] {
  const noun = sectionContentNoun(section.componentType)

  if (!noun) return []

  const entries = sectionContentEntries(section.componentType, section.content)

  const write = (
    next: AnySectionContent | null,
    what: "add" | "remove" | "move"
  ) => {
    if (!next) {
      toast.error(t(`errors.${what}`))
      return
    }

    structure.setContent(section.id, next)
  }

  return [
    {
      title: t("entries"),
      noun,
      items: entries.map((entry) => ({
        key: String(entry.index),
        fields: entry.fields.map((field) => ({
          path: contentPath(section.id, field.target),
          label: contentT(field.labelKey),
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
  onRemove,
  t
}: {
  index: number
  count: number
  onMove: (to: number) => void
  onRemove: () => void
  t: PanelTranslate
}): PanelAction[] {
  const actions: PanelAction[] = []

  if (index > 0)
    actions.push({ label: t("moveUp"), onClick: () => onMove(index - 1) })

  if (index < count - 1)
    actions.push({ label: t("moveDown"), onClick: () => onMove(index + 1) })

  actions.push({
    label: t("remove"),
    onClick: onRemove,
    variant: "destructive"
  })

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
