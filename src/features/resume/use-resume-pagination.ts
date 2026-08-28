"use client"

import { useLayoutEffect, useRef, useState } from "react"
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

  /*
    No dependency list, on purpose.

    A change to the document's data, to its style and to the render mode all
    arrive here as a render and nothing else does, so "after a render" is the
    trigger; a list would be a second copy of that fact to keep in agreement
    with the first. What makes the list unnecessary is the guard below — an
    assignment that agrees with the one held is not stored, so it is not a
    render, so it is not another measurement.

    Layout rather than passive, so the sheets are drawn in the same frame the
    flow was measured in: an effect would paint the unpaginated document first
    and the stack a frame later, which the user sees as a jump.
  */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const root =
      documentRef.current?.querySelector<HTMLElement>(".resume-document")

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

  return { documentRef, pages }
}

/**
 * Every block of the rendered document, in document order, with its height.
 *
 * Read off the attributes the renderer writes rather than off the data that
 * produced them: the height and the identity have to come from the same
 * element, or a measurement is filed against a block it was not taken from. An
 * element missing either is not a block this can answer for, and is left out
 * rather than filed under an empty name — an unmeasured block lands on the
 * visible unassigned sheet, and a block filed under `""` collides silently with
 * every other one.
 *
 * The heading a continued page repeats is skipped: it carries no block key at
 * all, because it is a repeat of a block rather than a block, and `paginate`
 * already budgets for it.
 *
 * A block marked editor-only is measured as nothing rather than left out. It is
 * furniture the print does not have — see `ResumeBlockDraft.editorOnly` — so it
 * must not move a break or add a sheet. But it is still a block on the screen,
 * and a block no assignment names is a block the renderer draws on a leftover
 * sheet of its own, at the end of the document, away from the section it
 * belongs to. Zero height keeps it in its place and off the arithmetic.
 */
function measureBlocks(root: HTMLElement): PaginationBlock[] {
  const elements = root.querySelectorAll<HTMLElement>("[data-resume-block]")

  return [...elements].flatMap((element) => {
    const { resumeBlock: key, resumeSection: sectionId } = element.dataset

    if (!key || !sectionId) return []

    return {
      key,
      sectionId,
      kind:
        element.dataset.resumeBlockKind === "heading" ? "heading" : "content",
      height: element.dataset.resumeEditorOnly ? 0 : outerHeight(element, root)
    }
  })
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
function outerHeight(element: HTMLElement, root: HTMLElement): number {
  const sheet = element.closest<HTMLElement>("[data-resume-page]") ?? root

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
 * tall it came out, because `--resume-page-content-height` is a `calc` over the
 * page and its padding and a custom property is handed back unresolved. Doing
 * the arithmetic here instead would be a second copy of the page's geometry,
 * and a copy that drifts from the padding the sheet is actually drawn with does
 * not fail a test — it cuts a line of text in half.
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
  probe.style.height = "var(--resume-page-content-height)"

  root.append(probe)

  const height = probe.getBoundingClientRect().height

  probe.remove()

  return height
}
