import { Fragment, type ReactNode } from "react"
import {
  customSectionShape,
  type EntryPart,
  type RenderMode,
  type RenderOptions,
  type SectionShape,
  sectionBlocks,
  type TwoColumnRow
} from "~/components/resume-section"
import {
  inDocumentOrder,
  type ResumeBlock,
  type ResumeBlockSpace,
  withBlockKeys
} from "~/lib/resume-blocks"
import { type ResumeMeasurementContract } from "~/lib/measure-resume-document"
import { type PaginatedPage } from "~/lib/paginate"
import {
  isSameSelection,
  type ResumeSelection,
  rowListFor,
  selectable,
  type SelectHandle,
  selectionKey
} from "~/lib/resume-selection"
import {
  type CoreSectionKind,
  coreSectionDefaults,
  isCoreSectionKind
} from "~/lib/section-content"
import {
  type ResumeStyle,
  type ResumeStyleStamp,
  resumeStyleClass,
  toResumeAccent,
  toResumeStyle
} from "~/lib/resume-style"
import { type InsertResumeSchema } from "~/server/db/crud-schema"

/**
 * One section of the document as it is drawn.
 *
 * `kind` and `componentType` are `string` rather than their unions because that
 * is what the column holds: the renderer is what a row with junk in it reaches,
 * so it narrows rather than assumes.
 */
export type ResumeDocumentSection = {
  id: string
  kind: string
  label: string
  componentType: string
  position: number
  /** Custom sections only — a core section's content is its typed rows. */
  content?: unknown
}

/**
 * The `ResumeStyleStamp` a payload carries, if it carries one.
 *
 * Loose strings because that is what the columns hold, narrowed at the one
 * place each becomes a class or a token value. Absent means the default — a
 * resume created before styles existed, or a PDF payload assembled without one.
 */
type DocumentStamp = Partial<ResumeStyleStamp>

/**
 * Everything the resume template renders. Deliberately not a Zod-derived type:
 * the editor and the PDF each assemble it from a different source, and this is
 * the contract they agree on.
 */
export type ResumeDocumentData = {
  profession: string
  /** The resume's own snapshot, not the account's — see `schema.contact`. */
  contact: InsertResumeSchema["contact"]
  experience: InsertResumeSchema["experience"]
  education: InsertResumeSchema["education"]
  /**
   * The sections to draw, in `position` order. Optional because a payload may
   * arrive without any — the PDF of a document that predates them — and falls
   * back to the order a new resume is created with. A saved resume carries its
   * sections everywhere it is drawn, the PDF included, or the print would not
   * be the document the user was looking at.
   */
  sections?: ResumeDocumentSection[]
} & DocumentStamp

/**
 * What the editor selects with, and what it has selected.
 *
 * Optional everywhere: without it this is a pure read-only render — no click
 * targets, no outline, no attributes — which is exactly what the PDF and the
 * parseability check want, and what keeps an editor concern out of a print.
 */
export type DocumentSelection = {
  selected: ResumeSelection | null
  onSelect: (selection: ResumeSelection) => void
}

/**
 * The sections a resume is drawn with before it has any of its own.
 *
 * Derived from the same list the server creates a resume's rows from, so a
 * document without sections and the resume it becomes render the same way.
 */
const defaultSections: ResumeDocumentSection[] = coreSectionDefaults.map(
  (section, position) => ({ ...section, id: section.kind, position })
)

/**
 * Everything the sections need, passed as one prop rather than through context
 * — context is a client-only API, and this tree renders on the server too.
 */
type Doc = {
  data: ResumeDocumentData
  render: RenderOptions
  selection?: DocumentSelection
}

/**
 * The one resume template. Props in, markup out — no form state, no ids for a
 * browser to inject into. Rendered by the editor and by the PDF so the two stay
 * in agreement.
 *
 * Read-only, always: editing is a panel beside the document, not an input
 * inside it. `selection` adds click targets and an outline for the editor, and
 * `isEditor` makes an empty section and an empty field visible rather than
 * absent — a blank the user cannot see is a blank they cannot fill in.
 */
