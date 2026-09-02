import { type ReactNode } from "react"
import { type SelectHandle } from "~/lib/resume-selection"

/**
 * The document as an ordered list of blocks.
 *
 * A resume is still a tree while it is being built — a section owns its
 * entries, an entry owns its bullets — but what a page is filled with is a
 * *list*. A block is the smallest run of the document that is never cut: it is
 * assigned whole to exactly one page, or it is not assigned at all.
 *
 * The block is deliberately smaller than an entry, so a job may split between
 * two of its own bullets. Why the entry is the wrong unit is argued in
 * `docs/editable-resume.md`, under "The document is a block list".
 *
 * Nothing here knows how a block is drawn. The node is opaque, the spacing is
 * a name rather than a value, and the key is arithmetic — so the list can be
 * measured, grouped and re-grouped without a renderer having an opinion.
 */

/**
 * What a block is, as far as anything above the renderer is concerned.
 *
 * The set is closed on purpose: it is the list of things a page break is
 * allowed to fall between, and adding to it is a decision about the document
 * rather than about a component.
 */
export type ResumeBlockKind =
  /** The name, profession and contact details, which stay together. */
  | "header"
  /** A section's title and its rule, as one. */
  | "heading"
  /** One entry's identity line — employer or school, role or degree, dates. */
  | "entry"
  /** One bullet of one experience entry. */
  | "bullet"
  /** One education entry's description. */
  | "description"
  /** One paragraph — or one bullet list — of a rich-text section. */
  | "paragraph"
  /** One skills group: its category, its rule and all of its skills. */
  | "listGroup"
  /** A tag-list section's row of tags. */
  | "tagRow"
  /** An icon-list section's row. */
  | "iconRow"
  /** One labelled level of a meter section, bar and all. */
  | "meterRow"

/**
 * The space a block owns *after* itself, named rather than valued.
 *
 * Spacing used to be a parent's job — `space-y-*` between entries, padding on
 * the section element. A parent cannot space two children that have ended up
 * on different sheets, so the gap moves down onto the block that precedes it.
 * Trailing rather than leading, so that a block arriving at the top of a page
 * brings no gap with it.
 */
export type ResumeBlockSpace = "none" | "inline" | "entry" | "section"

/** A block before it knows which section it belongs to or where in it. */
export type ResumeBlockDraft = {
  kind: ResumeBlockKind
  space: ResumeBlockSpace
  node: ReactNode
  /**
   * Drawn for the editor and nowhere else — so measured by nothing.
   *
   * An empty section is a visible placeholder under a heading in the editor and
   * absent entirely from the print. Both are real blocks with real height on
   * screen, and a page charged for them is a page that breaks where the PDF
   * will not and a page count the printed document does not have. The length of
   * a resume is the one fact a stack of sheets exists to tell the truth about,
   * so the editor's own furniture is not allowed to move it.
   *
   * The blocks are still drawn, still selectable and still in document order.
   * They are only left out of the arithmetic.
   */
  editorOnly?: boolean
  /**
   * What clicking this block selects, when the document is being edited.
   *
   * Held here rather than drawn inside the node because one job is several
   * blocks and the outline belongs around all of them at once — see
   * `SelectHandle`. Absent everywhere selection is: the read-only document
   * emits no click target and no outline at all.
   */
  select?: SelectHandle | null
}

export type ResumeBlock = ResumeBlockDraft & {
  /** Stable across a re-render and across an edit elsewhere — see below. */
  key: string
  sectionId: string
  /**
   * Where the block sits in the whole document — see `inDocumentOrder`.
   *
   * Absent until the sections have been concatenated, because a section's
   * blocks know their place in the section and nothing more.
   */
  order?: number
}

/**
 * A block's key: its section, and where it sits inside that section.
 *
 * Derived rather than generated, so the same document always produces the same
 * keys — a measurement can be matched to the block it was taken from after a
 * re-render, and editing one section renumbers nothing in any other. Position
 * within the section rather than within the document is what buys the second
 * half of that.
 */
function resumeBlockKey(sectionId: string, position: number) {
  return `${sectionId}:${position}`
}

/**
 * The document's blocks, each stamped with its place in the whole.
 *
 * Drawn into the markup and read back by the measurer, because the order the
 * document is *drawn* in is the assignment's order and an assignment is always
 * one edit behind the document: a block added since belongs to no page, so the
 * renderer draws it on a leftover sheet at the end. Measured in that order it
 * would be filed after every section that follows it, the next measurement
 * would agree, and the wrong order would hold until the editor was remounted.
 * The list is the order; the paper is not.
 */
export function inDocumentOrder(blocks: ResumeBlock[]): ResumeBlock[] {
  return blocks.map((block, order) => ({ ...block, order }))
}

/** A section's drafts as blocks, numbered in document order. */
export function withBlockKeys(
  sectionId: string,
  drafts: ResumeBlockDraft[]
): ResumeBlock[] {
  return drafts.map((draft, position) => ({
    ...draft,
    key: resumeBlockKey(sectionId, position),
    sectionId
  }))
}
