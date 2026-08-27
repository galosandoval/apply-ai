/**
 * Where the page breaks go, decided once, in a function with no browser in it.
 *
 * The renderer measures the document and hands the measurements here; this
 * decides the grouping and hands back key arrays. It knows nothing about the
 * DOM, React, or how a resume is styled — which is what makes a break provable
 * from a test rather than from a screenshot.
 *
 * Keys rather than blocks on the way out: the contract is about grouping and
 * nothing else, and the renderer re-measures on every edit, so the result has
 * to stay cheap to compare against the last one.
 */

/**
 * What a heading is to this function: the one block kind that may not be left
 * dangling at the foot of a page. Everything else is content, whether it is an
 * entry, a bullet, or a paragraph — the distinction that matters to a break is
 * only "announces what follows" versus "is what follows".
 */
export type PaginationBlockKind = "heading" | "content"

/** One measured, indivisible run of the document, in document order. */
export type PaginationBlock = {
  key: string
  sectionId: string
  kind: PaginationBlockKind
  /** As measured, in whatever unit `contentHeight` is given in. */
  height: number
}

/** One sheet's worth of blocks. */
export type PaginatedPage = {
  blocks: string[]
  /**
   * The section this page picks up mid-way through, or `null` when its first
   * block also starts its section. What a continued heading looks like — a
   * repeat, a "(continued)", nothing at all — is the renderer's decision.
   */
  continuedFrom: string | null
}

export type PaginationResult = { pages: PaginatedPage[] }

/** A block paired with the height the arithmetic can actually trust. */
type MeasuredBlock = { block: PaginationBlock; height: number }

/**
 * Assigns blocks to pages greedily, in document order.
 *
 * A block goes on the current page if it fits in the remaining height and
 * starts a new one if it does not. Two rules bend that:
 *
 * - A block taller than a whole page gets a page to itself and overflows.
 *   Dropping or cutting it is the failure this function exists to have stopped.
 * - A heading is never the last block on a page. It travels to the next page
 *   with the block it announces, and where no arrangement can give both a page
 *   they fit on, they overflow together rather than come apart — an overflowing
 *   page is visible and reportable, a heading stranded at the foot of a sheet
 *   just looks like a mistake. The one heading that stays put is one with
 *   nothing after it in the document at all: there is no block to carry it.
 *
 * Widow and orphan control beyond that heading rule is out of scope.
 *
 * No blocks means no pages. A renderer that wants a blank sheet to draw is
 * better placed to decide that than this is — an empty document and a document
 * that has not been measured yet look identical from here.
 */
export function paginate(
  blocks: PaginationBlock[],
  page: { contentHeight: number }
): PaginationResult {
  const contentHeight = usableHeight(page.contentHeight)
  const pages: PaginatedPage[] = []

  /** Sections with a block on a page already sealed — see `seal`. */
  const openedSections = new Set<string>()

  /**
   * Ends a page and records what it opened, so the page after it can tell
   * whether its first block continues a section or starts one.
   *
   * A page led by a heading starts its section by definition. Anything else
   * continues one if that section is already open, which covers both a section
   * whose heading is on an earlier page and a section drawn without a heading.
   */
  const seal = (filled: MeasuredBlock[]) => {
    const first = filled[0]?.block
    const continues =
      first?.kind === "content" && openedSections.has(first.sectionId)

    pages.push({
      blocks: filled.map(({ block }) => block.key),
      continuedFrom: continues ? first.sectionId : null
    })

    for (const { block } of filled) openedSections.add(block.sectionId)
  }

  /** The page being filled, and the height its blocks have taken up. */
  let current: MeasuredBlock[] = []
  let used = 0

  for (const block of blocks) {
    const measured = { block, height: usableHeight(block.height) }

    if (current.length > 0 && used + measured.height > contentHeight) {
      const carried = trailingHeadings(current)

      /*
        Headings that are the whole page have nowhere to go: sealing what is
        left would seal nothing. They stay, and the block joins them here
        rather than on a page of its own — the overflow the doc block above
        chooses over a dangling heading.
      */
      if (carried.length < current.length) {
        seal(current.slice(0, current.length - carried.length))
        current = carried
        used = carried.reduce((sum, held) => sum + held.height, 0)
      }
    }

    current.push(measured)
    used += measured.height
  }

  if (current.length > 0) seal(current)

  return { pages }
}

/** The headings at the foot of a page that have to travel to the next one. */
function trailingHeadings(current: MeasuredBlock[]): MeasuredBlock[] {
  let start = current.length

  while (start > 0 && current[start - 1]?.block.kind === "heading") start -= 1

  return current.slice(start)
}

/**
 * A height the arithmetic can be trusted against.
 *
 * Zero content height is what the renderer reports before the sheet has been
 * laid out, and a negative or unmeasured one means the same thing: nothing
 * fits, so every block gets a page. Wrong-looking, drawable, and corrected by
 * the next measurement — which is the whole point of not throwing here. Block
 * heights get the same treatment so that one unmeasured block cannot poison
 * the running sum with `NaN` and quietly collapse the document onto one page.
 */
function usableHeight(height: number): number {
  return Number.isFinite(height) ? Math.max(0, height) : 0
}
