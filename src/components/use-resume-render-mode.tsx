"use client"

import { useState, useSyncExternalStore } from "react"
import { type RenderMode } from "~/components/resume-section"
import { Button } from "~/components/ui/button"

/**
 * The A4 page needs about 794px plus the room around it. Below that the page
 * can only be shown by scaling it down, which is how body text ends up at
 * roughly 5pt on a phone — so below that, reflow.
 */
const pageFits = "(min-width: 900px)"

function subscribe(onChange: () => void) {
  const query = window.matchMedia(pageFits)

  query.addEventListener("change", onChange)

  return () => query.removeEventListener("change", onChange)
}

/**
 * Page mode when the page fits, reflow when it doesn't — and the page anyway
 * when the user asks for it.
 *
 * `useSyncExternalStore` rather than an effect so the first client render
 * already agrees with the viewport instead of flashing the wrong layout. The
 * server snapshot is reflow: it is the mobile-first answer, and it is the one
 * that is readable when it turns out to be wrong for a moment.
 *
 * The override is one-way. Reflow is only ever a substitute for a page that
 * doesn't fit, so there is nothing to ask for in the other direction.
 */
export function useResumeRenderMode() {
  const fits = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(pageFits).matches,
    () => false
  )

  const [showsPage, setShowsPage] = useState(false)

  const mode: RenderMode = fits || showsPage ? "page" : "reflow"

  return { mode, isPageOffered: !fits, showsPage, setShowsPage }
}

/**
 * Switches a phone between the readable layout and the real page.
 *
 * Reflow is a different layout, not a smaller one, so there has to be a way
 * back to the document as it will actually print — checking whether it fits and
 * where it breaks is a thing you do before downloading, on whatever device you
 * have.
 */
export function ResumePageToggle({
  showsPage,
  setShowsPage
}: {
  showsPage: boolean
  setShowsPage: (showsPage: boolean) => void
}) {
  return (
    <Button
      onClick={() => setShowsPage(!showsPage)}
      type="button"
      variant="secondary"
    >
      {showsPage ? "Fit to screen" : "View page layout"}
    </Button>
  )
}
