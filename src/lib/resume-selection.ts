import { type KeyboardEvent, type MouseEvent } from "react"

/**
 * What the editor has selected, and how a selectable thing in the document
 * announces itself.
 *
 * Editing is selection-and-panel: clicking the document selects something, and
 * a panel beside it edits that thing's fields. Selection is item-level with
 * sections separately selectable — a panel holding four jobs and twenty bullets
 * is unusable, and a panel holding one textarea is a great deal of interface
 * for one string.
 *
 * Everything here is keyed by **row identity**, never by array index: the whole
 * point of reordering is that an index means something different afterwards.
 */

/** The lists a resume addresses a row at a time, as a path names them. */
export type RowListName = "experience" | "education"

export type ResumeSelection =
  /** The name, profession and contact details, which the resume owns one of. */
  | { kind: "header" }
  /** A section itself — its name, its place, and whether it is on the page. */
  | { kind: "section"; sectionId: string }
  /** One job or school inside a core section. */
  | { kind: "row"; list: RowListName; rowId: string }

/**
 * A core section's kind, the key its rows live under, and what one of them is
 * called where the user is offered one.
 *
 * `key` and the section's kind agree now that Skills is no longer a core
 * section — it was the one place they differed.
 */
export const coreRowLists = {
  experience: { key: "experience", noun: "job" },
  education: { key: "education", noun: "school" }
} as const satisfies Record<string, { key: RowListName; noun: string }>

export type CoreRowList = (typeof coreRowLists)[keyof typeof coreRowLists]

/** The row list a core section owns, or `null` for a custom one. */
export function rowListFor(kind: string): CoreRowList | null {
  return kind in coreRowLists
    ? coreRowLists[kind as keyof typeof coreRowLists]
    : null
}

/**
 * One selection as a string, for comparing two of them.
 *
 * A key rather than a deep equality check because the document compares this
 * once per selectable thing it draws, and because a key is also a React key.
 */
export function selectionKey(selection: ResumeSelection): string {
  switch (selection.kind) {
    case "header":
      return "header"
    case "section":
      return `section:${selection.sectionId}`
    case "row":
      return `${selection.list}:${selection.rowId}`
  }
}

export function isSameSelection(
  left: ResumeSelection | null,
  right: ResumeSelection | null
) {
  if (!left || !right) return false

  return selectionKey(left) === selectionKey(right)
}

/**
 * What the document needs to draw one selectable thing.
 *
 * `null` is the read-only document — the PDF, and the parseability check — where
 * nothing is selectable and no selection markup is emitted at all.
 */
export type SelectHandle = {
  /**
   * What this handle selects, as `selectionKey` writes it.
   *
   * The document is a list of blocks and one job is several of them, so the
   * outline is drawn around the *run* of adjacent blocks that select the same
   * thing rather than around each one. This is what says two blocks are that
   * same thing — an outline per bullet is five boxes where the user selected
   * one job.
   */
  key: string
  isSelected: boolean
  onSelect: () => void
}

/**
 * The class and the attributes that make an element selectable.
 *
 * Returned as data rather than as a wrapper component because the elements this
 * lands on already exist — a two-column row is a row whether or not it can be
 * clicked, and wrapping it in a second box would change the layout in the
 * editor only.
 *
 * The outline is what makes selection visible; without it the user cannot tell
 * what the panel is editing, and the whole model fails.
 */
export function selectable(handle: SelectHandle | null | undefined) {
  if (!handle) return { className: "", attributes: {} }

  const onSelect = (event: MouseEvent | KeyboardEvent) => {
    // A section contains its rows, so the innermost target wins: clicking a job
    // selects the job, not the section it happens to sit in.
    event.stopPropagation()
    handle.onSelect()
  }

  return {
    className: `cursor-pointer rounded-sm outline-offset-2 transition-[outline-color] ${
      handle.isSelected
        ? "outline outline-2 outline-sky-500"
        : "outline outline-2 outline-transparent hover:outline-sky-200"
    }`,
    attributes: {
      "aria-pressed": handle.isSelected,
      onClick: onSelect,
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return

        event.preventDefault()
        onSelect(event)
      },
      role: "button",
      tabIndex: 0
    }
  }
}
