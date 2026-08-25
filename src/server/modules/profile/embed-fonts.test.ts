import { describe, expect, it, vi } from "vitest"
import { embedFonts, fontFileReferences, inlineFontUrls } from "./embed-fonts"

/**
 * The compiled stylesheet is inlined into an `about:blank` page, so every
 * relative `url(...)` in it resolves against nothing and the face silently
 * fails to load. These are the assertions that the rewrite happens before the
 * browser ever sees the CSS.
 */

const face = (url: string) =>
  `@font-face{font-family:x;src:url(${url}) format('woff2')}`

describe("fontFileReferences", () => {
  it("finds a relative reference emitted into a CSS chunk", () => {
    expect(fontFileReferences(face("../media/Geist-abc123.woff2"))).toEqual([
      "../media/Geist-abc123.woff2"
    ])
  })

  it("finds an absolute reference emitted into a stylesheet", () => {
    expect(
      fontFileReferences(face("/_next/static/media/Manrope-def456.woff2"))
    ).toEqual(["/_next/static/media/Manrope-def456.woff2"])
  })

  it("finds a reference to a face served straight out of public/", () => {
    expect(fontFileReferences(face("/fonts/Geist-Variable.woff2"))).toEqual([
      "/fonts/Geist-Variable.woff2"
    ])
  })

  it("finds quoted references", () => {
    const css = `${face('"../media/a.woff2"')}${face("'../media/b.woff2'")}`

    expect(fontFileReferences(css)).toEqual([
      "../media/a.woff2",
      "../media/b.woff2"
    ])
  })

  it("ignores anything that is not a font file", () => {
    const css = `.a{background:url(../media/hero.png)}${face(
      "../media/a.woff2"
    )}`

    expect(fontFileReferences(css)).toEqual(["../media/a.woff2"])
  })

  it("ignores a reference that already has no origin to resolve", () => {
    expect(fontFileReferences(face("data:font/woff2;base64,AAA"))).toEqual([])
  })

  it("lists each file once however many faces reference it", () => {
    const css = `${face("../media/a.woff2")}${face("../media/a.woff2")}`

    expect(fontFileReferences(css)).toEqual(["../media/a.woff2"])
  })
})

describe("inlineFontUrls", () => {
  it("rewrites a reference as a data URI the print carries with it", async () => {
    const css = await inlineFontUrls(face("../media/a.woff2"), async () =>
      Buffer.from("FONTBYTES")
    )

    expect(css).toContain(
      `url(data:font/woff2;base64,${Buffer.from("FONTBYTES").toString(
        "base64"
      )})`
    )
    expect(css).not.toContain("../media/a.woff2")
  })

  it("reads each file once however many faces reference it", async () => {
    const read = vi.fn(async () => Buffer.from("FONTBYTES"))

    await inlineFontUrls(
      `${face("../media/a.woff2")}${face("../media/a.woff2")}`,
      read
    )

    expect(read).toHaveBeenCalledTimes(1)
  })

  it("rewrites quoted references too", async () => {
    const css = await inlineFontUrls(face('"../media/a.woff2"'), async () =>
      Buffer.from("F")
    )

    expect(css).toContain("url(data:font/woff2;base64,Rg==)")
  })

  it("leaves a reference alone when the file cannot be read", async () => {
    const css = await inlineFontUrls(face("../media/missing.woff2"), async () =>
      Promise.reject(new Error("ENOENT"))
    )

    expect(css).toContain("../media/missing.woff2")
  })

  it("carries the right MIME type for each format", async () => {
    const css = await inlineFontUrls(
      `${face("../media/a.woff")}${face("../media/b.ttf")}`,
      async () => Buffer.from("F")
    )

    expect(css).toContain("url(data:font/woff;base64,Rg==)")
    expect(css).toContain("url(data:font/ttf;base64,Rg==)")
  })
})

describe("embedFonts", () => {
  it("resolves the document faces out of public/ and inlines them", async () => {
    // The one that matters end to end: these are the faces the resume styles
    // draw with, and this is the path the printed document takes to reach them.
    const css = await embedFonts(
      `${face("/fonts/Geist-Variable.woff2")}${face(
        "/fonts/SourceSerif4-latin.woff2"
      )}${face("/fonts/Manrope-latin.woff2")}`
    )

    expect(css).not.toContain("/fonts/")
    expect(css.match(/url\(data:font\/woff2;base64,/g)).toHaveLength(3)
  })

  it("leaves a face it cannot find alone rather than failing the print", async () => {
    const css = await embedFonts(face("/fonts/NotAFace.woff2"))

    expect(css).toContain("/fonts/NotAFace.woff2")
  })
})
