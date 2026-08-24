import { ClassValue } from "clsx"
import { Fragment, type ReactNode } from "react"
import { type FieldPath, type FieldPathValue } from "react-hook-form"
import { PlainField } from "~/components/plain-field"
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
  type CoreSectionKind,
  coreSectionDefaults,
  isCoreSectionKind
} from "~/lib/section-content"
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
 * the editor, the draft preview and the PDF each assemble it from a different
 * source, and this is the contract they agree on.
 */
export type ResumeDocumentData = {
  profession: string
  /** The resume's own snapshot, not the account's — see `schema.contact`. */
  contact: InsertResumeSchema["contact"]
  skill: InsertResumeSchema["skill"]
  experience: InsertResumeSchema["experience"]
  education: InsertResumeSchema["education"]
  /**
   * The sections to draw, in `position` order. Optional because the draft
   * preview is editing a resume that does not exist yet and so has none of its
   * own — it falls back to the order a new resume is created with. A saved
   * resume carries its sections everywhere it is drawn, the PDF included, or
   * the print would not be the document the user was looking at.
   */
  sections?: ResumeDocumentSection[]
}

/**
 * The document minus its sections.
 *
 * A section is addressed by id through its own grammar (`section.<id>.label`),
 * not by array index, so admitting `sections.0.kind` into the path type would
 * offer click targets no writer accepts.
 */
type ResumeDocumentFields = Omit<ResumeDocumentData, "sections">

/**
 * The address of a single editable string, e.g. `experience.0.bullets.2`.
 *
 * Borrowed from react-hook-form so the same string is simultaneously the click
 * target's identity, a `setValue` key, and (later) the scope handed to a
 * "rewrite this section" call.
 *
 * Narrowed to paths whose value is actually a string: bare `FieldPath` also
 * admits `experience.0` and `experience.0.bullets`, which would render as an
 * empty click target and let `setValue` write a string over an array.
 *
 * Taken from the document rather than from an insert schema, because the
 * document is what a path addresses.
 */
export type ResumeFieldPath = {
  [Path in FieldPath<ResumeDocumentFields>]: NonNullable<
    FieldPathValue<ResumeDocumentFields, Path>
  > extends string
    ? Path
    : never
}[FieldPath<ResumeDocumentFields>]

export type OnEditField = (path: ResumeFieldPath, value: string) => void

export type EditableTag = "span" | "p" | "li" | "h1" | "h2" | "h3" | "div"

export type FieldProps = {
  path: ResumeFieldPath
  value: string
  as?: EditableTag
  multiline?: boolean
  className?: string
}

/**
 * How one string is drawn. The read-only default is plain tags; the editor
 * swaps in a click-to-edit field.
 *
 * This is the whole reason the template has no state of its own: a component
 * that calls `useState` cannot be rendered from a route handler, and the PDF
 * is rendered from a route handler.
 */
export type FieldRenderer = (props: FieldProps) => ReactNode

/** Walks a dotted path down the document data. Array indices are just keys. */
export function readTextAtPath(data: ResumeDocumentData, path: string) {
  const value = path
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current == null ? undefined : (current as Record<string, unknown>)[key],
      data
    )

  return typeof value === "string" ? value : ""
}

/**
 * The sections a resume is drawn with before it has any of its own — an unsaved
 * draft, or the PDF of one.
 *
 * Derived from the same list the server creates a resume's rows from, so a
 * draft and the resume it becomes render the same document.
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
  renderField: FieldRenderer
  canEditPath: (path: ResumeFieldPath) => boolean
}

/**
 * The one resume template. Props in, markup out — no form state, no ids for a
 * browser to inject into. Rendered by the editor, the draft preview and the
 * PDF so all three stay in agreement.
 *
 * Read-only by default. `renderField` and `canEditPath` together are what make
 * it an editor; `isEditor` is the document-level half of the same question, for
 * the sections that have no field of their own to ask about.
 */
export function ResumeDocument({
  data,
  mode = "page",
  isEditor = false,
  renderField = PlainField,
  canEditPath = () => false
}: {
  data: ResumeDocumentData
  mode?: RenderMode
  isEditor?: boolean
  renderField?: FieldRenderer
  canEditPath?: (path: ResumeFieldPath) => boolean
}) {
  const doc: Doc = {
    data,
    render: { mode, isEditor },
    renderField,
    canEditPath
  }

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
    <div className={documentClassName(mode)}>
      <Header doc={doc} />

      {sections.map((section) => (
        <DocumentSection doc={doc} key={section.id} section={section} />
      ))}
    </div>
  )
}

/**
 * The page, or the phone.
 *
 * Reflow only swaps the width and turns the token overrides on — everything
 * below it reads the same tokens, which is why the two modes cannot disagree
 * about what the document says.
 *
 * Each mode carries its own marker class. `resume-page` names the A4 page and
 * nothing else, so an assertion about the page is not also an assertion about
 * the phone.
 */
function documentClassName(mode: RenderMode) {
  const shared = "bg-white px-resume-page-x py-resume-page-y text-resume-body"
  return mode === "page"
    ? `${shared} resume-page w-resume-page rounded-md`
    : `${shared} resume-reflow w-full`
}

