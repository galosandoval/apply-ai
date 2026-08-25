import { Fragment, type ReactNode } from "react"

/**
 * The constrained markdown subset a rich-text field may contain — bold, links
 * and bullet lists, and nothing else.
 *
 * Markdown rather than HTML: the stored value is exactly what the user typed,
 * so there is no sanitizer to get wrong, and the value strips to clean text for
 * a parser for free. Everything outside the subset is literal text, escaped by
 * React because it is rendered as text and never as HTML.
 *
 * Three pure functions, in one place because they have to agree: what the
 * subset draws as, what it strips to, and what the toolbar buttons do to it. A
 * fourth thing they are not is a rich-text framework — a second document model
 * whose formatting set would have to be reconciled with this one is exactly the
 * ongoing work this avoids.
 *
 * A bullet list *inside* rich text exists because markdown has one, but the app
 * never offers it as a rich-text action from the panel: a list of things gets
 * one home, the list component. See `section-content` for that tie-break.
 */

/** A line that opens a bullet list item. */
const bulletLine = /^\s*[-*]\s+(.*)$/

/**
 * `**bold**` or `[label](href)`. Non-greedy so two bold runs on one line stay
 * two runs rather than one that swallows the text between them.
 */
const inlineMarkup = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g

/** Schemes a link may carry. Anything else renders as plain text. */
const safeScheme = /^(https?:\/\/|mailto:)/i

/** The prefix a bulleted line is written with, and the one it is read as. */
const bulletPrefix = "- "

/**
 * Renders the subset to React nodes.
 *
 * Blocks are paragraphs and bullet lists, separated by blank lines or by the
 * first bullet. The caller owns the surrounding element, so this returns the
 * blocks rather than a wrapper.
 */
export function renderResumeMarkdown(markdown: string): ReactNode[] {
  const blocks: ReactNode[] = []

  let paragraph: string[] = []
  let items: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return

    blocks.push(
      <p key={`p${blocks.length}`}>{renderInline(paragraph.join(" "))}</p>
    )

    paragraph = []
  }

  const flushList = () => {
    if (!items.length) return

    blocks.push(
      <ul className="list-disc pl-resume-bullet" key={`l${blocks.length}`}>
        {items.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>
    )

    items = []
  }

  for (const line of markdown.split("\n")) {
    const bullet = bulletLine.exec(line)

    if (bullet) {
      flushParagraph()
      items.push(bullet[1] ?? "")
      continue
    }

    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }

    flushList()
    paragraph.push(line.trim())
  }

  flushParagraph()
  flushList()

  return blocks
}

/** Bold runs and links inside one line; everything between them is text. */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []

  let cursor = 0

  // `exec` in a loop rather than `matchAll`, so the text between two matches is
  // as easy to emit as the matches themselves.
  inlineMarkup.lastIndex = 0

  for (
    let match = inlineMarkup.exec(text);
    match;
    match = inlineMarkup.exec(text)
  ) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index))

    const [, bold, label, href] = match

    if (bold !== undefined) {
      nodes.push(<strong key={nodes.length}>{bold}</strong>)
    } else if (label !== undefined && href !== undefined) {
      nodes.push(renderLink(label, href, nodes.length))
    }

    cursor = match.index + match[0].length
  }

  if (cursor < text.length) nodes.push(text.slice(cursor))

  return nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>)
}

/**
 * A link, or its label as plain text when the target is not a link.
 *
 * `javascript:` and friends are refused rather than dropped: a refused link
 * should cost the user the link, not the sentence it was in.
 */
function renderLink(label: string, href: string, key: number) {
  if (!safeScheme.test(href)) return label

  return (
    <a
      className="underline"
      href={href}
      key={key}
      rel="noreferrer"
      target="_blank"
    >
      {label}
    </a>
  )
}

/**
 * The same text with its markup removed — what a parser, and the scoring work,
 * reads.
 *
 * A link keeps its label and loses its target, which is the half a human reads;
 * a bullet keeps its sentence and loses its marker. Line structure survives, so
 * a stripped block still reads as the paragraphs it was written as.
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      const bullet = bulletLine.exec(line)

      return stripInline(bullet ? (bullet[1] ?? "") : line)
    })
    .join("\n")
}

function stripInline(text: string) {
  return text.replace(inlineMarkup, (_match, bold, label) =>
    bold !== undefined ? String(bold) : String(label ?? "")
  )
}

/**
 * A textarea's value and the selection inside it.
 *
 * The caret travels with the text because a toolbar button that leaves the
 * caret where it was is a button that has to be followed by a click to keep
 * typing — and on a phone, where these buttons are not optional, that is the
 * whole interaction.
 */
export type MarkdownDraft = {
  text: string
  start: number
  end: number
}

/** The formatting the toolbar offers. The set is the subset, deliberately. */
export type MarkdownAction = "bold" | "link" | "bulletList"

