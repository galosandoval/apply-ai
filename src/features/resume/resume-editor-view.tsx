"use client"

import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { ResumeDocument } from "~/components/resume-document"
import { type RenderMode } from "~/components/resume-section"
import { Button } from "~/components/ui/button"
import { useResumeRenderMode } from "~/components/use-resume-render-mode"
import {
  type ResumeStyle,
  resumeStyleCatalog,
  resumeStyleClass,
  resumeStyleStamp,
  resumeStyles
} from "~/lib/resume-style"
import { type DownloadPdfSchema } from "~/server/db/crud-schema"
import { ResumePanel } from "~/features/resume/resume-panel"
import { toDocumentData } from "~/features/resume/resume-field-lens"
import {
  type SaveState,
  useResumeEditor
} from "~/features/resume/use-resume-editor"

/**
 * The resume editor: a document you select things in, and a panel that edits
 * what you selected.
 *
 * Inline editing is gone. Click-to-swap needed the A4 page at full size, which
 * a phone does not have — so on a phone the panel is the whole screen and the
 * document moves behind a tab, and on a desktop the two sit side by side with
 * the document as a live preview.
 */
export function ResumeEditorView() {
  const params = useParams<{ id: string }>()

  return <Editor resumeId={params?.id ?? ""} />
}

/** Which half of the screen a phone is showing. Desktop shows both. */
type Pane = "edit" | "document"

function Editor({ resumeId }: { resumeId: string }) {
  const editor = useResumeEditor(resumeId)
  const { mode } = useResumeRenderMode()
  const [pane, setPane] = useState<Pane>("edit")

  if (editor.errorMessage) {
    return (
      <main className="grid h-full place-items-center">
        {editor.errorMessage}
      </main>
    )
  }

  if (!editor.resume || !editor.panel) {
    return <main className="grid h-full place-items-center">Loading...</main>
  }

  return (
    <main className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-2">
        <PaneTabs pane={pane} setPane={setPane} />

        <div className="flex items-center gap-3">
          <StylePicker
            onChange={editor.onStyleChange}
            onPreview={editor.onStylePreview}
            preview={editor.previewStyle}
            style={editor.style}
          />
          <SaveStatus state={editor.saveState} />
          <PdfPreviewButton resume={toDocumentData(editor.resume)} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(20rem,26rem)_1fr]">
        <div
          className={`min-h-0 overflow-y-auto p-4 lg:block ${
            pane === "edit" ? "flex-1" : "hidden"
          }`}
        >
          {/*
            With nothing selected the panel is the resume itself, which is what
            owns its sections — so that is where a section is added, and
            `onBack` is how the user gets there from anything else.
          */}
          <ResumePanel
            onAddSection={editor.selected ? undefined : editor.addSection}
            onBack={editor.selected ? editor.onClearSelection : undefined}
            onChange={editor.onFieldChange}
            onCommit={editor.onFieldCommit}
            panel={editor.panel}
          />
        </div>

        {/*
          Clicking past the document clears the selection. Every selectable
          thing stops its own click, so what reaches here is the space around
          them — which is the one gesture that means "nothing in particular".
        */}
        <div
          className={`min-h-0 justify-center overflow-auto bg-neutral-100 p-4 lg:flex ${
            pane === "document" ? "flex flex-1" : "hidden"
          }`}
          onClick={editor.onClearSelection}
        >
          <PageBoundary mode={mode} style={editor.previewStyle ?? editor.style}>
            {/*
              The previewed direction is stamped over the saved one for as long
              as the pointer is on its button — and only here. The PDF above
              prints what is stored, so a hover cannot leak into a download.
            */}
            <ResumeDocument
              data={{
                ...toDocumentData(editor.resume),
                ...(editor.previewStyle
                  ? resumeStyleStamp(editor.previewStyle)
                  : null)
              }}
              isEditor
              mode={mode}
              selection={{
                selected: editor.selected,
                onSelect: editor.onSelect
              }}
            />
          </PageBoundary>
        </div>
      </div>
    </main>
  )
}

/**
 * The page boundary, drawn over the document.
 *
 * The document no longer clips at one page, which means overflow is silent
 * rather than destructive. This is where it becomes something the user can see
 * before they send it rather than after.
 *
 * Page mode only: reflow is not a page, so a rule at every page height through
 * it would mark a boundary that does not exist. Judging the print on a phone is
 * what the PDF preview is for.
 *
 * The rule itself is `.resume-page-rule` in `global.css`, reading the page
 * height as a token rather than holding its own copy of A4. The overlay is a
 * sibling of the document rather than a descendant, so it carries the style
 * class too: a `var()` resolves on the element it is written on, and without it
 * a style that re-valued the height would move the page and not the mark.
 */
