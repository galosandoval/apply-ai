/**
 * The three resume styles, as a name and an accent.
 *
 * A style is a *token overlay* — a class on the document root that re-values
 * the `--resume-*` variables, exactly the way `.resume-reflow` does. Nothing
 * here holds a size, a weight or a colour except the accent, because nothing
 * here is where a style is defined: the values live in `global.css` beside the
 * tokens they override, and this module is only how the rest of the app names
 * one.
 *
 * The rationale for each direction — what it is for, and what was rejected —
 * is in `docs/resume-style.md`.
 */

export const resumeStyles = ["classic", "standard", "modern"] as const

export type ResumeStyle = (typeof resumeStyles)[number]

/**
 * What a resume gets when it does not say.
 *
 * Standard is the descendant of the document this app already shipped, so a
 * row written before styles existed renders as close to what it rendered as
 * before as the retuned token set allows.
 */
export const defaultResumeStyle: ResumeStyle = "standard"

/**
 * How each style presents itself in the picker, and the accent it fixes.
 *
 * `accent` is duplicated here and in the CSS overlay on purpose: the CSS is
 * what draws the document, and this copy is what gets written onto a resume so
 * that a resume already sent keeps the accent it was sent with even if the
 * style's value later changes.
 */
export const resumeStyleCatalog: Record<
  ResumeStyle,
  { label: string; register: string; accent: string; className: string }
> = {
  classic: {
    label: "Classic",
    register: "Law, finance, academia",
    accent: "#1b2a41",
    className: "resume-style-classic"
  },
  standard: {
    label: "Standard",
    register: "Anywhere a resume is read by a recruiter",
    accent: "#111827",
    className: "resume-style-standard"
  },
  modern: {
    label: "Modern",
    register: "Product, design, engineering",
    accent: "#3f3f46",
    className: "resume-style-modern"
  }
}

/** Narrows a stored style name to one that has an overlay. */
export function isResumeStyle(value: string): value is ResumeStyle {
  return (resumeStyles as readonly string[]).includes(value)
}

/**
 * A stored style name as one that draws, falling back rather than throwing.
 *
 * The column is `text`, so this is what a row with junk in it reaches — and a
 * resume that renders in the default style is better than one that does not
 * render.
 */
export function toResumeStyle(value: string | null | undefined): ResumeStyle {
  return value && isResumeStyle(value) ? value : defaultResumeStyle
}

/**
 * The overlay class for a style.
 *
 * Spelled out in the catalog rather than composed as
 * `` `resume-style-${style}` ``. Tailwind decides what CSS to emit by scanning
 * source for class names as plain strings, and a name assembled at runtime is a
 * name it never sees — the overlays were silently dropped from the build and
 * every style rendered as the default. A composed class name is unusable here,
 * whatever it costs in repetition.
 */
export function resumeStyleClass(style: ResumeStyle) {
  return resumeStyleCatalog[style].className
}