/** Draws one field, reading its text out of the document data by path. */
function Field({
  doc,
  path,
  ...rest
}: { doc: Doc } & Omit<FieldProps, "value">) {
  return (
    <Fragment>
      {doc.renderField({
        ...rest,
        path,
        value: readTextAtPath(doc.data, path)
      })}
    </Fragment>
  )
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
    <ResumeSection label={section.label} render={doc.render} shape={shape} />
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

function experienceRows(doc: Doc): TwoColumnRow[] {
  return doc.data.experience.map((job, index) =>
    entryRow(doc, {
      key: job.id ?? String(index),
      startPath: `experience.${index}.startDate`,
      endPath: `experience.${index}.endDate`,
      namePath: `experience.${index}.name`,
      detailPath: `experience.${index}.title`,
      body: (
        <ul className="list-disc pl-resume-bullet">
          {job.bullets.map((_, bulletIndex) => (
            <Field
              as="li"
              doc={doc}
              key={bulletIndex}
              multiline
              path={`experience.${index}.bullets.${bulletIndex}`}
            />
          ))}
        </ul>
      )
    })
  )
}

function educationRows(doc: Doc): TwoColumnRow[] {
  return doc.data.education.map((school, index) =>
    entryRow(doc, {
      key: school.id ?? String(index),
      startPath: `education.${index}.startDate`,
      endPath: `education.${index}.endDate`,
      namePath: `education.${index}.name`,
      detailPath: `education.${index}.degree`,
      body: (
        <Field
          as="p"
          doc={doc}
          multiline
          path={`education.${index}.description`}
        />
      )
    })
  )
}

/**
 * One chronology entry: dates on the left, and on the right a bold name, the
 * role or degree beside it, then the entry's body.
 *
 * Experience and Education differ only in what the second heading field is
 * called and what the body is, so they share the shape rather than each holding
 * a copy that a style change would have to find twice.
 *
 * Paths arrive built rather than assembled from a stem here: `ResumeFieldPath`
 * only checks a template literal at the site that writes it, and that check is
 * the whole reason a path is typed.
 */
function entryRow(
  doc: Doc,
  {
    key,
    startPath,
    endPath,
    namePath,
    detailPath,
    body
  }: {
    key: string
    startPath: ResumeFieldPath
    endPath: ResumeFieldPath
    namePath: ResumeFieldPath
    detailPath: ResumeFieldPath
    body: ReactNode
  }
): TwoColumnRow {
  return {
    key,
    left: <DateRange doc={doc} endPath={endPath} startPath={startPath} />,
    right: (
      <>
        <div className="font-semibold">
          <Field doc={doc} path={namePath} />,{" "}
          <Field className="font-normal italic" doc={doc} path={detailPath} />
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
 * `skill.<row>.all` is a single editable string, so where it is editable it
 * stays one field: two representations of the same content is exactly what the
 * component set exists to avoid, and a click target per comma-separated word is
 * not a thing the user can write to. Where it is only read — the document, the
 * PDF, the parseability check — it is split into one item per skill, which is
 * what makes a long list scannable rather than a run of commas.
 */
function skillGroups(doc: Doc): ListGroup[] {
  return doc.data.skill.map((group, index) => {
    const path = `skill.${index}.all` as const

    return {
      key: group.id ?? String(index),
      label: <Field doc={doc} path={`skill.${index}.category`} />,
      items: doc.canEditPath(path)
        ? [<Field doc={doc} key="all" multiline path={path} />]
        : splitSkills(group.all).map((skill, at) => (
            <Fragment key={at}>{skill}</Fragment>
          ))
    }
  })
}

/** The stored line as the skills it lists. A trailing comma names nothing. */
function splitSkills(all: string) {
  return all
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean)
}

function Header({ doc }: { doc: Doc }) {
  const { data, canEditPath } = doc

  const allContactFields: { path: ResumeFieldPath; value: string }[] = [
    { path: "contact.location", value: data.contact.location },
    { path: "contact.email", value: data.contact.email },
    { path: "contact.linkedIn", value: data.contact.linkedIn ?? "" },
    { path: "contact.portfolio", value: data.contact.portfolio ?? "" },
    { path: "contact.phone", value: data.contact.phone ?? "" }
  ]

  // A blank contact is dropped from the rendered document, but kept as an empty
  // placeholder where it's editable — otherwise there's no way to fill it in.
  const contactFields = allContactFields.filter(
    (field) => field.value || canEditPath(field.path)
  )

  return (
    <div className="flex flex-col items-center pb-resume-inline">
      <div className="justify-self-center">
        <Field
          as="h1"
          className="text-resume-name font-bold"
          doc={doc}
          path="contact.fullName"
        />
      </div>

      <Field
        as="h2"
        className="text-resume-title font-bold tracking-wide"
        doc={doc}
        path="profession"
      />

      <div className="mx-auto flex flex-wrap justify-center gap-resume-inline text-center">
        {contactFields.map((field, index) => (
          <Fragment key={field.path}>
            <ContactLine doc={doc} path={field.path} value={field.value} />
            {index !== contactFields.length - 1 && <span>&bull;</span>}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function DateRange({
  doc,
  startPath,
  endPath
}: {
  doc: Doc
  startPath: ResumeFieldPath
  endPath: ResumeFieldPath
}) {
  return (
    <p className="whitespace-nowrap">
      <Field doc={doc} path={startPath} /> - <Field doc={doc} path={endPath} />
    </p>
  )
}

/**
 * Contact details render as links so they stay clickable in the preview and the
 * PDF — but a link that opens on click can't also be a click-to-edit target,
 * so the editor gets the plain field instead.
 */
function ContactLine({
  doc,
  path,
  value
}: {
  doc: Doc
  path: ResumeFieldPath
  value: string
}) {
  if (doc.canEditPath(path)) {
    return <Field doc={doc} path={path} />
  }

  // The URL is the label. Rendering "LinkedIn" over an `href` puts the address
  // in the link target only, where the PDF's text layer — and anything parsing
  // it — cannot see it.
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
