"use client"

import { useTranslations } from "next-intl"
import { useLayoutEffect, useRef, useState } from "react"
import { Button } from "~/components/ui/button"
import { Textarea } from "~/components/ui/textarea"
import { applyMarkdownAction, type MarkdownAction } from "~/lib/resume-markdown"

/**
 * A rich-text field: a plain textarea, and three buttons that wrap or prefix
 * the selection.
 *
 * The stored value is exactly what is typed, which is why there is no editing
 * framework here — a second document model would have to be reconciled with the
 * markdown subset forever, for a feature nobody would notice. The honest cost
 * is that typing markdown reads as dated to some users, which is exactly why
 * the buttons are not optional: a phone keyboard is a bad place for asterisks.
 */
/**
 * `label` is the glyph on the button and stays as written — "B" reads as bold
 * in every locale this ships in. `titleKey` is the tooltip, which is copy.
 */
const toolbar: {
  action: MarkdownAction
  label: string
  titleKey: "boldTitle" | "linkTitle" | "bulletListTitle"
}[] = [
  { action: "bold", label: "B", titleKey: "boldTitle" },
  { action: "link", label: "Link", titleKey: "linkTitle" },
  { action: "bulletList", label: "List", titleKey: "bulletListTitle" }
]

export function MarkdownField({
  value,
  onChange,
  onCommit,
  id
}: {
  value: string
  onChange: (value: string) => void
  onCommit: () => void
  id: string
}) {
  const t = useTranslations("resumeEditor.markdown")
  const textarea = useRef<HTMLTextAreaElement>(null)

  // Where the caret goes once the new text has rendered. A button that leaves
  // the caret where it was is a button that has to be followed by a click.
  const [caret, setCaret] = useState<{ start: number; end: number } | null>(
    null
  )

  useLayoutEffect(() => {
    if (!caret || !textarea.current) return

    textarea.current.focus()
    textarea.current.setSelectionRange(caret.start, caret.end)
    setCaret(null)
  }, [caret])

  const apply = (action: MarkdownAction) => {
    const element = textarea.current

    if (!element) return

    const next = applyMarkdownAction(action, {
      text: element.value,
      start: element.selectionStart,
      end: element.selectionEnd
    })

    onChange(next.text)
    setCaret({ start: next.start, end: next.end })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {toolbar.map((button) => (
          <Button
            key={button.action}
            // The textarea keeps its selection: pressing a toolbar button must
            // not first blur the field it is about to format.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => apply(button.action)}
            size="sm"
            title={t(button.titleKey)}
            type="button"
            variant="outline"
          >
            {button.label}
          </Button>
        ))}
      </div>

      <Textarea
        id={id}
        onBlur={onCommit}
        onChange={(event) => onChange(event.target.value)}
        ref={textarea}
        rows={6}
        value={value}
      />
    </div>
  )
}
