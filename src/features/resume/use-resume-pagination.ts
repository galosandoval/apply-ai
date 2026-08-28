"use client"

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react"
import {
  readResumeBlock,
  resumeBlockSelector,
  resumeDocumentSelector,
  resumePageContentHeightToken,
  resumePageSelector
} from "~/components/resume-document"
import { type RenderMode } from "~/components/resume-section"
import {
  isSamePagination,
  type PaginatedPage,
  type PaginationBlock,
  paginate
} from "~/lib/paginate"

/**
 * The measure-paginate-draw loop, as the editor runs it.
 *
 * The document renders unpaginated on the first pass, every block's height is
 * read off the DOM, `paginate` is handed those heights, and the assignment it
 * returns is drawn as a stack of sheets. Because each page's content column is
 * the same width as the unpaginated flow, no height changes between the two
 * passes and the loop settles after one round trip.
 *
 * Nothing here decides anything. Where a break lands is `paginate`'s to say and
 * it is a pure function with no browser in it, which is why the policy can be
 * proved from a test rather than from a screenshot; this is only the part that
 * has to touch a rendered page, and it is deliberately thin for that reason.
 *
 * The caller hangs `documentRef` on an element wrapping the document and hands
 * `pages` straight back to it.
 */
export function useResumePagination(mode: RenderMode) {
  const documentRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<PaginatedPage[]>()

  /** Measure again after something that changed a height without a render. */
  const [, remeasure] = useReducer((count: number) => count + 1, 0)

  /*
    No dependency list, on purpose.

    A change to the document's data, to its style and to the render mode all
    arrive here as a render and nothing else does, so "after a render" is the
    trigger; a list would be a second copy of that fact to keep in agreement
    with the first. What makes the list unnecessary — and what stops this
    measuring what it just drew, forever — is the guard below: see
    `isSamePagination`.

    Layout rather than passive, so the sheets are drawn in the same frame the
    flow was measured in: an effect would paint the unpaginated document first
    and the stack a frame later, which the user sees as a jump.
  */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const root = documentRef.current?.querySelector<HTMLElement>(
      resumeDocumentSelector
    )

    // A phone is not a page. Reflow renders one continuous flow, so there is
    // nothing to assign and the machinery stays out of it.
    if (mode !== "page" || !root) {
      setPages(undefined)
      return
    }

    const measured = paginate(measureBlocks(root), {
      contentHeight: pageContentHeight(root)
    })

    setPages((current) =>
      current && isSamePagination(current, measured.pages)
        ? current
        : measured.pages
    )
  })

  /*
    A render is not the only thing that moves a line onto another page. A web
    font arriving and the pane being resized both re-lay the document out with
    nothing to re-render, and a stack drawn against heights that no longer hold
    is a break in the wrong place the reader can see. Both ask for another
    measurement; the guard above throws the answer away when it agrees, which
    is almost every time.
  */
  useEffect(() => {
    const root = documentRef.current

    if (!root) return

    const observer = new ResizeObserver(remeasure)

    observer.observe(root)
    void document.fonts?.ready.then(remeasure)

    return () => observer.disconnect()
  }, [])

  return { documentRef, pages }
}

/**
 * Every block of the rendered document, in document order, with its height.
 *
 * Read off the attributes the renderer writes rather than off the data that
 * produced them: the height and the identity have to come from the same
 * element, or a measurement is filed against a block it was not taken from.
 * What each element says about itself is `readResumeBlock`'s to say, and an
 * element it cannot answer for is left out.
 *
 * Sorted by the order the renderer stamped rather than taken in the order the
 * elements are found, because those are two different orders once there are
 * sheets — see `inDocumentOrder`.
 *
 * A block marked editor-only is measured as nothing rather than left out — see
 * `ResumeBlockDraft.editorOnly` for why it is not simply skipped.
 */
function measureBlocks(root: HTMLElement): PaginationBlock[] {
  const elements = root.querySelectorAll<HTMLElement>(resumeBlockSelector)

  return [...elements]
    .flatMap((element) => {
      const block = readResumeBlock(element)

      if (!block) return []

      return {
        ...block,
        height: block.isEditorOnly ? 0 : heightWithTrailingSpace(element, root)
      }
    })
    .sort((left, right) => left.order - right.order)
}

/**
 * A block's height including the space it owns after itself.
 *
 * A block holds that space as padding, which its own box already counts — but
 * the last block of a selection run hands its space to the run, as a margin,
 * so that the editor's outline ends where the content does. That margin falls
 * below the block all the same, and a page budgeted without it is a page one
 * gap too full for every run that ends on it.
 *
 * So: the block's box, plus the bottom margin of every ancestor it is the last
 * child of, up to the sheet it is drawn on — or up to the document, before
 * there are sheets. Stopping at the sheet is what keeps the loop still: the gap
 * between two pieces of paper is a margin on the sheet, and charged to the last
 * block on it, the second measurement would disagree with the first and the two
 * would trade assignments forever. Nothing here has a top margin, so there is
 * no collapsing to reason about.
 */
function heightWithTrailingSpace(
  element: HTMLElement,
  root: HTMLElement
): number {
  const sheet = element.closest<HTMLElement>(resumePageSelector) ?? root

  let height = element.getBoundingClientRect().height
  let node: HTMLElement | null = element

  while (node && node !== sheet) {
    height += marginBottom(node)
    node = node.nextElementSibling ? null : node.parentElement
  }

  return height
}

function marginBottom(element: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(element).marginBottom) || 0
}

/**
 * What one sheet has room for, in pixels.
 *
 * Resolved by putting a box of that height into the document and asking how
 * tall it came out, because the token is a `calc` over the page and its padding
 * and a custom property is handed back unresolved. Doing the arithmetic here
 * instead would be a second copy of the page's geometry, and a copy that drifts
 * from the padding the sheet is actually drawn with does not fail a test — it
 * cuts a line of text in half.
 *
 * Inside `root` rather than anywhere else because that is the element the token
 * is declared on, and a style re-values it: a `var()` resolves where it is
 * written. Absolutely positioned and removed before this returns, so it is
 * never laid out beside the document and React never sees it.
 */
function pageContentHeight(root: HTMLElement): number {
  const probe = document.createElement("div")

  probe.style.position = "absolute"
  probe.style.visibility = "hidden"
  probe.style.width = "0"
  probe.style.height = `var(${resumePageContentHeightToken})`

  root.append(probe)

  const height = probe.getBoundingClientRect().height

  probe.remove()

  return height
}
