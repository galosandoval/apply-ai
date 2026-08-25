import { Fragment, type ReactNode } from "react"
import {
  customSectionShape,
  type ListGroup,
  type RenderMode,
  type RenderOptions,
  ResumeSection,
  type SectionShape,
  type TwoColumnRow
} from "~/components/resume-section"
import {
  isSameSelection,
  type ResumeSelection,
  rowListFor,
  selectable,
  type SelectHandle
} from "~/lib/resume-selection"
import {
  type CoreSectionKind,
  coreSectionDefaults,
  isCoreSectionKind
} from "~/lib/section-content"
import {
  type ResumeStyle,
  resumeStyleClass,
  toResumeStyle
} from "~/lib/resume-style"
import { type InsertResumeSchema } from "~/server/db/crud-schema"

/**
 * One section of the document as it is drawn.
 *
 * `kind` and `componentType` are `string` rather than their unions because that
 * is what the column holds: the renderer is what a row with junk in it reaches,
 * so it narrows rather than assumes.
 */
export type ResumeDocumentSection = {
  id: string
  kind: string
  label: string
  componentType: string
  position: number
  /** Custom sections only — a core section's content is its typed rows. */
  content?: unknown
}

/**
 * Everything the resume template renders. Deliberately not a Zod-derived type:
 * the editor and the PDF each assemble it from a different source, and this is
 * the contract they agree on.
 */
export type ResumeDocumentData = {
  profession: string
  /** The resume's own snapshot, not the account's — see `schema.contact`. */
  contact: InsertResumeSchema["contact"]
  skill: InsertResumeSchema["skill"]
  experience: InsertResumeSchema["experience"]
  education: InsertResumeSchema["education"]
  /**
   * The sections to draw, in `position` order. Optional because a payload may
   * arrive without any — the PDF of a document that predates them — and falls
   * back to the order a new resume is created with. A saved resume carries its
   * sections everywhere it is drawn, the PDF included, or the print would not
   * be the document the user was looking at.
   */
  sections?: ResumeDocumentSection[]
  /**
   * The typographic direction the resume is drawn in.
   *
   * A plain `string` because that is what the column holds, and narrowed at the
   * one place it becomes a class. Absent means the default — a resume created
   * before styles existed, or a PDF payload assembled without one.
   */
  style?: string
  /**
   * The accent the style fixed when it was chosen, as `#rrggbb`.
   *
   * Applied over the style's own value so that retuning a direction later does
   * not repaint a resume that has already been sent. Anything that is not a hex
   * colour is ignored rather than written into a `style` attribute.
   */
  accent?: string
}

/**
 * What the editor selects with, and what it has selected.
 *
 * Optional everywhere: without it this is a pure read-only render — no click
 * targets, no outline, no attributes — which is exactly what the PDF and the
 * parseability check want, and what keeps an editor concern out of a print.
 */
export type DocumentSelection = {
  selected: ResumeSelection | null
  onSelect: (selection: ResumeSelection) => void
}

/**
 * The sections a resume is drawn with before it has any of its own.
 *
 * Derived from the same list the server creates a resume's rows from, so a
 * document without sections and the resume it becomes render the same way.
 */
const defaultSections: ResumeDocumentSection[] = coreSectionDefaults.map(
  (section, position) => ({ ...section, id: section.kind, position })
)

/**
 * Everything the sections need, passed as one prop rather than through context
 * — context is a client-only API, and this tree renders on the server too.
 */
type Doc = {
  data: ResumeDocumentData
  render: RenderOptions
  selection?: DocumentSelection
}

/**
 * The one resume template. Props in, markup out — no form state, no ids for a
 * browser to inject into. Rendered by the editor and by the PDF so the two stay
 * in agreement.
 *
 * Read-only, always: editing is a panel beside the document, not an input
 * inside it. `selection` adds click targets and an outline for the editor, and
 * `isEditor` makes an empty section and an empty field visible rather than
 * absent — a blank the user cannot see is a blank they cannot fill in.
 */
export function ResumeDocument({
  data,
  mode = "page",
  isEditor = false,
  selection
}: {
  data: ResumeDocumentData
  mode?: RenderMode
  isEditor?: boolean
  selection?: DocumentSelection
}) {
  const doc: Doc = { data, render: { mode, isEditor }, selection }

  // Sorted here rather than trusted from the caller: render order is data, and
  // this is the one place that decides what the data means.
  const sections = [...(data.sections ?? defaultSections)].sort(
    (left, right) => left.position - right.position
  )

  return (
    /*
      Normal flow, not a fixed `h-[29.7cm]` with `overflow-hidden`: content past
      the first page used to be silently deleted from the document. The page
      still has a printable width in page mode; height is whatever the content
      needs, and `break-inside: avoid` on each entry keeps a job off a page
      boundary.
    */
    <div
      className={documentClassName(mode, toResumeStyle(data.style))}
      style={accentOverride(data.accent)}
    >
      <Header doc={doc} />

      {sections.map((section) => (
        <DocumentSection doc={doc} key={section.id} section={section} />
      ))}
    </div>
  )
}

