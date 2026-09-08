"use client"

import { cn } from "~/lib/utils"

/**
 * A box and the claim beside it.
 *
 * A native input rather than a Radix primitive: this is a checkbox, the label
 * is the whole hit area, and the one thing it has to get right on a phone is
 * being big enough to hit — which `min-h-11` is, at the 44px floor the layout
 * rules ask for. The label wraps the input so tapping the words toggles it.
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
        "flex min-h-11 cursor-pointer items-center gap-2 text-sm",
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
