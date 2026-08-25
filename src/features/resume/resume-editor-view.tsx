"use client"

import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { ResumeDocument } from "~/components/resume-document"
import { Button } from "~/components/ui/button"
import { type RenderMode } from "~/components/resume-section"
import { useResumeRenderMode } from "~/components/use-resume-render-mode"
import {
  type ResumeStyle,
  resumeStyleCatalog,
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
          <StylePicker onChange={editor.onStyleChange} style={editor.style} />
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
          <DocumentPane mode={mode}>
            <ResumeDocument
              data={toDocumentData(editor.resume)}
              isEditor
              mode={mode}
              selection={{
                selected: editor.selected,
                onSelect: editor.onSelect
              }}
            />
          </DocumentPane>
        </div>
      </div>
    </main>
  )
}

/**
 * The three typographic directions, as three buttons.
 *
 * There is no thumbnail preview and no modal: choosing redraws the document
 * beside it immediately, so the preview is the user's own resume in the style
 * rather than a miniature of someone else's. A style a user cannot picture
 * against their own dense work history is a style they are guessing at.
 */
function StylePicker({
  style,
  onChange
}: {
  style: ResumeStyle
  onChange: (style: ResumeStyle) => void
}) {
  return (
    <div
      aria-label="Resume style"
      className="flex items-center gap-1 rounded-md border border-neutral-200 p-0.5"
      role="radiogroup"
    >
      {resumeStyles.map((name) => {
        const { label, register } = resumeStyleCatalog[name]
        const isChosen = name === style

        return (
          <button
            aria-checked={isChosen}
            className={`rounded px-2 py-1 text-sm transition-colors ${
              isChosen
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
            key={name}
            onClick={() => onChange(name)}
            role="radio"
            title={register}
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
 * The page boundary, drawn over the document.
 *
 * The document no longer clips at one page, which means overflow is silent
 * rather than destructive. This is where it becomes something the user can see
 * before they send it rather than after.
 *
 * Page mode only: reflow is not a page, so a rule every 29.7cm through it would
 * mark a boundary that does not exist. Judging the print on a phone is what the
 * PDF preview is for.
 */
function DocumentPane({
  children,
  mode
}: {
  children: React.ReactNode
  mode: RenderMode
}) {
  return (
    <div className="relative h-fit">
      {children}

      {mode === "page" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(to bottom, transparent 0, transparent calc(29.7cm - 1px), rgba(220, 38, 38, 0.5) calc(29.7cm - 1px), rgba(220, 38, 38, 0.5) 29.7cm)"
          }}
        />
      )}
    </div>
  )
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
