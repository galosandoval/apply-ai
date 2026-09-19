import { NextIntlClientProvider } from "next-intl"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MarkdownField } from "~/components/markdown-field"
import messages from "../../messages/en.json"

/**
 * Renders the field to static markup.
 *
 * What the markdown subset renders *as* is seam 1, asserted in
 * `resume-markdown.test.tsx`. This file only covers the wiring the field adds
 * on top of it, so the provider is here to satisfy `useTranslations` and
 * nothing more.
 */
const render = (value: string, previewClassName?: string) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <MarkdownField
        id="body"
        onChange={() => undefined}
        onCommit={() => undefined}
        previewClassName={previewClassName}
        value={value}
      />
    </NextIntlClientProvider>
  )

/**
 * The preview's opening tag, or `undefined` when it drew nothing.
 *
 * Asserting on this rather than on the whole document is what keeps
 * "the class landed on the preview" from also passing when the class landed
 * on the textarea and the preview merely happens to come first.
 */
const previewTag = (html: string) =>
  /<div[^>]*role="group"[^>]*>/.exec(html)?.[0]

describe("MarkdownField's preview", () => {
  it("draws nothing for a blank value", () => {
    expect(previewTag(render(""))).toBeUndefined()
  })

  it("draws nothing for a whitespace-only value", () => {
    expect(previewTag(render("   \n  "))).toBeUndefined()
  })

  it("draws the same markup renderResumeMarkdown gives the resume", () => {
    const html = render("- **Shipped** the _migration_")

    expect(previewTag(html)).toBeDefined()
    expect(html).toContain(
      "<li><strong>Shipped</strong> the <em>migration</em></li>"
    )
  })

  it("names the preview, so the label reaches a screen reader", () => {
    expect(previewTag(render("hello"))).toContain('aria-label="Preview"')
  })

  it("puts the class name on the preview, not the textarea", () => {
    const html = render("hello", "lg:hidden")

    expect(previewTag(html)).toContain("lg:hidden")
    expect(/<textarea[^>]*>/.exec(html)?.[0]).not.toContain("lg:hidden")
  })
})
