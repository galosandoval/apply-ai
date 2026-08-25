"use client"

import { useSyncExternalStore } from "react"
import { type RenderMode } from "~/components/resume-section"

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
 * Page mode when the page fits, reflow when it doesn't.
 *
 * `useSyncExternalStore` rather than an effect so the first client render
 * already agrees with the viewport instead of flashing the wrong layout. The
 * server snapshot is reflow: it is the mobile-first answer, and it is the one
 * that is readable when it turns out to be wrong for a moment.
 *
 * There is no "show me the page anyway" override any more. Reflow is for
 * proofreading and the real PDF is for judging layout — a scaled-down A4 page
 * on a phone answers neither question, and offering it invited the user to
 * judge the print from a render that is not the print.
 */
export function useResumeRenderMode() {
  const fits = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(pageFits).matches,
    () => false
  )

  const mode: RenderMode = fits ? "page" : "reflow"

  return { mode }
}
