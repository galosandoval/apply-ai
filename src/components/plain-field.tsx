import { type FieldProps } from "~/components/resume-document"

/** The read-only default: plain tags, no click target. */
export function PlainField({
  value,
  as: Tag = "span",
  multiline = false,
  className = ""
}: FieldProps) {
  // A multiline field accepts Shift+Enter, so its newlines have to survive the
  // round trip back to display instead of collapsing to a space.
  return (
    <Tag className={multiline ? `${className} whitespace-pre-line` : className}>
      {value}
    </Tag>
  )
}