export function ResumeDocument({
  data,
  mode = "page",
  isEditor = false,
  pages,
  selection
}: {
  data: ResumeDocumentData
  mode?: RenderMode
  isEditor?: boolean
  /**
   * Where the breaks fall, from `paginate` — or nothing, for the flow.
   *
   * Without it the document is one continuous run of blocks, which is what the
   * PDF measures on its first pass and what the structural tests read. With it
   * the same blocks are dealt onto sheets of paper. The renderer decides
   * nothing about where a break lands; it is handed the answer.
   *
   * Ignored in reflow. A phone is not a page, and a stack of A4 sheets on one
   * is a document nobody can read — see `RenderMode`.
   */
  pages?: PaginatedPage[]
  selection?: DocumentSelection
}) {
  const doc: Doc = { data, render: { mode, isEditor }, selection }

  // Sorted here rather than trusted from the caller: render order is data, and
  // this is the one place that decides what the data means.
  const sections = [...(data.sections ?? defaultSections)].sort(
    (left, right) => left.position - right.position
  )

  const blocks = documentBlocks(doc, sections)

  // The assignment only applies where there is paper to apply it to: reflow is
  // a phone, and a stack of A4 sheets on one is a document nobody can read.
  const activePages = mode === "page" && pages ? pages : null

  return (
    /*
      Normal flow, not a fixed page height with `overflow-hidden`: content past
      the first page used to be silently deleted from the document. The page
      still has a printable width in page mode; height is whatever the content
      needs. What one sheet has room for is `--resume-page-content-height`, for
      whoever asks.

      An assignment turns that flow into a stack of sheets, and the sheets do
      have the height — but still nothing that hides what does not fit. A page
      visibly too full is a bug the user can see; a page that quietly ate a
      paragraph is not.
    */
    <div
      className={documentClassName(
        mode,
        toResumeStyle(data.style),
        activePages !== null
      )}
      style={accentOverride(data.accent)}
    >
      {activePages ? (
        <PageStack blocks={blocks} pages={activePages} />
      ) : (
        <BlockFlow blocks={blocks} />
      )}
    </div>
  )
}

/**
 * The paper itself: its background and the margin printed inside it.
 *
 * One copy, because a page and the continuous document are the same paper —
 * respelt in two places it is a sheet that could quietly stop matching the
 * flow the PDF measured.
 */
const paperClassName = "bg-resume-paper px-resume-page-x py-resume-page-y"

/**
 * One sheet of paper, as a class list.
 *
 * Exactly A4 in both dimensions — the height is a token like the width has
 * always been, so a page is the size of the thing it will be printed on rather
 * than the size of whatever happens to be on it. The margin is padding *inside*
 * the sheet, on all four sides, because the border box is the paper.
 *
 * Nothing here hides an overflow, deliberately: read the comment in
 * `ResumeDocument` about the page that used to clip. `relative` is what makes
 * that promise true rather than merely unhidden — see `Sheet`. The gap to the
 * next sheet and the break that ends it are `.resume-page-sheet` in
 * `global.css`, which a utility cannot say.
 */
const pageClassName = `resume-page resume-page-sheet ${paperClassName} relative h-resume-page w-resume-page rounded-resume-page`

/**
 * The document dealt onto sheets, one element per assigned page.
 *
 * A page holds the blocks it was assigned and nothing else, looked up by key —
 * the assignment travels as keys rather than as blocks so that it stays cheap
 * to compare against the last one, and a key that no longer names a block is a
 * block that was edited away between the measurement and this render, which
 * drops out rather than throwing.
 */
