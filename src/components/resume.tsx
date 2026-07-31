import { createContext, Fragment, useContext, useState } from "react"
import { type FieldPath, type FieldPathValue } from "react-hook-form"
import { type InsertResumeSchema } from "~/server/db/crud-schema"

/**
 * Everything the resume template renders. Deliberately not a Zod-derived type:
 * the editor, the chat preview and the PDF each assemble it from a different
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

/**
 * Supplies `Editable` with the value behind a path and the commit handler.
 * A `null` `onEdit` renders the whole document read-only, which is what the
 * PDF render wants.
 */
const ResumeEditingContext = createContext<{
  data: ResumeDocumentData
  onEdit: OnEditField | null
  canEditPath: (path: ResumeFieldPath) => boolean
} | null>(null)

function useResumeEditing() {
  const context = useContext(ResumeEditingContext)

  if (!context) {
    throw new Error("Editable must be rendered inside a ResumeDocument")
  }

  return context
}

/**
 * The one resume template. Props in, markup out — no form state, no ids for
 * Puppeteer to inject into. Rendered by the editor, the chat preview and the
 * PDF so all three stay in agreement.
 *
 * Omit `onEdit` for a read-only render. `canEditPath` narrows that further —
 * the resume editor only owns the resume's own snapshot, so it marks the
 * profile-level fields (skills, contact) read-only while the rest stays live.
 */
export function ResumeDocument({
  data,
  onEdit = null,
  canEditPath = () => true
}: {
  data: ResumeDocumentData
  onEdit?: OnEditField | null
  canEditPath?: (path: ResumeFieldPath) => boolean
}) {
  return (
    <ResumeEditingContext.Provider value={{ data, onEdit, canEditPath }}>
      <div className="text-10pt h-[29.7cm] w-[21cm] rounded-md bg-white px-10">
        <div className="flex h-full overflow-hidden">
          <div className="my-auto">
            <Header data={data} />

            <Skills skills={data.skills} />

            <Experience experience={data.experience} />

            <Education education={data.education} />
          </div>
        </div>
      </div>
    </ResumeEditingContext.Provider>
  )
}

/** Walks a dotted path down the document data. Array indices are just keys. */
function readTextAtPath(data: ResumeDocumentData, path: string) {
  const value = path
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current == null
          ? undefined
          : (current as Record<string, unknown>)[key],
      data
    )

  return typeof value === "string" ? value : ""
}

type EditableTag = "span" | "p" | "li" | "h1" | "h2" | "h3" | "div"

/** Grows a textarea to fit its content, so no text is hidden behind a scroll. */
function fitToContent(element: HTMLTextAreaElement | null) {
  if (!element) return

  element.style.height = "auto"
  element.style.height = `${element.scrollHeight}px`
}

/**
 * A single click-to-edit string. Renders as plain text until clicked, then
 * swaps to an input in the same box: commit on blur or Enter, cancel on Escape.
 *
 * The value is read out of the document data by `path` rather than passed in,
 * so the text on screen and the field an edit writes to cannot drift apart.
 */
function Editable({
  path,
  as: Tag = "span",
  multiline = false,
  className = ""
}: {
  path: ResumeFieldPath
  as?: EditableTag
  multiline?: boolean
  className?: string
}) {
  const { data, onEdit, canEditPath } = useResumeEditing()
  const [draft, setDraft] = useState<string | null>(null)

  const value = readTextAtPath(data, path)

  // A multiline field accepts Shift+Enter, so its newlines have to survive the
  // round trip back to display instead of collapsing to a space.
  const textClassName = multiline
    ? `${className} whitespace-pre-line`
    : className

  if (!onEdit || !canEditPath(path)) {
    return <Tag className={textClassName}>{value}</Tag>
  }

  if (draft === null) {
    return (
      <Tag
        className={`${textClassName} cursor-text rounded hover:bg-sky-100`}
        onClick={() => setDraft(value)}
      >
        {value || <span className="text-neutral-400">&mdash;</span>}
      </Tag>
    )
  }

  const commit = () => {
    if (draft !== value) onEdit(path, draft)
    setDraft(null)
  }

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (event.key === "Escape") {
      event.preventDefault()
      setDraft(null)
      return
    }

    // Shift+Enter stays a newline in a textarea; plain Enter always commits.
    if (event.key === "Enter" && !(multiline && event.shiftKey)) {
      event.preventDefault()
      commit()
    }
  }

  const fieldClassName = `${className} rounded bg-sky-50 outline-none ring-1 ring-sky-400`

  if (multiline) {
    return (
      <Tag className={className}>
        <textarea
          autoFocus
          className={`${fieldClassName} w-full resize-none overflow-hidden`}
          rows={1}
          // Sized from content rather than from newline count: a long bullet
          // wraps to several lines without containing any newline at all.
          ref={fitToContent}
          value={draft}
          onChange={(event) => {
            fitToContent(event.target)
            setDraft(event.target.value)
          }}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      </Tag>
    )
  }

  return (
    <Tag className={className}>
      <input
        autoFocus
        className={`${fieldClassName} max-w-full`}
        // Most single-line fields sit inline in a flex row, where `w-full`
        // would resolve against the wrong box and blow the layout apart.
        // `max-w-full` stops a long value pushing past the page edge.
        style={{ width: `${Math.max(draft.length, 3) + 1}ch` }}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
    </Tag>
  )
}

