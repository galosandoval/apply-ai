import { type ReactElement } from "react"
import {
  ResumeDocument,
  type ResumeDocumentData
} from "~/components/resume-document"
import { type RenderMode } from "~/components/resume-section"

/**
 * Loaded through a non-literal specifier on purpose.
 *
 * `react-dom/server` is a static import error inside the App Router's server
 * graph — the rule exists to stop components rendering themselves to strings.
 * A route handler printing a PDF is exactly the case the rule doesn't mean, and
 * this is the only way to say so.
 */
const reactDomServer = "react-dom/server"

type ReactDomServer = {
  renderToStaticMarkup: (element: ReactElement) => string
}

async function renderToStaticMarkup(element: ReactElement) {
  const { renderToStaticMarkup: render } = (await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ reactDomServer
  )) as ReactDomServer

  return render(element)
}

/**
 * The resume as a markup string — seam 3.
 *
 * One pure function behind the PDF, the preview and (later) the parseability
 * check, rendering the same component the editor renders — so what a user sees,
 * what gets printed and what a parser reads cannot drift apart.
 *
 * The default is the read-only A4 document: plain tags, no inputs, no
 * placeholders. `mode` picks the page or the phone over the same data, and
 * `isEditor` is what makes an empty section a visible placeholder rather than
 * nothing at all.
 */
export async function renderResumeHtml(
  data: ResumeDocumentData,
  {
    mode = "page",
    isEditor = false
  }: { mode?: RenderMode; isEditor?: boolean } = {}
) {
  return await renderToStaticMarkup(
    <ResumeDocument data={data} isEditor={isEditor} mode={mode} />
  )
}

/**
 * The full document handed to `page.setContent`.
 *
 * `css` is inlined rather than linked: the print has no network and no origin,
 * which is the whole reason the PDF no longer needs the app to be able to reach
 * its own public URL. That same lack of an origin is why the faces have to be
 * embedded in it — see `embed-fonts.ts`.
 *
 * The faces need nothing here: they are `@font-face` rules and `:root`
 * variables in the same stylesheet, which is exactly why they are declared
 * that way rather than through `next/font`.
 */
export async function resumePdfDocument(data: ResumeDocumentData, css: string) {
  const body = await renderResumeHtml(data)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>${css}</style>
<style>
  /* The page is the paper. Margins come from page.pdf, not from the body. */
  html, body { margin: 0; padding: 0; background: #fff; }
</style>
</head>
<body>${body}</body>
</html>`
}
