import { type ReactNode } from "react"
import {
  isResumeIconName,
  ResumeIcon,
  type ResumeIconName
} from "~/components/resume-icon"
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
  key: string
  left: ReactNode
  right: ReactNode
  /**
   * What clicking this row selects, when the document is being edited.
   *
   * Absent everywhere else, which is what keeps selection out of the PDF: a
   * shape drawn without a handle emits no click target and no outline.
   */
  select?: SelectHandle | null
}

/** A flat list is one group with no label. */
export type ListGroup = {
  key: string
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
  Body: (props: { shape: ShapeIn<Type>; mode: RenderMode }) => ReactNode
}

const shapeSpecs: { [Type in SectionComponentType]: ShapeSpec<Type> } = {
  richText: {
    fromContent: (content) => {
      const parsed = parseSectionContent("richText", content)

      return parsed && { componentType: "richText", markdown: parsed.markdown }
    },
    isEmpty: (shape) => !shape.markdown.trim(),
    Body: ({ shape }) => <RichText markdown={shape.markdown} />
  },

  twoColumn: {
    fromContent: (content) => {
      const parsed = parseSectionContent("twoColumn", content)

      return (
        parsed && {
          componentType: "twoColumn",
          rows: parsed.rows.map((row, index) => ({
            key: String(index),
            left: row.left,
            right: row.right
          }))
        }
      )
    },
    isEmpty: (shape) => !shape.rows.length,
    Body: ({ shape, mode }) => <TwoColumn mode={mode} rows={shape.rows} />
  },

  list: {
    fromContent: (content) => {
      const parsed = parseSectionContent("list", content)

      // One unlabelled group: a custom list is flat, where Skills is grouped.
      // Grouped custom lists wait on a content payload that can carry a label —
      // the section schema is not this spec's to change.
      return (
        parsed && {
          componentType: "list",
          groups: [{ key: "items", items: parsed.items }]
        }
      )
    },
    isEmpty: (shape) => !shape.groups.some((group) => group.items.length),
    Body: ({ shape, mode }) => <List groups={shape.groups} mode={mode} />
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
    Body: ({ shape }) => <TagList tags={shape.tags} />
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
    Body: ({ shape }) => <IconList icons={shape.icons} />
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
 * One section: its heading, its rule, and its content in the shape it draws as.
 *
 * An empty section is a visible placeholder in the editor and nothing at all in
 * the document — a blank section in the editor would be a zero-height element
 * with nothing to click, and a placeholder in a finished PDF is worse than a
 * gap.
 */
export function ResumeSection({
  label,
  shape,
  render,
  select
}: {
  label: ReactNode
  shape: SectionShape
  render: RenderOptions
  /** Selecting the section itself — its name, its place, its entries. */
  select?: SelectHandle | null
}) {
  const { isEmpty, Body } = specFor(shape.componentType)
  const empty = isEmpty(shape)
  const heading = selectable(select)

  if (empty && !render.isEditor) return null

  return (
    <section className="pb-resume-section">
      {/*
        The heading and its rule stay with the content that follows them:
        `break-after: avoid` is what stops a section title stranding alone at
        the foot of a page with its first entry overleaf.

        The heading is also the section's own click target: clicking a job
        selects the job, so selecting the section it sits in needs somewhere of
        its own to click.
      */}
      <div
        className={`break-inside-avoid break-after-avoid ${heading.className}`}
        {...heading.attributes}
      >
        <h2 className="text-resume-heading font-semibold uppercase">{label}</h2>

        <div className="pb-resume-rule-gap pt-resume-rule-gap">
          <hr className="h-resume-rule rounded border-0 bg-current" />
        </div>
      </div>

      {empty ? (
        <p className={`${marker.placeholder} text-resume-muted`}>
          Nothing here yet
        </p>
      ) : (
        <Body mode={render.mode} shape={shape} />
      )}
    </section>
  )
}

/** Bold, links and bullet lists. Everything else is text — see the parser. */
function RichText({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-resume-inline">
      {renderResumeMarkdown(markdown)}
    </div>
  )
}

/**
 * A left column — conventionally dates — and a right column of content.
 *
 * The columns stack in reflow rather than narrowing: two columns inside a 390px
 * viewport is how a date range ends up one character wide. Reading order is the
 * same either way, so the stack costs the document nothing.
 */
function TwoColumn({ rows, mode }: { rows: TwoColumnRow[]; mode: RenderMode }) {
  const isPage = mode === "page"

  return (
    <div className="space-y-resume-entry">
      {rows.map((row) => (
        <TwoColumnEntry isPage={isPage} key={row.key} row={row} />
      ))}
    </div>
  )
}

function TwoColumnEntry({
  row,
  isPage
}: {
  row: TwoColumnRow
  isPage: boolean
}) {
  const select = selectable(row.select)

  return (
    <div
      className={`${marker.row} break-inside-avoid ${
        isPage ? "flex gap-resume-entry" : "flex flex-col gap-resume-inline"
      } ${select.className}`}
      {...select.attributes}
    >
      <div
        className={isPage ? "w-resume-left-column shrink-0" : "font-semibold"}
      >
        {row.left}
      </div>

      <div className="min-w-0 flex-1">{row.right}</div>
    </div>
  )
}

/**
 * Grouped or flat entries.
 *
 * A group with a label is the shape Skills draws as; a group without one is a
 * plain bulleted list. This is the one home a list of things gets — rich text
 * may contain a bullet list because markdown does, but the app never offers
 * one there.
 */
function List({ groups, mode }: { groups: ListGroup[]; mode: RenderMode }) {
  return (
    <div className="space-y-resume-inline">
      {groups.map((group) => (
        <ListEntry group={group} key={group.key} mode={mode} />
      ))}
    </div>
  )
}

function ListEntry({ group, mode }: { group: ListGroup; mode: RenderMode }) {
  const select = selectable(group.select)

  // An empty group is nothing in the document — but where it can be selected
  // it stays on the page, or a group added a moment ago has nothing to click.
  if (!group.items.length && !group.select) return null

  if (!group.label) {
    return (
      <ul
        className={`list-disc break-inside-avoid pl-resume-bullet ${select.className}`}
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
      className={`break-inside-avoid ${
        mode === "page"
          ? "flex gap-resume-inline"
          : "flex flex-col gap-resume-inline"
      } ${select.className}`}
      {...select.attributes}
    >
      <h3 className="whitespace-nowrap font-semibold">{group.label}</h3>

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
          className={`${marker.tag} rounded-resume-tag bg-resume-tag-surface px-resume-tag-x py-resume-tag-y`}
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
