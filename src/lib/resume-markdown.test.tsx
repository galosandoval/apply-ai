import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  applyMarkdownAction,
  type MarkdownDraft,
  renderResumeMarkdown,
  stripMarkdown,
  toBulletedMarkdown
} from "./resume-markdown"

/**
 * Seam 1 — the markdown subset, as pure functions.
 *
 * Rich text is a markdown string in a constrained subset: bold, links and
 * bullet lists, and nothing else. Three questions are asked here because all
 * three are answered by pure code: what the subset renders as, what it strips
 * to for a parser, and what the toolbar buttons do to the text around a caret.
 *
 * Rendering is asserted as a markup string rather than through a DOM — the
 * render function is what the document and the PDF both call, so the string is
 * exactly what a reader of either would get.
 */

const render = (markdown: string) =>
  renderToStaticMarkup(
    <div>{renderResumeMarkdown(markdown).map((block) => block.node)}</div>
  )

/** The kinds the blocks came back as, in order. */
const kinds = (markdown: string) =>
  renderResumeMarkdown(markdown).map((block) => block.kind)

describe("renderResumeMarkdown", () => {
  it("renders a paragraph", () => {
    expect(render("Just a line.")).toContain("<p>Just a line.</p>")
  })

  it("renders bold", () => {
    expect(render("A **bold** word")).toContain(
      "<p>A <strong>bold</strong> word</p>"
    )
  })

  it("keeps two bold runs on a line apart", () => {
    const html = render("**one** and **two**")

    // The text between them stays outside both, rather than one greedy run
    // swallowing it.
    expect(html).toBe(
      "<div><p><strong>one</strong> and <strong>two</strong></p></div>"
    )
  })

  it("renders a link", () => {
    expect(render("See [my site](https://ada.dev) for more")).toContain(
      '<a class="underline" href="https://ada.dev" rel="noreferrer" target="_blank">my site</a>'
    )
  })

  /**
   * One `<ul>` per item, where a list used to be one element holding all of
   * them.
   *
   * The replacement is deliberate and would otherwise read as a regression: an
   * element cannot be in two places, and a body of nine bullets splitting
   * across a page boundary asks exactly that of it. Each item is still a real
   * list item inside a real list, which is what a parser reads.
   */
  it("renders each bullet as its own list", () => {
    const html = render("- first\n- second")

    expect(html).toContain(">first</li>")
    expect(html).toContain(">second</li>")
    expect(html.match(/<ul/g)).toHaveLength(2)
  })

  it("gives a block per bullet and a block per paragraph", () => {
    expect(kinds("Intro\n\n- first\n- second\n- third")).toEqual([
      "paragraph",
      "bullet",
      "bullet",
      "bullet"
    ])
  })

  it("separates a paragraph from the list that follows it", () => {
    const html = render("Intro line\n- first\n- second")

    expect(html).toContain("<p>Intro line</p>")
    expect(html.indexOf("<p>")).toBeLessThan(html.indexOf("<ul"))
  })

  it("reopens a paragraph after a list", () => {
    expect(kinds("- first\nAfter the list")).toEqual(["bullet", "paragraph"])
  })

  it("joins wrapped lines into one paragraph and splits on a blank line", () => {
    const html = render("one\ntwo\n\nthree")

    expect(html).toContain("<p>one two</p>")
    expect(html).toContain("<p>three</p>")
  })

  /**
   * The value stored is exactly what was typed, so anything outside the subset
   * has to reach the page as text. It is rendered as text and never as HTML, so
   * React escapes it — this asserts that nothing bypasses that.
   */
  describe("everything outside the subset", () => {
    it("escapes markup rather than emitting it", () => {
      const html = render("<script>alert(1)</script>")

      expect(html).not.toContain("<script>")
      expect(html).toContain("&lt;script&gt;")
    })

    it("leaves headings, italics and code as literal text", () => {
      const html = render("# Heading _italic_ `code`")

      expect(html).toContain("<p># Heading _italic_ `code`</p>")
      expect(html).not.toContain("<h1")
      expect(html).not.toContain("<em")
      expect(html).not.toContain("<code")
    })

    it("refuses a link scheme that is not a link, keeping the sentence", () => {
      const html = render("Click [here](javascript:alert(1)) now")

      expect(html).not.toContain("javascript:")
      expect(html).toContain("Click ")
      expect(html).toContain("here")
      expect(html).toContain(" now")
    })

    it("keeps a relative target out of an href", () => {
      expect(render("[docs](/secret)")).not.toContain("href=")
    })
  })

  describe("malformed markup", () => {
    it.each([
      ["an unclosed bold run", "A **bold word"],
      ["an unopened bold run", "A bold** word"],
      ["a link with no target", "A [label]() here"],
      ["a link with no label", "A []() here"],
      ["an empty bold run", "A **** here"],
      ["a bullet with nothing after it", "-\n- real"],
      ["nothing at all", ""],
      ["only whitespace", "   \n\n  "]
    ])("does not produce broken output for %s", (_name, markdown) => {
      const html = render(markdown)

      expect(html).not.toContain("undefined")
      expect(html).not.toContain("NaN")
      expect(html.startsWith("<div>")).toBe(true)
      expect(html.endsWith("</div>")).toBe(true)
    })

    it("leaves an unclosed bold run as the text it was typed as", () => {
      expect(render("A **bold word")).toContain("<p>A **bold word</p>")
    })
  })
})

