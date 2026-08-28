"use client"

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react"
import { resumeMeasurementContract } from "~/components/resume-document"
import { type RenderMode } from "~/components/resume-section"
import { measureResumeDocument } from "~/lib/measure-resume-document"
import { isSamePagination, type PaginatedPage, paginate } from "~/lib/paginate"

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
 * proved from a test rather than from a screenshot; the measuring is
 * `measureResumeDocument`'s, which the PDF route runs against its own browser
 * so that the print and the preview cannot be paginated differently. This is
 * only what ties the two to a React render.
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
    // A phone is not a page. Reflow renders one continuous flow, so there is
    // nothing to assign and the machinery stays out of it.
    const measurement =
      mode === "page"
        ? measureResumeDocument(resumeMeasurementContract, documentRef.current)
        : null

    if (!measurement) {
      setPages(undefined)
      return
    }

    const measured = paginate(measurement.blocks, {
      contentHeight: measurement.contentHeight
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
