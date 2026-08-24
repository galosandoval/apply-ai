/**
 * The fixed icon set an icon-list section may draw from.
 *
 * Fixed, and chosen by the user from a picker: not free-form upload and not
 * model-chosen. Each one is inline SVG so it survives into the PDF and carries
 * no external request — an `<img>` would be a network fetch the print does not
 * have and a graphic a parser cannot read.
 *
 * An icon is decoration. The label beside it always says the same thing in
 * text, which is why an unrecognised key draws nothing at all rather than a
 * fallback glyph that would mean something else.
 */

/** One 24×24 stroked path per key. Names are the user's vocabulary, not ours. */
const iconPaths = {
  music:
    "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  book: "M4 19.5V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2Zm2 0h13",
  camera: "M3 8h4l2-3h6l2 3h4v11H3V8Zm9 8a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  running:
    "M14.5 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM9 21l3-5-3-3 1-5 3 3 3 1M6 12l2-4",
  cycling:
    "M6 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm12 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-12-3.5h6l3-7h3M9 6h4",
  cooking: "M4 11h16M6 11a6 6 0 0 1 12 0M5 15h14l-1 5H6l-1-5Z",
  travel:
    "M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Zm0 0a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z",
  gaming:
    "M7 12h4m-2-2v4m5-1h.01M17 11h.01M6 7h12a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-2a4 4 0 0 1 4-4Z",
  hiking:
    "M3 20h18M7 20l4-12 3 5h3l3 7M12.5 5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z",
  film: "M3 4h18v16H3V4Zm0 4h18M3 16h18M7 4v16m10-16v16",
  art: "M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H13a2 2 0 0 1 0-4h4a4 4 0 0 0 4-4c0-3.3-4-6-9-6Zm-4 6h.01M8 14h.01M12 7h.01",
  garden:
    "M12 21V10m0 0c0-3 2-5 5-5 0 3-2 5-5 5Zm0 0c0-3-2-5-5-5 0 3 2 5 5 5ZM8 21h8",
  chess:
    "M9 21h6M9 21l1-5h4l1 5M10 16l-1-4h6l-1 4M12 3a3 3 0 0 1 3 3c0 2-3 3-3 6 0-3-3-4-3-6a3 3 0 0 1 3-3Z",
  volunteer: "M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9Z",
  coffee: "M4 8h13v6a5 5 0 0 1-10 0V8Zm13 1h2a2 2 0 0 1 0 4h-2M4 21h13",
  code: "M8 6 2 12l6 6m8-12 6 6-6 6m-2-15-4 18",
  writing: "M4 20h16M6 16 16 6l3 3L9 19l-4 1 1-4Z",
  pet: "M8 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-9-5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-5 7c-3 0-5 2-5 4a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2c0-2-2-4-5-4Z",
  language: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c3 3 3 15 0 18M3 12h18"
} as const

export type ResumeIconName = keyof typeof iconPaths

/**
 * Narrows a stored icon key to one that draws.
 *
 * Called where content enters the renderer, so everything below holds a key the
 * set actually has and no component has to ask again.
 */
export function isResumeIconName(name: string): name is ResumeIconName {
  return name in iconPaths
}

export function ResumeIcon({ name }: { name: ResumeIconName }) {
  return (
    <svg
      aria-hidden="true"
      className="size-resume-icon shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <path d={iconPaths[name]} />
    </svg>
  )
}