/**
 * What the scoring work will match against: the sentence, without the markup
 * that made it readable.
 */
describe("stripMarkdown", () => {
  it.each([
    ["bold", "A **bold** word", "A bold word"],
    [
      "a link, keeping the label",
      "See [my site](https://ada.dev)",
      "See my site"
    ],
    ["a bullet marker", "- first\n- second", "first\nsecond"],
    ["nested markup", "- **Shipped** [it](https://ada.dev)", "Shipped it"],
    ["nothing to strip", "Plain sentence.", "Plain sentence."],
    ["an empty string", "", ""]
  ])("strips %s", (_name, markdown, expected) => {
    expect(stripMarkdown(markdown)).toBe(expected)
  })

  it("keeps the text of a link whose target was refused", () => {
    expect(stripMarkdown("Click [here](javascript:alert)")).toBe("Click here")
  })

  it("keeps paragraph breaks", () => {
    expect(stripMarkdown("one\n\ntwo")).toBe("one\n\ntwo")
  })
})

/**
 * The toolbar buttons, as text operations.
 *
 * A phone keyboard is a bad place to type asterisks, so the buttons are not
 * optional — which makes what they do to a caret a thing worth pinning down.
 * Every operation returns the new text and where the selection now sits, so the
 * caller can put the caret back.
 */
describe("applyMarkdownAction", () => {
  /** `text`, with `|` marking the caret or `[…]` marking a selection. */
  function draft(marked: string): MarkdownDraft {
    if (marked.includes("|")) {
      const start = marked.indexOf("|")

      return { text: marked.replace("|", ""), start, end: start }
    }

    const start = marked.indexOf("[")
    const end = marked.indexOf("]") - 1

    return { text: marked.replace("[", "").replace("]", ""), start, end }
  }

  /** The result, marked the same way, so the caret is part of the assertion. */
  function mark({ text, start, end }: MarkdownDraft) {
    return start === end
      ? `${text.slice(0, start)}|${text.slice(start)}`
      : `${text.slice(0, start)}[${text.slice(start, end)}]${text.slice(end)}`
  }

  describe("bold", () => {
    it("wraps the selection", () => {
      expect(mark(applyMarkdownAction("bold", draft("a [word] here")))).toBe(
        "a **[word]** here"
      )
    })

    it("unwraps a selection that is already bold", () => {
      expect(
        mark(applyMarkdownAction("bold", draft("a **[word]** here")))
      ).toBe("a [word] here")
    })

    it("opens an empty pair with the caret inside it", () => {
      expect(mark(applyMarkdownAction("bold", draft("a |here")))).toBe(
        "a **|**here"
      )
    })
  })

  describe("link", () => {
    it("makes the selection the label and selects the target to type over", () => {
      expect(
        mark(applyMarkdownAction("link", draft("see [my site] now")))
      ).toBe("see [my site]([https://]) now")
    })

    it("writes a label to replace when there is no selection", () => {
      expect(mark(applyMarkdownAction("link", draft("see | now")))).toBe(
        "see [[link]](https://) now"
      )
    })
  })

  describe("bulletList", () => {
    it("prefixes every selected line", () => {
      expect(mark(applyMarkdownAction("bulletList", draft("[one\ntwo]")))).toBe(
        "[- one\n- two]"
      )
    })

    it("prefixes the caret's line when nothing is selected", () => {
      expect(mark(applyMarkdownAction("bulletList", draft("on|e")))).toBe(
        "- on|e"
      )
    })

    it("removes the prefix when every selected line already has one", () => {
      expect(
        mark(applyMarkdownAction("bulletList", draft("[- one\n- two]")))
      ).toBe("[one\ntwo]")
    })

    it("leaves a blank line unbulleted", () => {
      expect(
        applyMarkdownAction("bulletList", draft("[one\n\ntwo]")).text
      ).toBe("- one\n\n- two")
    })
  })

  /** Every operation is its own inverse, so nothing accumulates markup. */
  it.each([
    ["bold", "a [word] here"],
    ["bulletList", "[one\ntwo]"]
  ] as const)(
    "round-trips %s back to the text it started as",
    (action, marked) => {
      const start = draft(marked)
      const there = applyMarkdownAction(action, start)

      expect(applyMarkdownAction(action, there)).toEqual(start)
    }
  )
})

describe("toBulletedMarkdown", () => {
  it("marks every filled line as a bullet", () => {
    expect(toBulletedMarkdown("Shipped it\nThen shipped more")).toBe(
      "- Shipped it\n- Then shipped more"
    )
  })

  it("leaves a line that is already a bullet alone", () => {
    expect(toBulletedMarkdown("- Shipped it\n* Or this way")).toBe(
      "- Shipped it\n* Or this way"
    )
  })

  it("drops blank lines rather than marking them", () => {
    expect(toBulletedMarkdown("Shipped it\n\n   \nAnd again")).toBe(
      "- Shipped it\n- And again"
    )
  })
})