function PageStack({
  blocks,
  pages
}: {
  blocks: ResumeBlock[]
  pages: PaginatedPage[]
}) {
  const byKey = new Map(blocks.map((block) => [block.key, block]))
  const assigned = new Set(pages.flatMap((page) => page.blocks))
  const unassigned = blocks.filter((block) => !assigned.has(block.key))
  const total = pages.length + (unassigned.length > 0 ? 1 : 0)

  return (
    <>
      {pages.map((page, index) => (
        <Sheet
          blocks={page.blocks.flatMap((key) => byKey.get(key) ?? [])}
          heading={
            page.continuedFrom &&
            continuationHeading(blocks, page.continuedFrom)
          }
          index={index}
          key={page.blocks[0] ?? `empty:${index}`}
          total={total}
        />
      ))}

      {/*
        Whatever the assignment did not name, on a sheet of its own.

        An assignment is a measurement of a document as it was a moment ago, and
        a block added since is a block no page claims. Drawing them is the same
        choice the overflowing page is: a resume with an unexpected last page is
        a document the user can see is wrong, and one that quietly lost a job is
        not. The next measurement replaces the assignment and the page goes.

        It is marked, because it is not one of the pages that were assigned: a
        parser counting the assignment against the markup would otherwise find
        one page more than it asked for and have no way to tell which.
      */}
      {unassigned.length > 0 && (
        <Sheet
          blocks={unassigned}
          index={pages.length}
          isUnassigned
          total={total}
        />
      )}
    </>
  )
}

/**
 * One page element: a sheet of paper with blocks on it.
 *
 * One component rather than two near-identical elements, because an assigned
 * page and the sheet that catches what the assignment missed are the same piece
 * of paper — spelt twice, they are two sheets that can quietly stop matching.
 *
 * `--resume-page-order` stacks the sheets in reverse: the first page paints
 * above the second, the second above the third. Without it a block too tall for
 * its page runs *under* the next sheet's opaque background, which is the
 * clipping the document comment forbids, arrived at by paint order instead of
 * by `overflow-hidden`. Reversed, the overflow lands on top of the page below
 * and is a bug the user can see — which is the whole point.
 *
 * It is markup rather than style because it counts the sheets, and CSS cannot;
 * `.resume-page-sheet` in `global.css` is what reads it.
 */
function Sheet({
  blocks,
  heading,
  index,
  isUnassigned = false,
  total
}: {
  blocks: ResumeBlock[]
  heading?: ReactNode
  index: number
  isUnassigned?: boolean
  total: number
}) {
  return (
    <div
      className={pageClassName}
      data-resume-page={index}
      data-resume-page-unassigned={isUnassigned ? "true" : undefined}
      style={{ "--resume-page-order": total - index } as React.CSSProperties}
    >
      {heading}

      <BlockFlow blocks={blocks} />
    </div>
  )
}

/**
 * The heading of the section a page picks up part-way through, redrawn.
 *
 * The same title and the same rule in the same tokens, so a reader arriving at
 * the top of page two knows what they are looking at. The native mechanism for
 * this is a table `thead`, and a layout table is on the permanent exclusion
 * list — see `docs/resume-style.md`. So the heading is repeated from the
 * assignment instead.
 *
 * It carries no block key. The key is what a measurement is filed under, and
 * two elements answering to one key is a height measured twice; this element is
 * a repeat of a block rather than a block. `data-resume-continued` is how a
 * parser — or a test — tells it from a genuine second section of the same name,
 * and the title itself is left alone: appending "(continued)" would be the
 * renderer editing the user's own section name.
 *
 * The height it costs is not free, and `paginate` reserves it: a page that
 * opens mid-section is measured with one heading already on it.
 */
function continuationHeading(blocks: ResumeBlock[], sectionId: string) {
  const heading = blocks.find(
    (block) => block.sectionId === sectionId && block.kind === "heading"
  )

  // A section drawn without a heading has none to repeat, which is a page that
  // opens straight into its content — the same thing the flow does.
  if (!heading) return null

  return (
    <div
      className="break-inside-avoid break-after-avoid"
      data-resume-block-kind="heading"
      data-resume-continued="true"
    >
      {heading.node}
    </div>
  )
}