/**
 * The page, or the phone, in one of three styles.
 *
 * Both are one class that re-values tokens — everything below reads the same
 * tokens, which is why the two modes cannot disagree about what the document
 * says and why no component below here has ever heard of a style. Adding a
 * fourth direction is an overlay in `global.css` and a name in
 * `~/lib/resume-style`; nothing in this file changes.
 *
 * Each mode carries its own marker class. `resume-page` names the A4 page and
 * nothing else, so an assertion about the page is not also an assertion about
 * the phone.
 */
function documentClassName(mode: RenderMode, style: ResumeStyle) {
  const shared = `resume-document ${resumeStyleClass(style)} bg-resume-paper px-resume-page-x py-resume-page-y text-resume-body`

  return mode === "page"
    ? `${shared} resume-page w-resume-page rounded-resume-page`
    : `${shared} resume-reflow w-full`
}

/**
 * The resume's own accent, as a token override on the document root.
 *
 * A style overlay fixes an accent; this is the copy that was written onto the
 * resume when the style was chosen, and it wins — so retuning a direction never
 * repaints a document someone already sent.
 *
 * Validated as `#rgb` / `#rrggbb` rather than trusted. The value reaches a
 * `style` attribute, and the column is `text`.
 */
function accentOverride(accent: string | undefined) {
  if (!accent || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent))
    return undefined

  return { "--resume-ink-accent": accent } as React.CSSProperties
}

/**
 * How one selectable thing asks whether it is selected.
 *
 * `null` when the document is not being edited, which is what makes the
 * read-only render emit no selection markup at all.
 */
function handleFor(doc: Doc, selection: ResumeSelection): SelectHandle | null {
  const { selection: state } = doc

  if (!state) return null

  return {
    isSelected: isSameSelection(state.selected, selection),
    onSelect: () => state.onSelect(selection)
  }
}

/**
 * One string as the document draws it.
 *
 * Empty is nothing in the document and a visible stand-in in the editor: a job
 * added a moment ago is all empty strings, and a row with no height is a row
 * with nothing to click.
 */
function Text({
  doc,
  value,
  className = "",
  multiline = false
}: {
  doc: Doc
  value: string | null | undefined
  className?: string
  multiline?: boolean
}) {
  // Multiline text keeps the newlines it was typed with instead of collapsing
  // them to a space.
  const textClassName = multiline
    ? `${className} whitespace-pre-line`
    : className

  if (!value) {
    return doc.render.isEditor ? (
      <span className={`${className} text-resume-muted`}>&mdash;</span>
    ) : null
  }

  return <span className={textClassName}>{value}</span>
}

/**
 * One section, drawn as whichever shape it configures.
 *
 * A core section is dispatched on its `kind` and fed by its typed rows; a
 * custom one is dispatched on its `componentType` and fed by its own content.
 * Neither gets a renderer of its own — that is the whole point.
 */
function DocumentSection({
  doc,
  section
}: {
  doc: Doc
  section: ResumeDocumentSection
}) {
  const shape = isCoreSectionKind(section.kind)
    ? coreShape(doc, section.kind)
    : customSectionShape(section.componentType, section.content)

  if (!shape) return null

  return (
    <ResumeSection
      label={section.label}
      render={doc.render}
      select={handleFor(doc, { kind: "section", sectionId: section.id })}
      shape={shape}
    />
  )
}

/**
 * A core section as a pre-configured instance of a base shape.
 *
 * Its structure is fixed and its content comes from its typed rows — a user
 * cannot restructure Experience through the renderer, which is what keeps it
 * machine-readable for the scoring work.
 */
function coreShape(doc: Doc, kind: CoreSectionKind): SectionShape {
  switch (kind) {
    case "experience":
      return { componentType: "twoColumn", rows: experienceRows(doc) }
    case "education":
      return { componentType: "twoColumn", rows: educationRows(doc) }
    case "skills":
      return { componentType: "list", groups: skillGroups(doc) }
  }
}

/** The selection a row of a core section carries, by the row's own id. */
function rowHandle(doc: Doc, kind: CoreSectionKind, rowId: string | undefined) {
  const list = rowListFor(kind)

  if (!list || !rowId) return null

  return handleFor(doc, { kind: "row", list: list.key, rowId })
}

