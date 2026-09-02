/**
 * The list with one element moved.
 *
 * One home because every reorder in the app is this: sections against each
 * other, jobs within Experience, items within a custom section's content.
 * Reordering takes the whole new order everywhere, so this is what produces it.
 *
 * An out-of-range move returns the list as it was: "move the first one up" is a
 * button the panel offers rather than hides, and a no-op is the honest answer.
 */
export function moveItem<Element>(
  items: Element[],
  from: number,
  to: number
): Element[] {
  if (from === to || from < 0 || to < 0) return items
  if (from >= items.length || to >= items.length) return items

  const next = [...items]
  const [element] = next.splice(from, 1)

  next.splice(to, 0, element!)

  return next
}
