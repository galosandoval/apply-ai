import { type PaginationBlock } from "~/lib/paginate"

/**
 * Where the measurer finds what it measures, spelt by the renderer.
 *
 * Passed in rather than imported because this function runs in two browsers:
 * the editor's, where an import is an import, and the PDF's, where the source
 * is shipped over CDP and there is no module graph on the other side. Handing
 * the names in as data is what lets both sides read the attributes the renderer
 * writes without either spelling them a second time.
 */
export type ResumeMeasurementContract = {
  documentSelector: string
  pageSelector: string
  blockSelector: string
  contentHeightToken: string
  /** `dataset` keys, not attribute names — camelCase, as the DOM hands them. */
  dataset: {
    key: string
    sectionId: string
    kind: string
    order: string
    editorOnly: string
  }
}

/** What one pass over a drawn document yields, ready for `paginate`. */
export type ResumeMeasurement = {
  blocks: PaginationBlock[]
  contentHeight: number
}

/**
 * The drawn document, measured — the one part of pagination that needs a
 * browser, and deliberately the only part.
 *
 * Self-contained on purpose: every helper is declared inside the function and
 * everything it needs from the renderer arrives in `contract`. Playwright sends
 * this to Chromium as source, so a reference to anything at module scope — an
 * import, a shared constant, a transpiler's helper — arrives as an undefined
 * name at the far end and takes the whole measurement with it. The editor calls
 * it as an ordinary function, the PDF route hands it to `page.evaluate`, and
 * because it is the same function neither can measure the document differently
 * from the other.
 *
 * `null` when there is no document drawn yet: nothing to assign, which is not
 * the same answer as a document that measured as empty.
 *
 * `within` scopes the search to a caller that has an element in hand — the
 * editor, which knows which document it is measuring. `page.evaluate` passes
 * one argument and so never passes it, which is right: the print's browser
 * holds exactly one document and nothing else.
 */
export function measureResumeDocument(
  contract: ResumeMeasurementContract,
  within?: HTMLElement | null
): ResumeMeasurement | null {
  const found = (within ?? document).querySelector<HTMLElement>(
    contract.documentSelector
  )

  if (!found) return null

  // Re-bound rather than used narrowed: the helpers below are declarations, and
  // a declaration is hoisted out of the guard that proved it was there.
  const root: HTMLElement = found

  /**
   * One drawn block's identity, read back off the element carrying it.
   *
   * An element missing any of it is not a block this can answer for, and is
   * left out rather than filed under an empty name: a measurement filed under
   * `""` collides silently with every other one. The heading a continued page
   * repeats has no key at all — it is a repeat of a block rather than a block,
   * and `paginate` already budgets for it — so it falls out here.
   */
  function identify(element: HTMLElement) {
    const data = element.dataset
    const key = data[contract.dataset.key]
    const sectionId = data[contract.dataset.sectionId]

    // `Number.isFinite` rather than a truth test: the header is order zero, and
    // dropping the first block of every document is not the sort of thing a
    // measurement complains about — it just draws it on the wrong sheet.
    const order = Number(data[contract.dataset.order])

    if (!key || !sectionId || !Number.isFinite(order)) return null

    return {
      key,
      sectionId,
      kind: data[contract.dataset.kind] === "heading" ? "heading" : "content",
      order,
      isEditorOnly: Boolean(data[contract.dataset.editorOnly])
    } as const
  }

  function marginBottom(element: HTMLElement): number {
    return Number.parseFloat(getComputedStyle(element).marginBottom) || 0
  }

  /**
   * A block's height including the space it owns after itself.
   *
   * A block holds that space as padding, which its own box already counts — but
   * the last block of a selection run hands its space to the run, as a margin,
   * so that the editor's outline ends where the content does. That margin falls
   * below the block all the same, and a page budgeted without it is a page one
   * gap too full for every run that ends on it.
   *
   * So: the block's box, plus the bottom margin of every ancestor it is the
   * last child of, up to the sheet it is drawn on — or up to the document,
   * before there are sheets. Stopping at the sheet is what keeps the loop
   * still: the gap between two pieces of paper is a margin on the sheet, and
   * charged to the last block on it, the second measurement would disagree with
   * the first and the two would trade assignments forever. Nothing here has a
   * top margin, so there is no collapsing to reason about.
   */
  function heightWithTrailingSpace(element: HTMLElement): number {
    const sheet = element.closest<HTMLElement>(contract.pageSelector) ?? root

    let height = element.getBoundingClientRect().height
    let node: HTMLElement | null = element

    while (node && node !== sheet) {
      height += marginBottom(node)
      node = node.nextElementSibling ? null : node.parentElement
    }

    return height
  }

  /**
   * What one sheet has room for, in pixels.
   *
   * Resolved by putting a box of that height into the document and asking how
   * tall it came out, because the token is a `calc` over the page and its
   * padding and a custom property is handed back unresolved. Doing the
   * arithmetic here instead would be a second copy of the page's geometry, and
   * a copy that drifts from the padding the sheet is actually drawn with does
   * not fail a test — it cuts a line of text in half.
   *
   * Inside the document rather than anywhere else because that is the element
   * the token is declared on, and a style re-values it: a `var()` resolves where
   * it is written. Absolutely positioned and removed before this returns, so it
   * is never laid out beside the document and React never sees it.
   */
  function contentHeight(): number {
    const probe = document.createElement("div")

    probe.style.position = "absolute"
    probe.style.visibility = "hidden"
    probe.style.width = "0"
    probe.style.height = `var(${contract.contentHeightToken})`

    root.append(probe)

    const height = probe.getBoundingClientRect().height

    probe.remove()

    return height
  }

  /*
    Read off the attributes the renderer writes rather than off the data that
    produced them: the height and the identity have to come from the same
    element, or a measurement is filed against a block it was not taken from.

    Sorted by the order the renderer stamped rather than taken in the order the
    elements are found, because those are two different orders once there are
    sheets — see `inDocumentOrder`.

    A block marked editor-only is measured as nothing rather than left out — see
    `ResumeBlockDraft.editorOnly` for why it is not simply skipped.

    Index loops and hand-written object literals rather than `for…of`, spread
    and `flatMap`: a downlevelling transpiler rewrites those into helpers it
    declares at module scope, and a module scope is exactly what this function
    does not have on the far side of `page.evaluate`.
  */
  const elements = root.querySelectorAll<HTMLElement>(contract.blockSelector)
  const measured: (PaginationBlock & { order: number })[] = []

  // eslint-disable-next-line @typescript-eslint/prefer-for-of -- see above
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index]
    const block = element && identify(element)

    if (!element || !block) continue

    measured.push({
      key: block.key,
      sectionId: block.sectionId,
      kind: block.kind,
      order: block.order,
      height: block.isEditorOnly ? 0 : heightWithTrailingSpace(element)
    })
  }

  measured.sort((left, right) => left.order - right.order)

  const blocks: PaginationBlock[] = measured.map((block) => ({
    key: block.key,
    sectionId: block.sectionId,
    kind: block.kind,
    height: block.height
  }))

  return { blocks, contentHeight: contentHeight() }
}
