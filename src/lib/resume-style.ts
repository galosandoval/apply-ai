/**
 * Names the three resume styles. A style itself is a token overlay in
 * `global.css`; the rationale for each is in `docs/resume-style.md`.
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
 * what draws the document, and this copy is what gets stamped onto a resume so
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

/**
 * A style and the accent it fixed when it was chosen.
 *
 * One type because they are one decision, and everything that carries them —
 * the row, the update, the optimistic patch, the render payload — carries both
 * or neither. A style holding another style's accent is a document nobody
 * picked.
 */
export type ResumeStyleStamp = { style: string; accent: string }

/** What choosing `style` writes onto a resume. */
export function resumeStyleStamp(style: ResumeStyle): ResumeStyleStamp {
  return { style, accent: resumeStyleCatalog[style].accent }
}

/** `#rgb` or `#rrggbb`, which is the only shape an accent is allowed to be. */
const hexColour = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/**
 * A stored accent as one that can be drawn with, or nothing.
 *
 * The one place the hex is validated. The column is `text` and the value ends
 * up in a `style` attribute, so it is checked here rather than at each draw
 * site — and an unrecognisable accent falls back to the overlay's own, the way
 * an unrecognisable style falls back to the default.
 */
export function toResumeAccent(value: string | null | undefined) {
  return value && hexColour.test(value) ? value : undefined
}
