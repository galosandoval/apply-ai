import { Fragment, type ReactNode } from "react"

/**
 * The constrained markdown subset a rich-text section may contain.
 *
 * Markdown rather than HTML: there is no sanitizer to get wrong, and the value
 * strips to clean text for a parser for free. Only three things are markup —
 * bold, links and bullet lists — and everything else is literal text, escaped
 * by React because it is rendered as text and never as HTML.
 *
 * A bullet list *inside* rich text exists because markdown has one, but the app
 * never offers it as a rich-text action: a list of things gets one home, the
 * list component. See the section-content module for that tie-break.
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

/** True when a markdown string would draw nothing. */
export function isBlankMarkdown(markdown: string) {
  return !markdown.trim()
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

  return nodes.map((node, index) => (
    <Fragment key={index}>{node}</Fragment>
  ))
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
