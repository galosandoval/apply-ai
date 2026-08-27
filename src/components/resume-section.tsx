import { type ReactNode } from "react"
import {
  isResumeIconName,
  ResumeIcon,
  type ResumeIconName
} from "~/components/resume-icon"
import {
  type ResumeBlock,
  type ResumeBlockDraft,
  type ResumeBlockKind,
  withBlockKeys
} from "~/lib/resume-blocks"
import { renderResumeMarkdown } from "~/lib/resume-markdown"
import { selectable, type SelectHandle } from "~/lib/resume-selection"
import {
  isSectionComponentType,
  parseSectionContent,
  type SectionComponentType
} from "~/lib/section-content"

/**
 * The five shapes a resume section can draw as — the whole rendering system.
 *
 * A section type is a *configuration* of one of these, never a renderer of its
 * own: a custom section is a user-created instance, and a core section is a
 * pre-configured one fed by its typed rows. That is what gives a style one
 * surface to land on instead of one per section.
 *
 * Everything that varies per shape lives in one entry of `shapeSpecs` — how a
 * stored payload becomes it, when it counts as empty, and what draws it. Adding
 * a sixth shape is one registry entry, not a hunt for every switch on the type.
 *
 * Adding one is still a deliberate act: every shape multiplies the work in the
 * editor and in the style, so the set stays small on purpose.
 */

/**
 * Page mode is the A4 document — desktop and the PDF. Reflow abandons the page
 * and lays the same sections out for a narrow screen; it is not a scaled-down
 * page, and it is driven by this one prop so the two cannot show different
 * content.
 */
export type RenderMode = "page" | "reflow"

/**
 * How the document is being drawn, as one value.
 *
 * The two travel together everywhere — the mode picks the layout, and `isEditor`
 * is what makes an empty section a visible placeholder — so they are one type
 * rather than a pair every level has to thread through by hand.
 */
export type RenderOptions = {
  mode: RenderMode
  isEditor: boolean
}

/**
 * Content is `ReactNode`, not `string`, so a core section can feed the same
 * shape a click-to-edit field where a custom one feeds a plain string. The
 * shape is the structure; who supplies it is not the shape's business.
 */
export type SectionShape =
  | { componentType: "richText"; markdown: string }
  | { componentType: "twoColumn"; rows: TwoColumnRow[] }
  | { componentType: "list"; groups: ListGroup[] }
  | { componentType: "tagList"; tags: { key: string; label: ReactNode }[] }
  | { componentType: "iconList"; icons: IconEntry[] }

export type TwoColumnRow = {
  left: ReactNode
  /** The identity line: the employer or school, the role or degree. */
  right: ReactNode
  /**
   * What follows the identity line, one block at a time.
   *
   * A row is a *sequence* of blocks rather than one subtree, which is what lets
   * a nine-bullet job split between two of its bullets instead of moving whole
   * to the next sheet. Every part draws in the same two-column frame, so the
   * page cannot tell where the entry stopped and its body began.
   */
  body?: EntryPart[]
  /**
   * What clicking this row selects, when the document is being edited.
   *
   * Absent everywhere else, which is what keeps selection out of the PDF: a
   * shape drawn without a handle emits no click target and no outline.
   *
   * Carried by every block of the row, not just the first: clicking the fourth
   * bullet of a job selects the job, wherever that bullet has landed.
   */
  select?: SelectHandle | null
}

/** One block of an entry's body, and what kind of thing it is. */
export type EntryPart = { kind: ResumeBlockKind; node: ReactNode }

/** A flat list is one group with no label. */
export type ListGroup = {
  label?: ReactNode
  items: ReactNode[]
  select?: SelectHandle | null
}

/**
 * `icon` is narrowed on the way in rather than carried as a `string`: an
 * unrecognised key is decided once, here, and `null` from then on.
 */
export type IconEntry = {
  key: string
  icon: ResumeIconName | null
  label: ReactNode
}

/**
 * Marker classes the tests and the later editor hang off.
 *
 * They carry no styling — the utilities beside them do — but they are the
 * stable name for "this is a two-column row" in rendered markup, which is what
 * makes the structural invariants assertable without a DOM.
 *
 * `row` marks one *block* drawn in the two-column frame, not one entry: an
 * entry is several of them now, and each draws the same frame so that a bullet
 * stays under its own dates wherever it lands.
 */
