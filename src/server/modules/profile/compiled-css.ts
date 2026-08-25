import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { embedFonts } from "./embed-fonts"

/**
 * The app's compiled Tailwind, read off the built stylesheet with its faces
 * embedded.
 *
 * Hand-maintaining a copy of the utilities the template uses is how the two
 * drift; this reads whatever the build emitted. Next writes its CSS chunks
 * under `.next/static`, in dev and in a production build alike.
 *
 * It lives in its own module because the PDF route and the test that drives the
 * same page both need it, and two copies of a path list and a `turbopackIgnore`
 * comment are two things that can disagree about what the print reads.
 */

let cachedCss: string | null = null

/** The built stylesheet, or `null` when the project has not been built. */
export async function findCompiledCss() {
  // Only cached in production: in dev the chunk list changes as you edit.
  if (cachedCss !== null && process.env.NODE_ENV === "production") {
    return cachedCss
  }

  // Read at runtime from the build output, not bundled — the bundler has no
  // way to know what the build will emit. The `turbopackIgnore` comments below
  // sit on the path each `fs` call resolves: without them Turbopack sees an
  // unanalyzable path and traces the entire project into the server bundle.
  const staticRoot = join(process.cwd(), ".next", "static")

  const roots = [join(staticRoot, "css"), join(staticRoot, "chunks")]

  const sheets: string[] = []

  for (const root of roots) {
    let entries: string[]

    try {
      entries = await readdir(/* turbopackIgnore: true */ root)
    } catch {
      continue
    }

    for (const entry of entries.filter((name) => name.endsWith(".css"))) {
      sheets.push(
        await readFile(join(/* turbopackIgnore: true */ root, entry), "utf8")
      )
    }
  }

  if (!sheets.length) return null

  // Fonts are embedded before the sheet is cached, so the expensive part —
  // reading and base64-encoding half a megabyte of variable fonts — happens
  // once per process rather than once per print.
  cachedCss = await embedFonts(sheets.join("\n"))

  return cachedCss
}

/** The same sheet, for the callers that have nothing to print without one. */
export async function readCompiledCss() {
  const css = await findCompiledCss()

  if (!css) {
    throw new Error(
      "No compiled stylesheet under .next/static — run `next build` (or load a page in dev) before printing a PDF."
    )
  }

  return css
}