function PageBoundary({
  children,
  mode,
  style
}: {
  children: React.ReactNode
  mode: RenderMode
  style: ResumeStyle
}) {
  return (
    <div className="relative h-fit">
      {children}

      {mode === "page" && (
        <div
          aria-hidden
          className={`resume-page-rule ${resumeStyleClass(style)} pointer-events-none absolute inset-0`}
        />
      )}
    </div>
  )
}

/**
 * The three typographic directions, as three buttons that preview before they
 * commit.
 *
 * Pointing at one — or tabbing to it — redraws the document beside it in that
 * direction, and leaving puts it back; only a click persists. So what a user
 * compares is their own dense work history on a real page rather than a
 * thumbnail of someone else's, and the choice is not already saved by the time
 * they can see it. No thumbnails and no modal for the same reason: a style a
 * user cannot picture against their own content is a style they are guessing
 * at.
 *
 * On a touch screen there is no hover, so a tap chooses directly — the document
 * still redraws immediately, which is the fallback the desktop path improves on
 * rather than replaces.
 */
function StylePicker({
  style,
  preview,
  onPreview,
  onChange
}: {
  style: ResumeStyle
  preview: ResumeStyle | null
  onPreview: (style: ResumeStyle | null) => void
  onChange: (style: ResumeStyle) => void
}) {
  const showing = preview ?? style

  return (
    <div
      aria-label="Resume style"
      className="flex items-center gap-1 rounded-md border border-neutral-200 p-0.5"
      onMouseLeave={() => onPreview(null)}
      role="radiogroup"
    >
      {resumeStyles.map((name) => {
        const { label, register } = resumeStyleCatalog[name]
        const isChosen = name === style

        return (
          <button
            aria-checked={isChosen}
            className={`rounded px-2 py-1 text-sm transition-colors ${chipClassName(
              isChosen,
              name === showing
            )}`}
            key={name}
            onBlur={() => onPreview(null)}
            onClick={() => onChange(name)}
            onFocus={() => onPreview(name)}
            onMouseEnter={() => onPreview(name)}
            role="radio"
            title={`${register} — hover to preview`}
            type="button"
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Chosen reads as solid; merely previewed reads as filled but not committed, so
 * the button under the pointer never claims to be the saved one.
 */
function chipClassName(isChosen: boolean, isShowing: boolean) {
  if (isChosen) return "bg-neutral-900 text-white"

  return isShowing
    ? "bg-neutral-200 text-neutral-900"
    : "text-neutral-600 hover:bg-neutral-100"
}

/**
 * Editing and reading, on a phone.
 *
 * The document tab shows the reflowed render, not a scaled-down page: A4 inside
 * a 390px viewport renders body text at roughly 5pt. Judging the page is what
 * the PDF preview is for.
 */
function PaneTabs({
  pane,
  setPane
}: {
  pane: Pane
  setPane: (pane: Pane) => void
}) {
  return (
    <div className="flex gap-1 lg:hidden">
      {(["edit", "document"] as const).map((value) => (
        <Button
          key={value}
          onClick={() => setPane(value)}
          size="sm"
          type="button"
          variant={pane === value ? "default" : "outline"}
        >
          {value === "edit" ? "Edit" : "Resume"}
        </Button>
      ))}
    </div>
  )
}

const saveMessages: Record<SaveState, string> = {
  idle: "Changes save automatically",
  saving: "Saving…",
  saved: "Saved",
  failed: "Could not save"
}

/** Autosave without feedback is indistinguishable from data loss. */
function SaveStatus({ state }: { state: SaveState }) {
  return (
    <p
      className={`text-sm ${
        state === "failed" ? "text-destructive" : "text-neutral-500"
      }`}
      role="status"
    >
      {saveMessages[state]}
    </p>
  )
}

/**
 * The document as it will actually print.
 *
 * Reflow is for proofreading; this is for judging layout — which is a thing you
 * do before sending, on whatever device you have.
 */
function PdfPreviewButton({ resume }: { resume: DownloadPdfSchema }) {
  const [isRendering, setIsRendering] = useState(false)

  /*
    The URL the open tab is reading from. It cannot be revoked as soon as the
    tab is opened — the tab has not fetched it yet — so each preview releases
    the one before it, and the last one goes when the editor does.
  */
  const openUrl = useRef<string | null>(null)

  const release = () => {
    if (!openUrl.current) return

    window.URL.revokeObjectURL(openUrl.current)
    openUrl.current = null
  }

  useEffect(() => release, [])

  const preview = async () => {
    setIsRendering(true)

    try {
      const response = await fetch("/api/resume/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resume)
      })

      if (!response.ok) throw new Error(await response.text())

      release()
      openUrl.current = window.URL.createObjectURL(await response.blob())

      window.open(openUrl.current, "_blank", "noreferrer")
    } catch (error) {
      console.error(error)
      toast.error("Could not render the PDF.")
    } finally {
      setIsRendering(false)
    }
  }

  return (
    <Button
      loading={isRendering}
      onClick={preview}
      size="sm"
      type="button"
      variant="secondary"
    >
      Preview PDF
    </Button>
  )
}