const marker = {
  row: "resume-two-column-row",
  tag: "resume-tag-item",
  placeholder: "resume-section-placeholder"
}

type ShapeIn<Type extends SectionComponentType> = Extract<
  SectionShape,
  { componentType: Type }
>

/**
 * Everything that differs between one shape and the next.
 *
 * `fromContent` is only for custom sections — a core section's content is its
 * typed rows, and the document builds those into a shape directly.
 */
type ShapeSpec<Type extends SectionComponentType> = {
  fromContent: (content: unknown) => ShapeIn<Type> | null
  isEmpty: (shape: ShapeIn<Type>) => boolean
  /**
   * The shape as the sequence of blocks it contributes to the document.
   *
   * A shape still decides what its content looks like; what it no longer
   * decides is that its content is one indivisible thing.
   */
  toBlocks: (shape: ShapeIn<Type>, mode: RenderMode) => ResumeBlockDraft[]
}

const shapeSpecs: { [Type in SectionComponentType]: ShapeSpec<Type> } = {
  richText: {
    fromContent: (content) => {
      const parsed = parseSectionContent("richText", content)

      return parsed && { componentType: "richText", markdown: parsed.markdown }
    },
    isEmpty: (shape) => !shape.markdown.trim(),
    toBlocks: (shape) =>
      renderResumeMarkdown(shape.markdown).map((node) => ({
        kind: "paragraph",
        space: "inline",
        node
      }))
  },

  twoColumn: {
    fromContent: (content) => {
      const parsed = parseSectionContent("twoColumn", content)

      return (
        parsed && {
          componentType: "twoColumn",
          rows: parsed.rows.map((row) => ({
            left: row.left,
            right: row.right
          }))
        }
      )
    },
    isEmpty: (shape) => !shape.rows.length,
    toBlocks: (shape, mode) => shape.rows.flatMap((row) => rowBlocks(row, mode))
  },

  list: {
    fromContent: (content) => {
      const parsed = parseSectionContent("list", content)

      // One unlabelled group: a custom list is flat, where Skills is grouped.
      // Grouped custom lists wait on a content payload that can carry a label —
      // the section schema is not this spec's to change.
      return (
        parsed && { componentType: "list", groups: [{ items: parsed.items }] }
      )
    },
    isEmpty: (shape) => !shape.groups.some((group) => group.items.length),
    toBlocks: (shape, mode) =>
      shape.groups.filter(isDrawn).map((group) => ({
        kind: "listGroup",
        space: "inline",
        node: <ListEntry group={group} mode={mode} />
      }))
  },

  tagList: {
    fromContent: (content) => {
      const parsed = parseSectionContent("tagList", content)

      return (
        parsed && {
          componentType: "tagList",
          tags: parsed.tags.map((tag, index) => ({
            key: String(index),
            label: tag
          }))
        }
      )
    },
    isEmpty: (shape) => !shape.tags.length,
    toBlocks: (shape) => [
      { kind: "tagRow", space: "none", node: <TagList tags={shape.tags} /> }
    ]
  },

  iconList: {
    fromContent: (content) => {
      const parsed = parseSectionContent("iconList", content)

      return (
        parsed && {
          componentType: "iconList",
          icons: parsed.icons.map((entry, index) => ({
            key: String(index),
            icon: isResumeIconName(entry.icon) ? entry.icon : null,
            label: entry.text
          }))
        }
      )
    },
    isEmpty: (shape) => !shape.icons.length,
    toBlocks: (shape) => [
      { kind: "iconRow", space: "none", node: <IconList icons={shape.icons} /> }
    ]
  }
}

/**
 * The spec that draws `componentType`.
 *
 * Indexing by the discriminator always picks the entry written for exactly that
 * shape, but TypeScript can't correlate the two halves of that lookup — so the
 * widening happens once, here, and the call sites stay honest.
 */
function specFor(
  componentType: SectionComponentType
): ShapeSpec<SectionComponentType> {
  return shapeSpecs[componentType] as ShapeSpec<SectionComponentType>
}

/**
 * A custom section's stored content as the shape that draws it.
 *
 * Content is re-parsed against the component that has to render it rather than
 * trusted: a row whose payload disagrees with its `componentType` draws nothing
 * at all, which is a visibly missing section rather than half of one.
 *
 * Core sections never come through here — their content is their typed rows,
 * and the document feeds those to the same shapes directly.
 */