/**
 * The whole document, in order, as the blocks a page is filled with.
 *
 * The tree is still how it is built — a section owns its entries, an entry owns
 * its bullets — but what comes out is a flat list, because a page is filled
 * with a list. Every block here can be moved to another sheet on its own, which
 * is the property the nesting could not have.
 */
function documentBlocks(doc: Doc, sections: ResumeDocumentSection[]) {
  return inDocumentOrder([
    /*
      The header is its own one-block section. It belongs to no section the
      user owns, and every block has to name one — so it names the same thing
      the selection model already calls it, and a page that opens with it is
      opening that section rather than continuing anything.
    */
    ...withBlockKeys("header", [
      {
        kind: "header",
        space: "none",
        select: handleFor(doc, { kind: "header" }),
        node: <Header doc={doc} />
      }
    ]),
    ...sections.flatMap((section) => sectionBlocksFor(doc, section))
  ])
}

/**
 * The blocks in order, with each run of them that selects the same thing drawn
 * inside one click target.
 *
 * A job is several blocks, and an outline per block is five boxes stacked down
 * the page where the user selected one job. The run is what the editor draws
 * around, so selection looks the way it did when an entry was a single element
 * — and a run is computed rather than nested, so it can be a *page's* worth of
 * a job once a job is allowed to span two of them.
 *
 * A read-only document has no handles, so it has no runs and no extra element:
 * what the PDF prints is the blocks themselves.
 */
function BlockFlow({ blocks }: { blocks: ResumeBlock[] }) {
  return (
    <>
      {selectionRuns(blocks).map((run) =>
        run.select ? (
          <SelectableRun key={run.blocks[0]?.key} run={run} />
        ) : (
          run.blocks.map((block) => (
            <ResumeBlockElement block={block} key={block.key} />
          ))
        )
      )}
    </>
  )
}

/** Adjacent blocks that select the same thing, in document order. */
type SelectionRun = { select: SelectHandle | null; blocks: ResumeBlock[] }

function selectionRuns(blocks: ResumeBlock[]): SelectionRun[] {
  const runs: SelectionRun[] = []

  for (const block of blocks) {
    const open = runs.at(-1)

    // Blocks of one entry are contiguous by construction, so "same thing as
    // the block before it" is the whole test — no run can be reopened later.
    if (open && open.select?.key === (block.select?.key ?? undefined)) {
      open.blocks.push(block)
      continue
    }

    runs.push({ select: block.select ?? null, blocks: [block] })
  }

  return runs
}

/**
 * One run, as the thing the editor outlines.
 *
 * The gap the run's last block owns is moved onto the run, so the outline ends
 * where the content does rather than a rhythm step below it. The geometry is
 * the same either way — the padding is in the same place in the flow — which
 * is why the read-only render can skip this element entirely.
 */
function SelectableRun({ run }: { run: SelectionRun }) {
  const select = selectable(run.select)
  const last = run.blocks.at(-1)

  return (
    <div
      className={`${select.className} ${runSpaceClass[last?.space ?? "none"]}`}
      {...select.attributes}
    >
      {run.blocks.map((block) => (
        <ResumeBlockElement
          block={block === last ? { ...block, space: "none" } : block}
          key={block.key}
        />
      ))}
    </div>
  )
}

/** The space a block owns after itself, as the padding that draws it. */
const blockSpaceClass: Record<ResumeBlockSpace, string> = {
  none: "",
  inline: "pb-resume-inline",
  entry: "pb-resume-entry",
  section: "pb-resume-section"
}

/**
 * The same space, on a run, as margin.
 *
 * An outline is drawn outside the padding and inside the margin, so a run that
 * held its gap as padding would draw the editor's selection box a rhythm step
 * below where the content ends. The gap between two entries was margin before
 * the document was a block list, and it stays margin here. Both maps are
 * spelled out because a class name assembled at runtime is a class name the
 * compiler never sees.
 */
