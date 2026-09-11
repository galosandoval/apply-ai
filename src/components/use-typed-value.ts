"use client"

import { useState } from "react"

/**
 * A text input whose caret survives a value that comes back a tick later.
 *
 * The resume editor's inputs are controlled by the cached resume: a keystroke
 * patches the cache, and the input is re-rendered with what the cache now
 * holds. React Query notifies its subscribers on a later task, though, so that
 * re-render does not happen inside the change event — and React, finding the
 * `value` prop unchanged by the end of the event, restores the DOM node to it
 * and drops the caret at the end of the text. Typing into the middle of a
 * filled field would land the first character and then append every one after
 * it.
 *
 * So the keystroke is echoed here, synchronously, and the prop only overrides
 * it when it changes for some *other* reason — a refused write rolling back, a
 * ticked box clearing a date, a different row taking this field's place.
 */
export function useTypedValue(
  value: string,
  onChange: (value: string) => void
) {
  const [typed, setTyped] = useState(value)
  const [rendered, setRendered] = useState(value)

  // Derived during render rather than in an effect: an effect would repaint the
  // stale text first, which is the flicker this exists to remove.
  if (value !== rendered) {
    setRendered(value)
    setTyped(value)
  }

  return {
    value: typed,
    onChange: (next: string) => {
      setTyped(next)
      onChange(next)
    }
  }
}
