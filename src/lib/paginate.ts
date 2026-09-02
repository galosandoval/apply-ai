/**
 * Where the page breaks go, decided once, in a function with no browser in it.
 *
 * The renderer measures the document and hands the measurements here; this
 * decides the grouping and hands back key arrays. It knows nothing about the
 * DOM, React, or how a resume is styled — which is what makes a break provable
 * from a test rather than from a screenshot. The editor and the PDF both
 * consume what this returns; `docs/editable-resume.md` argues why.
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
 * starts a new one if it does not. Three rules bend that:
 *
 * - A block taller than a whole page gets a page to itself and overflows,
 *   rather than being dropped or cut — `docs/editable-resume.md`, under "The
 *   document is a block list".
 * - A page that opens mid-section is charged for the heading the renderer
 *   redraws at the top of it — same doc, under "The continued heading is
 *   computed".
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
   * What each section's heading costs, by the first one the document draws.
   *
   * The renderer repeats that same block at the top of a continued page, so it
   * is the same height by construction. A section with no heading is absent and
   * costs nothing, which is a page that opens straight into its content.
   */
  const headingHeights = new Map<string, number>()

  for (const block of blocks) {
    if (block.kind === "heading" && !headingHeights.has(block.sectionId)) {
      headingHeights.set(block.sectionId, usableHeight(block.height))
    }
  }

  /**
   * The height a page loses to the heading redrawn above `first`.
   *
   * Nothing unless `first` is content of a section already opened on an earlier
   * page — which is the same test `seal` makes to decide `continuedFrom`, asked
   * one page earlier so the budget knows before the page is filled.
   */
  const continuationCost = (first: PaginationBlock | undefined) =>
    first?.kind === "content" && openedSections.has(first.sectionId)
      ? (headingHeights.get(first.sectionId) ?? 0)
      : 0

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

    // A fresh page pays for its continued heading before its first block lands
    // on it, so everything measured against `contentHeight` after this is
    // measured against what is actually left.
    if (current.length === 0) used = continuationCost(block)

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

/**
 * Whether two assignments say the same thing about the same document.
 *
 * The renderer measures the document it has just drawn, so it paginates far
 * more often than the answer changes — every keystroke and every hover over a
 * style button produces a fresh result, and almost all of them agree with the
 * one already held. Storing an agreeing result would redraw the document for
 * nothing, and the redraw is what a measure-render-measure loop turns into an
 * oscillation. This is the test that stops it.
 *
 * Page order, block order and the continued heading all count: each of them is
 * something the reader would see change.
 */
export function isSamePagination(
  left: PaginatedPage[],
  right: PaginatedPage[]
): boolean {
  return (
    left.length === right.length &&
    left.every((page, index) => isSamePage(page, right[index]))
  )
}

function isSamePage(left: PaginatedPage, right: PaginatedPage | undefined) {
  return (
    left.continuedFrom === right?.continuedFrom &&
    left.blocks.length === right.blocks.length &&
    left.blocks.every((key, index) => key === right.blocks[index])
  )
}
