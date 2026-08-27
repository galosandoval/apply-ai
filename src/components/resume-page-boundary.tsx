import { type RenderMode } from "~/components/resume-section"

/**
 * The page boundary, drawn over the document.
 *
 * The document no longer clips at one page, which means overflow is silent
 * rather than destructive. This is where it becomes something the user can see
 * before they send it rather than after.
 *
 * Page mode only: reflow is not a page, so a rule at every page height through
 * it would mark a boundary that does not exist. Judging the print on a phone is
 * what the PDF preview is for.
 *
 * The rule itself is `.resume-page-rule` in `global.css`, reading the page
 * height as a token rather than holding its own copy of A4. It reads it off
 * `:root`, though: this overlay is a sibling of the document, not a descendant,
 * so a style that re-valued the height on `.resume-document` would move the
 * page and not the mark. Nothing does today, and the real pages this becomes
 * are the fix — a boundary that is the sheet's own edge cannot disagree with it.
 */
export function ResumePageBoundary({
  children,
  mode
}: {
  children: React.ReactNode
  mode: RenderMode
}) {
  return (
    <div className="relative h-fit">
      {children}

      {mode === "page" && (
        <div
          aria-hidden
          className="resume-page-rule pointer-events-none absolute inset-0"
        />
      )}
    </div>
  )
}
