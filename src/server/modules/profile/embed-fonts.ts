import { readFile } from "node:fs/promises"
import { join } from "node:path"

/**
 * Fonts, embedded in the printed document rather than merely self-hosted.
 *
 * `renderResumePdf` inlines the compiled stylesheet into `page.setContent`,
 * which gives the page an `about:blank` origin. A compiled `@font-face` says
 * `url(../media/Geist-abc123.woff2)`, and against no origin that resolves
 * against nothing: the fetch fails, `font-display: swap` never swaps, and the
 * PDF prints in whatever system face Chromium falls back to. Self-hosting does
 * not help, because the print has no network and no base URL to be relative to.
 *
 * So the bytes travel with the CSS. Every font reference is read off the build
 * output and rewritten as a `data:` URI before the browser is handed anything.
 */

/** What counts as a font, and what MIME type its data URI carries. */
const fontMimeTypes: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf"
}

const fontExtensions = Object.keys(fontMimeTypes).join("|")

/**
 * `url(...)` in compiled CSS, quoted or not, pointing at a font file.
 *
 * Anchored on the extension rather than on `@font-face`, because a minified
 * stylesheet gives no reliable way to tell where one rule ends and the next
 * begins — and a `.woff2` is never anything but a font.
 */
const fontUrlPattern = new RegExp(
  `url\\(\\s*(['"]?)([^'")]+\\.(?:${fontExtensions}))\\1\\s*\\)`,
  "gi"
)

/**
 * Every distinct font file the stylesheet references, in the order it first
 * mentions them.
 *
 * Deduplicated: a variable family split across Latin and Latin Extended is two
 * files but several `@font-face` rules, and reading the same file once per rule
 * would be the difference between one disk read and a dozen.
 */
export function fontFileReferences(css: string) {
  const found = new Set<string>()

  for (const match of css.matchAll(fontUrlPattern)) {
    const url = match[2]

    // Already inline, or already carrying its own origin. Either way there is
    // nothing for this to fix.
    if (url && !/^(data:|https?:)/i.test(url)) found.add(url)
  }

  return [...found]
}

/**
 * The stylesheet with every font reference replaced by the file's bytes.
 *
 * `read` is injected so the rewrite can be tested without a build on disk, and
 * so the resolution rule — where a compiled URL maps to a real file — stays one
 * named thing rather than being spread through the substitution.
 *
 * A file that cannot be read leaves its reference untouched. The face will not
 * load, which is the situation this function exists to fix, but a stylesheet
 * missing one family still prints a document; throwing would print nothing.
 */
export async function inlineFontUrls(
  css: string,
  read: (url: string) => Promise<Buffer>
) {
  const inlined = new Map<string, string>()

  await Promise.all(
    fontFileReferences(css).map(async (url) => {
      try {
        inlined.set(url, dataUri(url, await read(url)))
      } catch {
        // Left as it was — see the doc comment.
      }
    })
  )

  if (!inlined.size) return css

  return css.replace(fontUrlPattern, (match, _quote, url: string) => {
    const uri = inlined.get(url)

    return uri ? `url(${uri})` : match
  })
}

function dataUri(url: string, bytes: Buffer) {
  const extension = url.split(".").pop()?.toLowerCase() ?? ""

  return `data:${fontMimeTypes[extension] ?? "font/woff2"};base64,${bytes.toString("base64")}`
}

/**
 * The two places a font a stylesheet references can be.
 *
 * `public/fonts` holds the document faces, which are declared as plain
 * `@font-face` rules and referenced as `/fonts/<name>`. `.next/static/media`
 * holds anything the build processed and rewrote — referenced from a stylesheet
 * as `../media/<name>` and from a chunk as `/_next/static/media/<name>`.
 *
 * Both forms end in the same file name, and a built name carries a content
 * hash, so matching on the name alone is unambiguous and does not depend on
 * which shape the build happened to emit.
 */
const fontRoots = [
  ["public", "fonts"],
  [".next", "static", "media"]
]

/** The bytes behind a compiled font URL, from wherever that file lives. */
export async function readBuiltFont(url: string) {
  const name = url.split("/").pop() ?? url

  for (const root of fontRoots) {
    try {
      return await readFile(
        /* turbopackIgnore: true */ join(process.cwd(), ...root, name)
      )
    } catch {
      // The next root, or the throw below.
    }
  }

  throw new Error(`No font file named ${name} under ${fontRoots.length} roots`)
}

/** The compiled stylesheet, ready to be handed to a page with no origin. */
export function embedFonts(css: string) {
  return inlineFontUrls(css, readBuiltFont)
}
