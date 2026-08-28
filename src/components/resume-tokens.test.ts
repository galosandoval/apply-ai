import { readdir, readFile } from "node:fs/promises"
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
    // The whitespace is inside the lookahead, not before it: `\s*` outside can
    // match nothing, so the sanctioned `style={{ "--resume-…" }}` matched on
    // the space Prettier puts there and the one allowed escape was unusable.
    pattern: /style=\{\{(?!\s*"--resume)/
  }
]

/**
 * The file's lines with every comment blanked out, line numbering intact.
 *
 * These files explain themselves at length, and an explanation of why a value
 * is not held here is apt to name the value — the comment about why the page no
 * longer clips at A4 is written the way it is to avoid exactly that. A prose
 * mention of a value is the opposite of holding one, and should not fail.
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

  it("gives every style a mark to open a skills category with", () => {
    for (const name of resumeStyles) {
      const weight = /--resume-group-mark-weight:\s*([^;]+);/.exec(
        overlay(name)
      )?.[1]

      expect(weight, `${name} sets no category mark`).toBeDefined()

      // Modern draws no rules, and inheriting the rule weight here left its
      // categories indented by a mark that was not there. A mark is the bullet
      // of a group rather than a division of the page, so every style draws
      // one — which is a weight none of them may leave at zero.
      expect(weight, `${name} draws no category mark`).not.toMatch(/^0[a-z]*$/)
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

describe("the page geometry", async () => {
  const css = await readFile(
    join(process.cwd(), "src/styles/global.css"),
    "utf8"
  )

  /**
   * A rule's body, given the offset of its opening brace.
   *
   * A rule body has no nested braces in this stylesheet, so the next `}` is its
   * own — which is the whole parser this needs.
   */
  function bodyAt(opens: number) {
    return opens === -1 ? "" : css.slice(opens + 1, css.indexOf("}", opens))
  }

  /** Where a token is declared: the selector it sits under and that rule's body. */
  function declarationSite(token: string) {
    const at = css.indexOf(`${token}:`)

    if (at === -1) return { selector: "", body: "" }

    const opens = css.lastIndexOf("{", at)

    return {
      selector: (css.slice(0, opens).trimEnd().split("\n").pop() ?? "").trim(),
      body: bodyAt(opens)
    }
  }

  /** A rule body, found by its selector rather than by a token inside it. */
  function bodyForSelector(selector: string) {
    const at = css.indexOf(`${selector} {`)

    return at === -1 ? "" : bodyAt(css.indexOf("{", at))
  }

  /** What a token is set to, in the rule that declares it. */
  function declaredValue(token: string) {
    return new RegExp(`${token}:\\s*([^;]+);`)
      .exec(declarationSite(token).body)?.[1]
      ?.replace(/\s+/g, " ")
  }

  /*
    A page has two dimensions and sheets have space between them. Only the width
    was ever a token, because only the width was ever drawn — the height lived in
    the editor's boundary rule and the gap did not exist. Both are style
    decisions the moment a document is a stack of pages rather than one sheet.
  */
  it("names the page's height and the gap between sheets beside its width", () => {
    const geometry = declarationSite("--resume-page-width").body

    expect(geometry).toContain("--resume-page-height")
    expect(geometry).toContain("--resume-page-gap")
  })

  it("holds the A4 height in that token and nowhere else in the stylesheet", () => {
    expect(declaredValue("--resume-page-height")).toBe("29.7cm")
    expect(css.match(/29\.7cm/g)).toHaveLength(1)
  })

  /*
    Pagination is handed a number and asked where the breaks go. Restated by
    hand it would be a number that disagrees with the padding the page is
    actually drawn with, and the disagreement would show up as a line of text
    cut in half rather than as a failing test.
  */
  it("derives the height a page can hold from the page and its padding", () => {
    expect(declarationSite("--resume-page-content-height").selector).toBe(
      ".resume-document"
    )

    const derived = declaredValue("--resume-page-content-height") ?? ""

    expect(derived).toContain("var(--resume-page-height)")
    expect(derived).toContain("var(--resume-space-page-y)")
  })

  /*
    A sheet is a page element now, so the two facts that make a stack of them
    read as paper are CSS rather than markup: the space between sheets, and its
    absence in print. Held here because both are geometry the styles own — a
    component that spelt either out would be a document the overlays cannot
    respace and a print that keeps a gap that has nothing to show.
  */
  it("puts the gap between sheets on the page element, from the token", () => {
    const sheet = bodyForSelector(".resume-page-sheet:not(:last-child)")

    expect(sheet, "the between-sheets rule is missing").not.toBe("")
    expect(sheet).toContain("var(--resume-page-gap)")
  })

  it("ends each sheet but the last with a forced break, and no gap in print", () => {
    expect(bodyForSelector(".resume-page-sheet:not(:last-child)")).toContain(
      "break-after: page"
    )

    // The gap is the app's background between two pieces of paper. On paper
    // the sheets are already separate, so what would be left is a margin the
    // print has to find room for — which is a third page for two pages of
    // content.
    const printed =
      /@media print \{\s*\.resume-page-sheet:not\(:last-child\) \{([^}]*)\}/.exec(
        css
      )?.[1] ?? ""

    expect(printed, "the between-sheets rule has no print value").not.toBe("")
    expect(printed).toContain("margin-bottom: 0")
  })

  /*
    Both between-sheets rules stop short of the last sheet. A trailing margin is
    a gap below nothing, and a trailing forced break is the blank final page
    Chromium prints for it — a two-page resume that comes out three pages long.
  */
  it("leaves the last sheet no trailing gap and no trailing break", () => {
    const every = bodyForSelector(".resume-page-sheet")

    expect(every, ".resume-page-sheet is missing").not.toBe("")
    expect(every).not.toContain("margin-bottom")
    expect(every).not.toContain("break-after")
  })

  /*
    A sheet is positioned so the stack can be ordered in reverse — see `Sheet`.
    Without it a block too tall for its page paints under the next sheet's
    background, which is the clipping the document is built not to do, arrived
    at by paint order rather than by `overflow-hidden`.
  */
  it("positions a sheet so an overflow can paint over the page below", () => {
    const sheet = bodyForSelector(".resume-page-sheet")

    expect(sheet).toContain("position: relative")
    expect(sheet).toContain("var(--resume-page-order")
  })

  it("leaves no A4 literal in any component", async () => {
    const paths = (
      await readdir(join(process.cwd(), "src"), {
        recursive: true
      })
    )
      .filter(
        (path) =>
          /\.tsx?$/.test(path) &&
          !/\.test\.tsx?$/.test(path) &&
          // `src/generated` is compiled output, not a component. The print
          // stylesheet resolves the token, so of course the height is in it.
          !/^generated[\\/]/.test(path)
      )
      .map((path) => join("src", path))

    const offenders: string[] = []

    for (const path of paths) {
      const source = await readFile(join(process.cwd(), path), "utf8")

      codeLines(source).forEach((line, index) => {
        if (line.includes("29.7cm")) {
          offenders.push(`${path}:${index + 1}  ${line.trim()}`)
        }
      })
    }

    expect(offenders).toEqual([])
  })
})
