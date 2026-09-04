"use client"

import { useTranslations } from "next-intl"
import { useLayoutEffect, useRef, useState } from "react"
import { Button } from "~/components/ui/button"
import { FontBoldIcon, Link2Icon, ListBulletIcon } from "@radix-ui/react-icons"
import { Textarea } from "~/components/ui/textarea"
import { applyMarkdownAction, type MarkdownAction } from "~/lib/resume-markdown"

/**
 * An icon carries no accessible name, so `titleKey` is both the tooltip and the
 * button's label — it is the only copy in this file, and it is translated.
 */
const toolbar: {
  action: MarkdownAction
  /** Every Radix icon has this type; `FontBoldIcon` is just the one naming it. */
  Icon: typeof FontBoldIcon
  titleKey: "boldTitle" | "linkTitle" | "bulletListTitle"
}[] = [
  { action: "bold", Icon: FontBoldIcon, titleKey: "boldTitle" },
  { action: "link", Icon: Link2Icon, titleKey: "linkTitle" },
  { action: "bulletList", Icon: ListBulletIcon, titleKey: "bulletListTitle" }
]

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
export function MarkdownField({
  value,
  onChange,
  onCommit,
  id,
  placeholder
}: {
  value: string
  onChange: (value: string) => void
  onCommit: () => void
  id: string
  /** Only where an empty field needs to say what belongs in it — onboarding. */
  placeholder?: string
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
        {toolbar.map(({ action, Icon, titleKey }) => (
          <Button
            aria-label={t(titleKey)}
            key={action}
            // The textarea keeps its selection: pressing a toolbar button must
            // not first blur the field it is about to format.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => apply(action)}
            size="icon"
            title={t(titleKey)}
            type="button"
            variant="ghost"
          >
            <Icon aria-hidden className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <Textarea
        id={id}
        onBlur={onCommit}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        ref={textarea}
        rows={6}
        value={value}
      />
    </div>
  )
}