const runSpaceClass: Record<ResumeBlockSpace, string> = {
  none: "",
  inline: "mb-resume-inline",
  entry: "mb-resume-entry",
  section: "mb-resume-section"
}

/**
 * One block, drawn.
 *
 * `break-inside-avoid` sits here rather than on a job or a school: an entry
 * that cannot break is an entry that moves whole to the next sheet, which is
 * how a nine-bullet role comes to waste most of a page. The block is the unit
 * that is never cut, and it is deliberately smaller than an entry.
 *
 * The key, the kind, the section and the order are in the markup because
 * measurement happens over the rendered document — in the editor's DOM and in
 * the PDF's browser — and a height is worth nothing without the block it was
 * taken from. The section is there because a break is decided per section as
 * well as per block: a page that opens mid-section is charged for the heading
 * redrawn at the top of it. The order is there because the drawn order is the
 * last assignment's, not the document's — see `inDocumentOrder`.
 *
 * `resumeMeasurementContract` below is the only thing that reads any of it
 * back.
 */
function ResumeBlockElement({ block }: { block: ResumeBlock }) {
  const className = [
    "break-inside-avoid",
    block.kind === "heading" ? "break-after-avoid" : "",
    blockSpaceClass[block.space]
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div
      className={className}
      data-resume-block={block.key}
      data-resume-block-kind={block.kind}
      data-resume-block-order={block.order}
      data-resume-editor-only={block.editorOnly ? "true" : undefined}
      data-resume-section={block.sectionId}
    >
      {block.node}
    </div>
  )
}

/** Where a measurer finds the document, its sheets and the blocks on them. */
export const resumeDocumentSelector = ".resume-document"
export const resumePageSelector = "[data-resume-page]"
export const resumeBlockSelector = "[data-resume-block]"

/** The token holding what one sheet has room for, declared on the document. */
export const resumePageContentHeightToken = "--resume-page-content-height"

/**
 * Everything a measurer needs to read this file's markup back.
 *
 * Here rather than beside the measurer because this is where the attributes are
 * written: spelt on both sides of the module boundary, a rename is a silent
 * break — every block reads as unidentifiable, drops out of the measurement,
 * and the document lands on a leftover sheet with no error anywhere.
 *
 * Data rather than a function, because the measurement also runs inside the
 * PDF's browser, where there is no module graph to import a function from — see
 * `measureResumeDocument`.
 */
export const resumeMeasurementContract: ResumeMeasurementContract = {
  documentSelector: resumeDocumentSelector,
  pageSelector: resumePageSelector,
  blockSelector: resumeBlockSelector,
  contentHeightToken: resumePageContentHeightToken,
  dataset: {
    key: "resumeBlock",
    sectionId: "resumeSection",
    kind: "resumeBlockKind",
    order: "resumeBlockOrder",
    editorOnly: "resumeEditorOnly"
  }
}

/**
 * The page, the stack of pages, or the phone — in one of three styles.
 *
 * Both are one class that re-values tokens — everything below reads the same
 * tokens, which is why the two modes cannot disagree about what the document
 * says and why no component below here has ever heard of a style. Adding a
 * fourth direction is an overlay in `global.css` and a name in
 * `~/lib/resume-style`; nothing in this file changes.
 *
 * Each mode carries its own marker class. `resume-page` names an A4 page and
 * nothing else, so an assertion about the page is not also an assertion about
 * the phone. Paginated, the pages are below this element and carry it one
 * each; the document itself is only what holds them.
 */
function documentClassName(
  mode: RenderMode,
  style: ResumeStyle,
  isPaginated: boolean
) {
  const shared = `resume-document ${resumeStyleClass(style)} text-resume-body`

  if (mode !== "page") return `${shared} ${paperClassName} resume-reflow w-full`

  /*
    A stack of pages is not itself a page. Each sheet carries the paper, the
    margin, the corners and the `resume-page` marker; what shows between them is
    the app's own background, which is the whole reason a second page reads as a
    second page at a glance. Unpaginated, the document is still the one sheet it
    always was, and still the thing `resume-page` names.
  */
  return isPaginated
    ? shared
    : `${shared} ${paperClassName} resume-page w-resume-page rounded-resume-page`
}

