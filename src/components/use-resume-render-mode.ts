"use client"

import { useSyncExternalStore } from "react"

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
 */
export function useResumeRenderMode() {
  const fits = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(pageFits).matches,
    () => false
  )

  return fits ? "page" : "reflow"
}
