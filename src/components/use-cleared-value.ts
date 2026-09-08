"use client"

import { useRef } from "react"

/** The field a tick empties: what it holds now, and how to write it. */
type ClearedField = {
  value: string
  write: (value: string) => void
}

/**
 * What ticking a box cleared, held so unticking can put it back.
 *
 * Two boxes need exactly this and they are the same box twice — the onboarding
 * step's "I currently work here" and the resume panel's, both of which empty an
 * end date when they are set, because a row carrying a set `current` beside a
 * date is a row two readers disagree about and the write schema refuses it
 * outright (#71).
 *
 * The cleared value is held here rather than re-read from the row, because by
 * then the row's copy is the empty string the tick wrote — and a box ticked by
 * accident must not cost the user a date they then have to retype.
 */
export function useClearedValue() {
  const cleared = useRef("")

  return (checked: boolean, field: ClearedField) => {
    if (checked) {
      cleared.current = field.value
      field.write("")

      return
    }

    if (!cleared.current) return

    field.write(cleared.current)
    cleared.current = ""
  }
}
