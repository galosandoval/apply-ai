"use client"

import { useState, type ChangeEvent } from "react"

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
 *
 * `props` is spread straight onto the input; `set` is for the callers that
 * rewrite the text themselves rather than being told by an event.
 */
export function useTypedValue(
  value: string,
  onChange: (value: string) => void
) {
  const [current, setCurrent] = useState(value)
  const [lastValue, setLastValue] = useState(value)

  // Derived during render rather than in an effect: an effect would repaint the
  // stale text first, which is the flicker this exists to remove.
  if (value !== lastValue) {
    setLastValue(value)
    setCurrent(value)
  }

  const set = (next: string) => {
    setCurrent(next)
    onChange(next)
  }

  return {
    props: {
      value: current,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        set(event.target.value)
    },
    set
  }
}