/** The placeholder a new link carries, for the user to type over. */
const linkTarget = "https://"

/** The label a link gets when there was no selection to make one of. */
const linkLabel = "link"

/**
 * Applies one toolbar action to a draft, returning the new text and where the
 * selection now sits.
 *
 * Every action is its own inverse where that is meaningful, so a button pressed
 * twice leaves the text as it was rather than accumulating markup.
 */
export function applyMarkdownAction(
  action: MarkdownAction,
  draft: MarkdownDraft
): MarkdownDraft {
  return actions[action](draft)
}

const actions: Record<MarkdownAction, (draft: MarkdownDraft) => MarkdownDraft> =
  {
    bold: toggleBold,
    link: insertLink,
    bulletList: toggleBulletList
  }

/**
 * Wraps the selection in `**`, or unwraps it when it is already wrapped —
 * whether the markers are just outside the selection or inside it.
 */
function toggleBold({ text, start, end }: MarkdownDraft): MarkdownDraft {
  const marker = "**"

  const wrapsSelection =
    text.slice(start - marker.length, start) === marker &&
    text.slice(end, end + marker.length) === marker

  if (wrapsSelection) {
    return {
      text:
        text.slice(0, start - marker.length) +
        text.slice(start, end) +
        text.slice(end + marker.length),
      start: start - marker.length,
      end: end - marker.length
    }
  }

  const selected = text.slice(start, end)

  if (
    selected.startsWith(marker) &&
    selected.endsWith(marker) &&
    end - start > marker.length * 2
  ) {
    const inner = selected.slice(marker.length, -marker.length)

    return {
      text: text.slice(0, start) + inner + text.slice(end),
      start,
      end: start + inner.length
    }
  }

  return {
    text: text.slice(0, start) + marker + selected + marker + text.slice(end),
    start: start + marker.length,
    end: end + marker.length
  }
}

/**
 * Makes the selection a link's label and selects the placeholder target, so the
 * next thing typed is the address. With nothing selected there is no label
 * either, so a replaceable one is written and selected instead.
 */
function insertLink({ text, start, end }: MarkdownDraft): MarkdownDraft {
  const hasLabel = end > start
  const label = hasLabel ? text.slice(start, end) : linkLabel
  const link = `[${label}](${linkTarget})`

  // With a label of their own, the user's next keystroke belongs in the target;
  // without one, it belongs in the label.
  const selected = hasLabel ? linkTarget : label
  const offset = hasLabel ? label.length + 3 : 1

  return {
    text: text.slice(0, start) + link + text.slice(end),
    start: start + offset,
    end: start + offset + selected.length
  }
}

/**
 * Prefixes every line the selection touches with a bullet marker, or removes
 * the marker when every one of them already has it.
 *
 * Blank lines are left alone: a bullet with nothing after it is not a list
 * item, and blank lines are what separate one block from the next.
 */
function toggleBulletList({ text, start, end }: MarkdownDraft): MarkdownDraft {
  const from = text.lastIndexOf("\n", Math.max(start - 1, 0)) + 1
  const lineEnd = text.indexOf("\n", end)
  const to = lineEnd === -1 ? text.length : lineEnd

  const lines = text.slice(from, to).split("\n")
  const filled = lines.filter((line) => line.trim())

  const isList =
    filled.length > 0 && filled.every((line) => bulletLine.test(line))

  const next = lines
    .map((line) => {
      if (!line.trim()) return line

      if (!isList) return bulletPrefix + line

      return line.replace(bulletLine, "$1")
    })
    .join("\n")

  const block = text.slice(from, to)

  // The selection is re-measured from the ends rather than shifted by a fixed
  // amount: how much each line moved depends on how many lines there were.
  const startShift = shiftWithin(block, next, start - from)
  const endShift = shiftWithin(block, next, end - from)

  return {
    text: text.slice(0, from) + next + text.slice(to),
    start: from + startShift,
    end: from + endShift
  }
}

/**
 * Where an offset inside a block lands after every line of it gained or lost a
 * prefix — the offset plus the change to the lines before it, and to its own.
 */
function shiftWithin(before: string, after: string, offset: number) {
  const beforeLines = before.split("\n")
  const afterLines = after.split("\n")

  let consumed = 0
  let moved = 0

  for (const [index, line] of beforeLines.entries()) {
    const change = (afterLines[index] ?? line).length - line.length

    if (offset <= consumed + line.length) {
      // An offset sitting at the start of a line stays there, so a selection
      // that covered whole lines still covers them, markers included.
      if (offset === consumed) return moved + consumed

      // Otherwise it moves with its line — but a removed prefix must not pull
      // it back past the line's new start and into the line above.
      return Math.max(moved + consumed, moved + offset + change)
    }

    consumed += line.length + 1
    moved += change
  }

  return Math.min(moved + offset, after.length)
}