function experienceRows(doc: Doc): TwoColumnRow[] {
  return doc.data.experience.map((job, index) => ({
    ...entryRow(doc, {
      key: job.id ?? String(index),
      start: job.startDate,
      end: job.endDate,
      name: job.name,
      detail: job.title,
      body: (
        <ul className="list-disc pl-resume-bullet">
          {job.bullets.map((bullet, bulletIndex) => (
            <li className="whitespace-pre-line" key={bulletIndex}>
              {bullet}
            </li>
          ))}
        </ul>
      )
    }),
    select: rowHandle(doc, "experience", job.id)
  }))
}

function educationRows(doc: Doc): TwoColumnRow[] {
  return doc.data.education.map((school, index) => ({
    ...entryRow(doc, {
      key: school.id ?? String(index),
      start: school.startDate,
      end: school.endDate,
      name: school.name,
      detail: school.degree,
      body: <Text doc={doc} multiline value={school.description} />
    }),
    select: rowHandle(doc, "education", school.id)
  }))
}

/**
 * One chronology entry: dates on the left, and on the right a bold name, the
 * role or degree beside it, then the entry's body.
 *
 * Experience and Education differ only in what the second heading field is
 * called and what the body is, so they share the shape rather than each holding
 * a copy that a style change would have to find twice.
 */
function entryRow(
  doc: Doc,
  {
    key,
    start,
    end,
    name,
    detail,
    body
  }: {
    key: string
    start: string
    end: string
    name: string
    detail: string
    body: ReactNode
  }
): TwoColumnRow {
  return {
    key,
    /*
      The date range wraps inside its column rather than running out of it.
      `whitespace-nowrap` here meant a long range — "Sep 2016 - May 2018" — sat
      on top of the employer name in any style whose column is narrower than the
      text, which is a layout the token set is supposed to be free to choose.
    */
    left: (
      <p className="resume-dates">
        <Text doc={doc} value={start} /> - <Text doc={doc} value={end} />
      </p>
    ),
    right: (
      <>
        <div className="resume-entry-name">
          <Text doc={doc} value={name} />,{" "}
          <Text className="resume-entry-detail" doc={doc} value={detail} />
        </div>

        {body}
      </>
    )
  }
}

/**
 * Skills as labelled groups — the category is the label, and each skill in the
 * group is one entry.
 *
 * `skill.<row>.all` is one string in the database and in the panel, and one
 * item per skill on the page: a long list reads as things rather than as a run
 * of commas, and the split lives here because the document is where it means
 * something.
 */
function skillGroups(doc: Doc): ListGroup[] {
  return doc.data.skill.map((group, index) => ({
    key: group.id ?? String(index),
    label: <Text doc={doc} value={group.category} />,
    items: splitSkills(group.all).map((skill, at) => (
      <Fragment key={at}>{skill}</Fragment>
    )),
    select: rowHandle(doc, "skills", group.id)
  }))
}

/** The stored line as the skills it lists. A trailing comma names nothing. */
function splitSkills(all: string) {
  return all
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean)
}

function Header({ doc }: { doc: Doc }) {
  const { data } = doc
  const select = selectable(handleFor(doc, { kind: "header" }))

  const contactFields = [
    data.contact.location,
    data.contact.email,
    data.contact.linkedIn ?? "",
    data.contact.portfolio ?? "",
    data.contact.phone ?? ""
  ].filter(Boolean)

  return (
    <div
      className={`flex flex-col items-center pb-resume-inline ${select.className}`}
      {...select.attributes}
    >
      <div className="justify-self-center">
        <h1 className="resume-name text-resume-name text-resume-accent">
          <Text doc={doc} value={data.contact.fullName} />
        </h1>
      </div>

      <h2 className="resume-title text-resume-title">
        <Text doc={doc} value={data.profession} />
      </h2>

      <div className="mx-auto flex flex-wrap justify-center gap-resume-inline text-center">
        {contactFields.map((value, index) => (
          <Fragment key={value}>
            <ContactLine value={value} />
            {index !== contactFields.length - 1 && <span>&bull;</span>}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

/**
 * Contact details render as links so they stay clickable in the preview and the
 * PDF.
 *
 * The URL is the label. Rendering "LinkedIn" over an `href` puts the address in
 * the link target only, where the PDF's text layer — and anything parsing it —
 * cannot see it.
 */
function ContactLine({ value }: { value: string }) {
  if (value.includes("@")) {
    return <ContactLink href={`mailto:${value}`} label={value} />
  }

  if (/^(https?:\/\/|www\.)/.test(value) || value.includes(".com")) {
    return <ContactLink href={toHref(value)} label={value} />
  }

  return <span>{value}</span>
}

/** A bare `linkedin.com/in/me` still has to be a working link. */
function toHref(value: string) {
  return /^https?:\/\//.test(value) ? value : `https://${value}`
}

function ContactLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="text-resume-link underline"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {label}
    </a>
  )
}
