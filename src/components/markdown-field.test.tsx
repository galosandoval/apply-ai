import { NextIntlClientProvider } from "next-intl"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MarkdownField } from "~/components/markdown-field"
import messages from "../../messages/en.json"

/**
 * What the subset renders as is seam 1, in `resume-markdown.test.tsx`. This
 * only asserts the wiring the field adds on top of it: a blank value draws no
 * preview, a filled one draws through the same renderer, and the class name
 * lands on the preview rather than on the field itself.
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

describe("MarkdownField's preview", () => {
  it("draws nothing for a blank value", () => {
    expect(render("")).not.toContain('aria-label="Preview"')
  })

  it("draws nothing for a whitespace-only value", () => {
    expect(render("   \n  ")).not.toContain('aria-label="Preview"')
  })

  it("draws the same markup renderResumeMarkdown gives the resume", () => {
    const html = render("- **Shipped** the _migration_")

    expect(html).toContain('aria-label="Preview"')
    expect(html).toContain(
      "<li><strong>Shipped</strong> the <em>migration</em></li>"
    )
  })

  it("puts the class name on the preview, not the textarea", () => {
    const html = render("hello", "lg:hidden")

    expect(html.indexOf("lg:hidden")).toBeGreaterThan(
      html.indexOf('aria-label="Preview"')
    )
  })
})
