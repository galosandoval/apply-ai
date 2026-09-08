"use client"

import { cn } from "~/lib/utils"

/**
 * A box and the claim beside it.
 *
 * A native input rather than a Radix primitive: this is a checkbox, and the
 * browser's own already carries the keyboard behaviour, the focus ring and the
 * indeterminate state a re-implementation would have to earn back.
 *
 * `min-h-9` matches `Input`, so the box lines up with the field it sits beside
 * and stays as dense as the rest of the desktop layout `.claude/form-factor.md`
 * asks for. The label wraps the input, so the words are part of the hit area
 * without a `for` round-trip.
 */
export function Checkbox({
  checked,
  className,
  id,
  label,
  onCheckedChange
}: {
  checked: boolean
  className?: string
  id: string
  label: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label
      className={cn(
        "flex min-h-9 cursor-pointer items-center gap-2 text-sm hover:text-foreground",
        className
      )}
      htmlFor={id}
    >
      <input
        checked={checked}
        className="size-4 accent-primary"
        id={id}
        onChange={(event) => onCheckedChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  )
}