function Header({ data }: { data: ResumeDocumentData }) {
  const { onEdit, canEditPath } = useResumeEditing()

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
    (field) => field.value || (onEdit && canEditPath(field.path))
  )

  return (
    <div className="flex flex-col items-center pb-2">
      <div className="justify-self-center">
        <h1 className="text-24pt font-bold">{data.fullName}</h1>
      </div>

      <Editable
        path="profession"
        as="h2"
        className="text-14pt font-bold tracking-wide"
      />

      <div className="mx-auto flex gap-1 text-center">
        {contactFields.map((field, index) => (
          <Fragment key={field.path}>
            <ContactLine path={field.path} value={field.value} />
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

function Skills({ skills }: { skills: InsertResumeSchema["skills"] }) {
  return (
    <div className="pb-4">
      <SectionTitle title="Skills" />

      <div>
        {skills.map((skill, index) => (
          <div className="flex gap-1" key={skill.id ?? index}>
            <Editable
              path={`skills.${index}.category`}
              as="h3"
              className="whitespace-nowrap font-semibold"
            />
            <Editable
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

function Experience({
  experience
}: {
  experience: InsertResumeSchema["experience"]
}) {
  return (
    <div className="pb-4">
      <SectionTitle title="Experience" />

      <div className="space-y-4">
        {experience.map((job, index) => (
          <div key={job.id ?? index}>
            <div className="flex justify-between">
              <div className="font-semibold">
                <Editable path={`experience.${index}.name`} />,{" "}
                <Editable
                  path={`experience.${index}.title`}
                  className="font-normal italic"
                />
              </div>

              <DateRange
                startPath={`experience.${index}.startDate`}
                endPath={`experience.${index}.endDate`}
              />
            </div>
            <ul className="list-disc pl-10">
              {job.bullets.map((_, bulletIndex) => (
                <Editable
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

function Education({
  education
}: {
  education: InsertResumeSchema["education"]
}) {
  return (
    <div>
      <SectionTitle title="Education" />

      <div className="space-y-2">
        {education.map((school, index) => (
          <div key={school.id ?? index}>
            <div className="flex justify-between">
              <div className="font-semibold">
                <Editable path={`education.${index}.name`} />,{" "}
                <Editable
                  path={`education.${index}.degree`}
                  className="font-normal italic"
                />
              </div>

              <DateRange
                startPath={`education.${index}.startDate`}
                endPath={`education.${index}.endDate`}
              />
            </div>
            <Editable
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
  startPath,
  endPath
}: {
  startPath: ResumeFieldPath
  endPath: ResumeFieldPath
}) {
  return (
    <p className="whitespace-nowrap">
      <Editable path={startPath} /> - <Editable path={endPath} />
    </p>
  )
}

/**
 * Contact details render as links so they stay clickable in the preview and the
 * PDF — but a link that opens on click can't also be a click-to-edit target,
 * so the editor gets the plain-text `Editable` instead.
 */
function ContactLine({
  path,
  value
}: {
  path: ResumeFieldPath
  value: string
}) {
  const { onEdit, canEditPath } = useResumeEditing()

  if (onEdit && canEditPath(path)) {
    return <Editable path={path} />
  }

  if (value.includes("linkedin.com")) {
    return <ContactLink href={value} label="LinkedIn" />
  }
  if (value.includes("github.com")) {
    return <ContactLink href={value} label="GitHub" />
  }
  if (value.includes("www.")) {
    return <ContactLink href={value} label="Portfolio" />
  }
  if (value.includes("@")) {
    return <ContactLink href={`mailto:${value}`} label={value} />
  }

  return <span>{value}</span>
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