/**
 * The resume's own accent, as a token override on the document root.
 *
 * A style overlay fixes an accent; this is the copy that was stamped onto the
 * resume when the style was chosen, and it wins — so retuning a direction never
 * repaints a document someone already sent. An accent that is not a colour
 * falls back to the overlay's own; `toResumeAccent` is where that is decided.
 */
function accentOverride(accent: string | undefined) {
  const ink = toResumeAccent(accent)

  return ink
    ? ({ "--resume-ink-accent": ink } as React.CSSProperties)
    : undefined
}

/**
 * How one selectable thing asks whether it is selected.
 *
 * `null` when the document is not being edited, which is what makes the
 * read-only render emit no selection markup at all.
 */
function handleFor(doc: Doc, selection: ResumeSelection): SelectHandle | null {
  const { selection: state } = doc

  if (!state) return null

  return {
    key: selectionKey(selection),
    isSelected: isSameSelection(state.selected, selection),
    onSelect: () => state.onSelect(selection)
  }
}

/**
 * One string as the document draws it.
 *
 * Empty is nothing in the document and a visible stand-in in the editor: a job
 * added a moment ago is all empty strings, and a row with no height is a row
 * with nothing to click.
 */
function Text({
  doc,
  value,
  className = "",
  multiline = false
}: {
  doc: Doc
  value: string | null | undefined
  className?: string
  multiline?: boolean
}) {
  // Multiline text keeps the newlines it was typed with instead of collapsing
  // them to a space.
  const textClassName = multiline
    ? `${className} whitespace-pre-line`
    : className

  if (!value) {
    return doc.render.isEditor ? (
      <span className={`${className} text-resume-muted`}>&mdash;</span>
    ) : null
  }

  return <span className={textClassName}>{value}</span>
}

/**
 * One section as its blocks, in whichever shape it configures.
 *
 * A core section is dispatched on its `kind` and fed by its typed rows; a
 * custom one is dispatched on its `componentType` and fed by its own content.
 * Neither gets a renderer of its own — that is the whole point.
 */
function sectionBlocksFor(
  doc: Doc,
  section: ResumeDocumentSection
): ResumeBlock[] {
  const shape = isCoreSectionKind(section.kind)
    ? coreShape(doc, section.kind)
    : customSectionShape(section.componentType, section.content)

  if (!shape) return []

  return sectionBlocks({
    label: section.label,
    render: doc.render,
    sectionId: section.id,
    select: handleFor(doc, { kind: "section", sectionId: section.id }),
    shape
  })
}

/**
 * A core section as a pre-configured instance of a base shape.
 *
 * Its structure is fixed and its content comes from its typed rows — a user
 * cannot restructure Experience through the renderer, which is what keeps it
 * machine-readable for the scoring work.
 */
function coreShape(doc: Doc, kind: CoreSectionKind): SectionShape {
  switch (kind) {
    case "experience":
      return { componentType: "twoColumn", rows: experienceRows(doc) }
    case "education":
      return { componentType: "twoColumn", rows: educationRows(doc) }
  }
}

/** The selection a row of a core section carries, by the row's own id. */
function rowHandle(doc: Doc, kind: CoreSectionKind, rowId: string | undefined) {
  const list = rowListFor(kind)

  if (!list || !rowId) return null

  return handleFor(doc, { kind: "row", list: list.key, rowId })
}

