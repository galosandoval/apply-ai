"use client"

import { useState } from "react"
import {
  ResumeDocument as BaseResumeDocument,
  PlainField,
  type FieldProps,
  type OnEditField,
  type ResumeDocumentData,
  type ResumeFieldPath
} from "~/components/resume-document"

/**
 * The resume template, wired for editing.
 *
 * The template itself lives in `resume-document.tsx` and holds no state, so the
 * PDF route can render it. Everything stateful — the draft, the input swap —
 * lives here, in the field renderer that gets handed to it.
 *
 * Omit `onEdit` for a read-only render. `canEditPath` narrows that further: the
 * resume editor only owns the resume's own snapshot, so it marks the
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
  const isEditable = (path: ResumeFieldPath) => !!onEdit && canEditPath(path)

  return (
    <BaseResumeDocument
      data={data}
      canEditPath={isEditable}
      renderField={(props) =>
        onEdit && isEditable(props.path) ? (
          <Editable key={props.path} {...props} onEdit={onEdit} />
        ) : (
          <PlainField {...props} />
        )
      }
    />
  )
}

/** Grows a textarea to fit its content, so no text is hidden behind a scroll. */
function fitToContent(element: HTMLTextAreaElement | null) {
  if (!element) return

  element.style.height = "auto"
  element.style.height = `${element.scrollHeight}px`
}

/**
 * A single click-to-edit string. Renders as plain text until clicked, then
 * swaps to an input in the same box: commit on blur or Enter, cancel on Escape.
 */
function Editable({
  path,
  value,
  onEdit,
  as: Tag = "span",
  multiline = false,
  className = ""
}: FieldProps & { onEdit: OnEditField }) {
  const [draft, setDraft] = useState<string | null>(null)

  // A multiline field accepts Shift+Enter, so its newlines have to survive the
  // round trip back to display instead of collapsing to a space.
  const textClassName = multiline
    ? `${className} whitespace-pre-line`
    : className

  if (draft === null) {
    return (
      <Tag
        className={`${textClassName} cursor-text rounded hover:bg-sky-100`}
        onClick={() => setDraft(value)}
      >
        {/*
          An empty value would otherwise collapse to a zero-height element with
          nothing to click, so an editable blank gets a placeholder.
        */}
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
          className={`${fieldClassName} w-full resize-none`}
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