export function customSectionShape(
  componentType: string,
  content: unknown
): SectionShape | null {
  return isSectionComponentType(componentType)
    ? specFor(componentType).fromContent(content)
    : null
}

/**
 * One section as the blocks it contributes to the document, in order.
 *
 * Its heading and its rule are one block; the rest is however many its shape
 * draws as. Nothing wraps them — a `<section>` element around the lot would be
 * an element that has to span two sheets of paper the moment the section does,
 * and a block that cannot be moved on its own is the thing this replaces.
 *
 * An empty section is a visible placeholder in the editor and nothing at all in
 * the document — a blank section in the editor would be a zero-height element
 * with nothing to click, and a placeholder in a finished PDF is worse than a
 * gap.
 */
export function sectionBlocks({
  sectionId,
  label,
  shape,
  render,
  select
}: {
  sectionId: string
  label: ReactNode
  shape: SectionShape
  render: RenderOptions
  /** Selecting the section itself — its name, its place, its entries. */
  select?: SelectHandle | null
}): ResumeBlock[] {
  const { isEmpty, toBlocks } = specFor(shape.componentType)
  const empty = isEmpty(shape)

  if (empty && !render.isEditor) return []

  const drafts = [
    headingBlock(label, select),
    ...(empty ? [placeholderBlock()] : toBlocks(shape, render.mode))
  ]

  return withBlockKeys(sectionId, closingSection(drafts))
}

/**
 * The gap between one section and the next, given to the block that ends the
 * first — whichever kind it turned out to be.
 *
 * It used to be padding on the section element, which is exactly the kind of
 * spacing a parent can no longer own: there is no element left that contains a
 * whole section, and there could not be one that spans two pages.
 */
function closingSection(drafts: ResumeBlockDraft[]): ResumeBlockDraft[] {
  return drafts.map((draft, index) =>
    index === drafts.length - 1 ? { ...draft, space: "section" } : draft
  )
}

/**
 * The section's title and its rule, as one block.
 *
 * They are never separated, and `break-after-avoid` on the block asks the same
 * of the content that follows — a heading stranded at the foot of a page
 * introduces nothing.
 *
 * The heading is also the section's own click target: clicking a job selects
 * the job, so selecting the section it sits in needs somewhere of its own to
 * click.
 */
function headingBlock(
  label: ReactNode,
  select?: SelectHandle | null
): ResumeBlockDraft {
  const heading = selectable(select)

  return {
    kind: "heading",
    space: "none",
    node: (
      <div
        className={`pb-resume-heading ${heading.className}`}
        {...heading.attributes}
      >
        <h2 className="resume-heading text-resume-heading text-resume-accent">
          {label}
        </h2>

        {/*
          A style with no rule sets the weight and the gap to zero, so this
          block draws nothing and takes up nothing — the space between a heading
          and its content is `pb-resume-heading` above, which every style has.
        */}
        <div className="pb-resume-rule-gap pt-resume-rule-gap">
          <hr className="resume-rule" />
        </div>
      </div>
    )
  }
}

/** What an empty section looks like in the editor, and only there. */
function placeholderBlock(): ResumeBlockDraft {
  return {
    kind: "paragraph",
    space: "none",
    node: (
      <p className={`${marker.placeholder} text-resume-muted`}>
        Nothing here yet
      </p>
    )
  }
}

/**
 * One entry as its blocks: the identity line, then whatever its body is made
 * of — one bullet at a time for a job, one description for a school, nothing at
 * all for a custom row.
 *
 * Every block draws in the same two-column frame, so a bullet that has landed
 * on the next page still lines up under where its dates would have been.
 */
function rowBlocks(row: TwoColumnRow, mode: RenderMode): ResumeBlockDraft[] {
  const parts: EntryPart[] = [
    { kind: "entry", node: row.right },
    ...(row.body ?? [])
  ]

  return parts.map((part, index) => ({
    kind: part.kind,
    // The gap before the next entry belongs to this entry's last block: two
    // entries on two different sheets have no parent left to space them apart.
    space: index === parts.length - 1 ? "entry" : "none",
    node: (
      <TwoColumnFrame
        isLead={index === 0}
        left={row.left}
        mode={mode}
        right={part.node}
        select={row.select}
      />
    )
  }))
}