function experienceRows(doc: Doc): TwoColumnRow[] {
  return doc.data.experience.map((job) => ({
    ...entryRow(doc, {
      start: job.startDate,
      end: job.endDate,
      name: job.name,
      detail: job.title,
      body: job.bullets.map((bullet) => ({
        kind: "bullet",
        /*
          One list per bullet, rather than one list holding every bullet of a
          job. A list is an element, and an element cannot be in two places —
          which is what a job split across a page boundary asks of it. Each
          bullet is still a real list item inside a real list, on whichever
          sheet it lands on, and the discs line up because the indent is a
          token rather than a position.
        */
        node: (
          <ul className="list-disc pl-resume-bullet">
            <li className="whitespace-pre-line">{bullet}</li>
          </ul>
        )
      }))
    }),
    select: rowHandle(doc, "experience", job.id)
  }))
}

function educationRows(doc: Doc): TwoColumnRow[] {
  return doc.data.education.map((school) => ({
    ...entryRow(doc, {
      start: school.startDate,
      end: school.endDate,
      name: school.name,
      detail: school.degree,
      body: [
        {
          kind: "description",
          node: <Text doc={doc} multiline value={school.description} />
        }
      ]
    }),
    select: rowHandle(doc, "education", school.id)
  }))
}

/**
 * One chronology entry: dates on the left, and on the right a bold name, the
 * role or degree beside it, then the entry's body.
 *
 * Experience and Education differ only in what the second heading field is
 * called and what the body is, so they share the shape rather than each holding
 * a copy that a style change would have to find twice.
 */
function entryRow(
  doc: Doc,
  {
    start,
    end,
    name,
    detail,
    body
  }: {
    start: string
    end: string
    name: string
    detail: string
    body: EntryPart[]
  }
): TwoColumnRow {
  return {
    /*
      The date range wraps inside its column rather than running out of it.
      `whitespace-nowrap` here meant a long range — "Sep 2016 - May 2018" — sat
      on top of the employer name in any style whose column is narrower than the
      text, which is a layout the token set is supposed to be free to choose.
    */
    left: (
      <p className="resume-dates">
        <Text doc={doc} value={start} /> - <Text doc={doc} value={end} />
      </p>
    ),
    right: (
      <div className="resume-entry-name">
        <Text doc={doc} value={name} />,{" "}
        <Text className="resume-entry-detail" doc={doc} value={detail} />
      </div>
    ),
    body
  }
}

function Header({ doc }: { doc: Doc }) {
  const { data } = doc

  const contactFields = [
    data.contact.location,
    data.contact.email,
    data.contact.linkedIn ?? "",
    data.contact.portfolio ?? "",
    data.contact.phone ?? ""
  ].filter(Boolean)

  return (
    <div className="flex flex-col items-center pb-resume-inline">
      <div className="justify-self-center">
        <h1 className="resume-name text-resume-name text-resume-accent">
          <Text doc={doc} value={data.contact.fullName} />
        </h1>
      </div>

      <h2 className="resume-title text-resume-title">
        <Text doc={doc} value={data.profession} />
      </h2>

      <div className="mx-auto flex flex-wrap justify-center gap-resume-inline text-center">
        {contactFields.map((value, index) => (
          <Fragment key={value}>
            <ContactLine value={value} />
            {index !== contactFields.length - 1 && <span>&bull;</span>}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

/**
 * Contact details render as links so they stay clickable in the preview and the
 * PDF.
 *
 * The URL is the label. Rendering "LinkedIn" over an `href` puts the address in
 * the link target only, where the PDF's text layer — and anything parsing it —
 * cannot see it.
 */
function ContactLine({ value }: { value: string }) {
  if (value.includes("@")) {
    return <ContactLink href={`mailto:${value}`} label={value} />
  }

  if (/^(https?:\/\/|www\.)/.test(value) || value.includes(".com")) {
    return <ContactLink href={toHref(value)} label={value} />
  }

  return <span>{value}</span>
}

/** A bare `linkedin.com/in/me` still has to be a working link. */
function toHref(value: string) {
  return /^https?:\/\//.test(value) ? value : `https://${value}`
}

function ContactLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="text-resume-link underline"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {label}
    </a>
  )
}
