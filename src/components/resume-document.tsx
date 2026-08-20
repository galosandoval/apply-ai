import { Fragment, type ReactNode } from "react"
import { type FieldPath, type FieldPathValue } from "react-hook-form"
import { PlainField } from "~/components/plain-field"
import { type InsertResumeSchema } from "~/server/db/crud-schema"

/**
 * Everything the resume template renders. Deliberately not a Zod-derived type:
 * the editor, the draft preview and the PDF each assemble it from a different
 * source, and this is the contract they agree on.
 */
export type ResumeDocumentData = {
  fullName: string
  profession: string
  email: string
  location: string
  phone?: string
  linkedIn?: string
  portfolio?: string
  skills: InsertResumeSchema["skills"]
  experience: InsertResumeSchema["experience"]
  education: InsertResumeSchema["education"]
}

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
 */
export type ResumeFieldPath = {
  [Path in FieldPath<InsertResumeSchema>]: NonNullable<
    FieldPathValue<InsertResumeSchema, Path>
  > extends string
    ? Path
    : never
}[FieldPath<InsertResumeSchema>]

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
 * Everything the sections need, passed as one prop rather than through context
 * — context is a client-only API, and this tree renders on the server too.
 */
type Doc = {
  data: ResumeDocumentData
  renderField: FieldRenderer
  canEditPath: (path: ResumeFieldPath) => boolean
}

/**
 * The one resume template. Props in, markup out — no form state, no ids for a
 * browser to inject into. Rendered by the editor, the draft preview and the
 * PDF so all three stay in agreement.
 *
 * Read-only by default. `renderField` and `canEditPath` together are what make
 * it an editor.
 */
export function ResumeDocument({
  data,
  renderField = PlainField,
  canEditPath = () => false
}: {
  data: ResumeDocumentData
  renderField?: FieldRenderer
  canEditPath?: (path: ResumeFieldPath) => boolean
}) {
  const doc: Doc = { data, renderField, canEditPath }

  return (
    /*
      Normal flow, not a fixed `h-[29.7cm]` with `overflow-hidden`: content past
      the first page used to be silently deleted from the document. The page
      still has a printable width; height is whatever the content needs, and
      `break-inside: avoid` keeps a job off a page boundary.
    */
    <div className="w-[21cm] rounded-md bg-white px-10 py-8 text-10pt">
      <Header doc={doc} />

      <Skills doc={doc} />

      <Experience doc={doc} />

      <Education doc={doc} />
    </div>
  )
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

function Header({ doc }: { doc: Doc }) {
  const { data, canEditPath } = doc

  const allContactFields: { path: ResumeFieldPath; value: string }[] = [
    { path: "location", value: data.location },
    { path: "email", value: data.email },
    { path: "linkedIn", value: data.linkedIn ?? "" },
    { path: "portfolio", value: data.portfolio ?? "" },
    { path: "phone", value: data.phone ?? "" }
  ]

  // A blank contact is dropped from the rendered document, but kept as an empty
  // placeholder where it's editable — otherwise there's no way to fill it in.
  const contactFields = allContactFields.filter(
    (field) => field.value || canEditPath(field.path)
  )

  return (
    <div className="flex flex-col items-center pb-2">
      <div className="justify-self-center">
        <h1 className="text-24pt font-bold">{data.fullName}</h1>
      </div>

      <Field
        doc={doc}
        path="profession"
        as="h2"
        className="text-14pt font-bold tracking-wide"
      />

      <div className="mx-auto flex gap-1 text-center">
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

function SectionTitle({ title }: { title: string }) {
  return (
    <>
      <h2 className="text-11pt font-semibold uppercase">{title}</h2>
      <div className="pb-2 pt-1">
        <hr className="h-[2px] rounded border-0 bg-black" />
      </div>
    </>
  )
}

function Skills({ doc }: { doc: Doc }) {
  return (
    <div className="pb-4">
      <SectionTitle title="Skills" />

      <div>
        {doc.data.skills.map((skill, index) => (
          <div className="flex gap-1" key={skill.id ?? index}>
            <Field
              doc={doc}
              path={`skills.${index}.category`}
              as="h3"
              className="whitespace-nowrap font-semibold"
            />
            <Field
              doc={doc}
              path={`skills.${index}.all`}
              as="p"
              multiline
              className="flex-1"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function Experience({ doc }: { doc: Doc }) {
  return (
    <div className="pb-4">
      <SectionTitle title="Experience" />

      <div className="space-y-4">
        {doc.data.experience.map((job, index) => (
          <div className="break-inside-avoid" key={job.id ?? index}>
            <div className="flex justify-between">
              <div className="font-semibold">
                <Field doc={doc} path={`experience.${index}.name`} />,{" "}
                <Field
                  doc={doc}
                  path={`experience.${index}.title`}
                  className="font-normal italic"
                />
              </div>

              <DateRange
                doc={doc}
                startPath={`experience.${index}.startDate`}
                endPath={`experience.${index}.endDate`}
              />
            </div>
            <ul className="list-disc pl-10">
              {job.bullets.map((_, bulletIndex) => (
                <Field
                  doc={doc}
                  key={bulletIndex}
                  path={`experience.${index}.bullets.${bulletIndex}`}
                  as="li"
                  multiline
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function Education({ doc }: { doc: Doc }) {
  return (
    <div>
      <SectionTitle title="Education" />

      <div className="space-y-2">
        {doc.data.education.map((school, index) => (
          <div className="break-inside-avoid" key={school.id ?? index}>
            <div className="flex justify-between">
              <div className="font-semibold">
                <Field doc={doc} path={`education.${index}.name`} />,{" "}
                <Field
                  doc={doc}
                  path={`education.${index}.degree`}
                  className="font-normal italic"
                />
              </div>

              <DateRange
                doc={doc}
                startPath={`education.${index}.startDate`}
                endPath={`education.${index}.endDate`}
              />
            </div>
            <Field
              doc={doc}
              path={`education.${index}.description`}
              as="p"
              multiline
            />
          </div>
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
      className="text-blue-600 underline"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {label}
    </a>
  )
}
