import { type ReactNode } from "react"
import { ResumeIcon } from "~/components/resume-icon"
import { renderResumeMarkdown } from "~/lib/resume-markdown"

/**
 * The five shapes a resume section can draw as — the whole rendering system.
 *
 * A section type is a *configuration* of one of these, never a renderer of its
 * own: a custom section is a user-created instance, and a core section is a
 * pre-configured one fed by its typed rows. That is what gives a style one
 * surface to land on instead of one per section.
 *
 * Adding a sixth shape is a deliberate act. Every type multiplies the work in
 * the editor and in the style, so the set stays small on purpose.
 */

/**
 * Page mode is the A4 document — desktop and the PDF. Reflow abandons the page
 * and lays the same sections out for a narrow screen; it is not a scaled-down
 * page, and it is driven by this one prop so the two cannot show different
 * content.
 */
export type RenderMode = "page" | "reflow"

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

export type TwoColumnRow = { key: string; left: ReactNode; right: ReactNode }

/** A flat list is one group with no label. */
export type ListGroup = { key: string; label?: ReactNode; items: ReactNode[] }

export type IconEntry = { key: string; icon: string; label: ReactNode }

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
  mode,
  isEditor
}: {
  label: ReactNode
  shape: SectionShape
  mode: RenderMode
  isEditor: boolean
}) {
  const isEmpty = isEmptyShape(shape)

  if (isEmpty && !isEditor) return null

  return (
    <section className="pb-resume-section">
      <h2 className="text-resume-heading font-semibold uppercase">{label}</h2>

      <div className="pb-resume-rule-gap pt-resume-rule-gap">
        <hr className="h-resume-rule rounded border-0 bg-current" />
      </div>

      {isEmpty ? (
        <p className={`${marker.placeholder} text-resume-muted`}>
          Nothing here yet
        </p>
      ) : (
        <SectionBody mode={mode} shape={shape} />
      )}
    </section>
  )
}

/** True when a shape would draw no content. */
function isEmptyShape(shape: SectionShape) {
  switch (shape.componentType) {
    case "richText":
      return !shape.markdown.trim()
    case "twoColumn":
      return !shape.rows.length
    case "list":
      return !shape.groups.some((group) => group.items.length)
    case "tagList":
      return !shape.tags.length
    case "iconList":
      return !shape.icons.length
  }
}

function SectionBody({
  shape,
  mode
}: {
  shape: SectionShape
  mode: RenderMode
}) {
  switch (shape.componentType) {
    case "richText":
      return <RichText markdown={shape.markdown} />
    case "twoColumn":
      return <TwoColumn mode={mode} rows={shape.rows} />
    case "list":
      return <List groups={shape.groups} mode={mode} />
    case "tagList":
      return <TagList tags={shape.tags} />
    case "iconList":
      return <IconList icons={shape.icons} />
  }
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
        <div
          className={`${marker.row} break-inside-avoid ${
            isPage ? "flex gap-resume-entry" : "flex flex-col gap-resume-inline"
          }`}
          key={row.key}
        >
          <div
            className={
              isPage ? "w-resume-left-column shrink-0" : "font-semibold"
            }
          >
            {row.left}
          </div>

          <div className="min-w-0 flex-1">{row.right}</div>
        </div>
      ))}
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
  if (!group.items.length) return null

  if (!group.label) {
    return (
      <ul className="list-disc break-inside-avoid pl-resume-bullet">
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
      }`}
    >
      <h3 className="whitespace-nowrap font-semibold">{group.label}</h3>

      <ul className="min-w-0 flex-1">
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
          <ResumeIcon name={entry.icon} />
          <span>{entry.label}</span>
        </li>
      ))}
    </ul>
  )
}
