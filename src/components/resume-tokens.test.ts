import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  defaultResumeStyle,
  resumeStyleCatalog,
  resumeStyleStamp,
  resumeStyles
} from "~/lib/resume-style"
import { resume } from "~/server/db/schema"

/**
 * The load-bearing test for three styles.
 *
 * A style is a token overlay and nothing else, which is the entire reason the
 * third direction cost less to build than the first. The first hardcoded size,
 * weight, case or colour in a resume component is where that stops being true:
 * it is a value one style can no longer change, and it will be found by a user
 * looking at a document that came out wrong rather than by anyone reading this
 * file.
 *
 * So the assertion is on the source, not on rendered markup. A literal that
 * only shows up under one style at one screen width is exactly what a render
 * test would miss.
 */

/** Every component that draws part of the resume document. */
const documentSources = [
  "src/components/resume-document.tsx",
  "src/components/resume-section.tsx",
  "src/components/resume-icon.tsx",
  "src/lib/resume-markdown.tsx"
]

/**
 * The utilities that would be a style decision held as a literal.
 *
 * Each one names an axis the styles actually differ on — the type scale, weight,
 * case, the spacing rhythm, the rule, the accent — so a match is not a lint
 * nit, it is a value the overlay in `global.css` can no longer reach.
 *
 * Structure is deliberately absent: `flex`, `list-disc`, `break-inside-avoid`,
 * `min-w-0`, `whitespace-nowrap` and their like are what the document *is*, not
 * how it looks, and no style is allowed to change them anyway.
 */