/**
 * A left column — conventionally dates — and a right column of content.
 *
 * The columns stack in reflow rather than narrowing: two columns inside a 390px
 * viewport is how a date range ends up one character wide. Reading order is the
 * same either way, so the stack costs the document nothing.
 *
 * Only the entry's first block fills the left column; the rest draw it empty so
 * that their content stays in the same gutter. Stacked, there is no gutter to
 * hold, so a continuation draws no left column at all rather than an empty row
 * of one.
 */
function TwoColumnFrame({
  left,
  right,
  mode,
  isLead,
  select
}: {
  left: ReactNode
  right: ReactNode
  mode: RenderMode
  /** Whether this is the block the entry opens with. */
  isLead: boolean
  select?: SelectHandle | null
}) {
  const isPage = mode === "page"
  const handle = selectable(select)

  // Page mode holds the gutter open even where there is nothing in it, so a
  // bullet stays under its own dates. Stacked, there is no gutter to hold.
  const drawsGutter = isPage || isLead

  return (
    <div
      className={`${marker.row} ${
        isPage ? "flex gap-resume-entry" : "flex flex-col gap-resume-inline"
      } ${handle.className}`}
      {...handle.attributes}
    >
      {/*
        Stacked on a phone the left column has no column to be in, so it earns
        its separation from the entry name's weight instead of from the gutter.
      */}
      {drawsGutter && (
        <div
          className={
            isPage ? "w-resume-left-column shrink-0" : "resume-entry-name"
          }
        >
          {isLead && left}
        </div>
      )}

      <div className="min-w-0 flex-1">{right}</div>
    </div>
  )
}

/**
 * Whether a group is drawn at all.
 *
 * An empty group is nothing in the document — but where it can be selected it
 * stays on the page, or a group added a moment ago has nothing to click.
 */
function isDrawn(group: ListGroup) {
  return Boolean(group.items.length || group.select)
}

/**
 * One group of a list — grouped or flat — as the one block it is.
 *
 * A group with a label is the shape Skills draws as; a group without one is a
 * plain bulleted list. This is the one home a list of things gets — rich text
 * may contain a bullet list because markdown does, but the app never offers
 * one there.
 *
 * The whole group is one block, category and skills together, so a category is
 * never separated from the skills it names.
 */
function ListEntry({ group, mode }: { group: ListGroup; mode: RenderMode }) {
  const select = selectable(group.select)

  if (!group.label) {
    return (
      <ul
        className={`list-disc pl-resume-bullet ${select.className}`}
        {...select.attributes}
      >
        {group.items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    )
  }

  return (
    <div
      className={`${
        mode === "page"
          ? "flex gap-resume-inline"
          : "flex flex-col gap-resume-inline"
      } ${select.className}`}
      {...select.attributes}
    >
      <h3 className="resume-entry-name whitespace-nowrap">{group.label}</h3>

      {/*
        A labelled group's items read across the line rather than down it: a
        skill category is a handful of short names, and a bullet per name would
        cost more page than the scanning is worth. They are still one list item
        each and spaced apart, so the group reads as distinct things rather than
        as one run of commas.
      */}
      <ul className="flex min-w-0 flex-1 flex-wrap gap-x-resume-entry gap-y-resume-inline">
        {group.items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

/** Discrete short items as distinct marks, so they don't read as a run-on. */
function TagList({ tags }: { tags: { key: string; label: ReactNode }[] }) {
  return (
    <ul className="flex flex-wrap gap-resume-inline">
      {tags.map((tag) => (
        <li
          className={`${marker.tag} rounded-resume-tag border-resume-tag border-resume-tag-border bg-resume-tag-surface px-resume-tag-x py-resume-tag-y`}
          key={tag.key}
        >
          {tag.label}
        </li>
      ))}
    </ul>
  )
}

/** An icon paired with a short label, in a row. The label carries the meaning. */
function IconList({ icons }: { icons: IconEntry[] }) {
  return (
    <ul className="flex flex-wrap gap-resume-entry">
      {icons.map((entry) => (
        <li className="flex items-center gap-resume-inline" key={entry.key}>
          {entry.icon && <ResumeIcon name={entry.icon} />}
          <span>{entry.label}</span>
        </li>
      ))}
    </ul>
  )
}