const forbidden: { what: string; pattern: RegExp }[] = [
  {
    what: "a type size (the scale is --resume-text-*)",
    pattern: /\btext-(xs|sm|base|lg|xl|\d+xl)\b/
  },
  {
    what: "a font weight (--resume-*-weight, via .resume-* in global.css)",
    pattern:
      /\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/
  },
  {
    what: "a text case (--resume-*-case)",
    pattern: /\b(uppercase|lowercase|capitalize)\b/
  },
  {
    what: "a font style (--resume-*-style)",
    pattern: /\b(italic|not-italic)\b/
  },
  {
    what: "letter spacing or leading (the scale carries both)",
    pattern: /\b(tracking|leading)-(?!resume-)[a-z0-9[]/
  },
  {
    what: "a spacing step (--resume-space-*, off one --resume-space-step)",
    pattern:
      /(?<![\w-])(p[trblxy]?|m[trblxy]?|gap(-[xy])?|space-[xy])-(?!resume-)(\d|px|\[)/
  },
  {
    what: "a width, height or border weight (--resume-rule-weight and friends)",
    pattern: /(?<![\w-])(h|w|size|border)-(?!resume-)(\d|px|\[)/
  },
  {
    what: "a colour (--resume-ink-*, --resume-paper)",
    pattern:
      /\b(text|bg|border|fill|stroke|decoration)-(?!resume-)(white|black|current|transparent|inherit|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/
  },
  {
    what: "a corner radius (--resume-tag-radius, --resume-page-radius)",
    pattern: /(?<![\w-])rounded(-(?!resume-)[a-z0-9[]|(?![-\w]))/
  },
  {
    what: "an inline CSS declaration",
    pattern: /style=\{\{\s*(?!"--resume)/
  }
]

/**
 * The file's lines with every comment blanked out, line numbering intact.
 *
 * These files explain themselves at length, and several of those explanations
 * quote the literal they exist to justify not using — `h-[29.7cm]` is in a
 * comment about why the page no longer clips. A prose mention of a value is the
 * opposite of holding one.
 */
function codeLines(source: string) {
  let inBlock = false

  return source.split("\n").map((raw) => {
    let line = raw

    if (inBlock) {
      const ends = line.indexOf("*/")

      if (ends === -1) return ""

      inBlock = false
      line = line.slice(ends + 2)
    }

    const opens = line.indexOf("/*")

    if (opens !== -1 && !line.includes("*/", opens)) {
      inBlock = true
      line = line.slice(0, opens)
    }

    return line.replace(/\/\*.*?\*\//g, "").replace(/(^|\s)\/\/.*$/, "$1")
  })
}

describe.each(documentSources)("%s", (path) => {
  it.each(forbidden)("emits no $what", async ({ pattern }) => {
    const source = await readFile(join(process.cwd(), path), "utf8")

    // Reported by the offending line rather than by a bare `false`: the point
    // of failing is to say which value stopped being a token.
    const offenders = codeLines(source)
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => pattern.test(line))
      .map(({ line, number }) => `${path}:${number}  ${line}`)

    expect(offenders).toEqual([])
  })
})

describe("the stored defaults", async () => {
  const stamp = resumeStyleStamp(defaultResumeStyle)

  /*
    The column defaults are derived from the catalog rather than spelled out
    again, so this asserts the derivation reaches the table — a `.default()`
    dropped in a refactor would leave legacy rows with no style at all.
  */
  it("gives the resume columns the default style's own stamp", () => {
    expect(resume.style.default).toBe(stamp.style)
    expect(resume.accent.default).toBe(stamp.accent)
  })

  /*
    The migration is frozen SQL and cannot derive anything, so it is the one
    copy that can silently fall out of step: retune Standard's accent and every
    row written before the next migration carries a colour no style fixes.
    Drifting here means writing a migration, not editing this file.
  */
  it("matches the migration that added them", async () => {
    const sql = await readFile(
      join(process.cwd(), "migrations/0009_resume_style.sql"),
      "utf8"
    )

    expect(sql).toContain(`"style" text DEFAULT '${stamp.style}'`)
    expect(sql).toContain(`"accent" text DEFAULT '${stamp.accent}'`)
  })
})

describe("the style overlays", async () => {
  const css = await readFile(
    join(process.cwd(), "src/styles/global.css"),
    "utf8"
  )

  const overlay = (name: string) =>
    css.slice(css.indexOf(`.resume-style-${name} {`)).split("}")[0] ?? ""

  it.each(resumeStyles)(
    "%s re-values every axis a style is allowed to differ on",
    (name) => {
      const block = overlay(name)

      expect(block, `.resume-style-${name} is missing`).not.toBe("")

      // The five axes from the spec: the faces, the heading treatment, the
      // rule, the date column and one accent. A direction that leaves one of
      // them at the shared default is inheriting a decision rather than making
      // it — which is how three styles quietly become one with variations.
      for (const token of [
        "--resume-font-body",
        "--resume-text-base",
        "--resume-scale-ratio",
        "--resume-heading-weight",
        "--resume-heading-case",
        "--resume-rule-weight",
        "--resume-left-column-width",
        "--resume-date-align",
        "--resume-ink-accent"
      ]) {
        expect(block, `${name} does not set ${token}`).toContain(token)
      }
    }
  )

  it("draws each style with the accent it stamps onto a resume", () => {
    // The catalog copy is what a saved resume carries; the overlay copy is what
    // a resume that predates the choice is drawn with. Out of step, choosing a
    // style would visibly change the document.
    for (const name of resumeStyles) {
      expect(overlay(name)).toContain(
        `--resume-ink-accent: ${resumeStyleCatalog[name].accent}`
      )
    }
  })

  it("lets a style choose an accent and no other ink", () => {
    for (const name of resumeStyles) {
      const inks = [...overlay(name).matchAll(/--resume-ink-[a-z-]+/g)].map(
        ([token]) => token
      )

      // De-emphasis is the tempting exception — a greyer date column, a lighter
      // link — and it is exactly the one the spec forbids: hierarchy carried by
      // colour is hierarchy a photocopy loses. Size, weight and space are the
      // instruments; the accent is decoration and says nothing.
      expect([...new Set(inks)]).toEqual(["--resume-ink-accent"])
    }
  })

  it("lets no other token borrow the accent", () => {
    for (const name of resumeStyles) {
      // The ink-name scan above only sees `--resume-ink-*`, so an overlay could
      // point any *other* token at the accent and pass it — which is how the
      // strengths block came to be outlined in it. Colour that carries no
      // information can only be read by the name, the headings and the rules,
      // and those read it from the stylesheet's own component classes.
      const borrowed = [
        ...overlay(name).matchAll(
          /(--resume-[a-z-]+):\s*var\(--resume-ink-accent\)/g
        )
      ].map(([, token]) => token)

      expect(borrowed, `${name} routes the accent into another token`).toEqual(
        []
      )
    }
  })

  it("gives every style a greyscale-safe accent — no bright colour", () => {
    for (const name of resumeStyles) {
      const accent = /--resume-ink-accent:\s*(#[0-9a-f]{6})/i.exec(
        overlay(name)
      )?.[1]

      expect(accent, `${name} has no accent`).toBeDefined()

      const [red, green, blue] = [1, 3, 5].map((at) =>
        parseInt(accent!.slice(at, at + 2), 16)
      )

      // Photocopied in black and white the accent has to read as ink, so it is
      // held to the same contrast the body text is. Hierarchy is size and
      // weight; colour carries nothing, and a style that needs its accent to be
      // legible has failed this rather than earned an exception to it.
      const luminance = (0.299 * red! + 0.587 * green! + 0.114 * blue!) / 255

      expect(luminance, `${name}'s accent is too light on paper`).toBeLessThan(
        0.4
      )
    }
  })
})
