import { type Metadata } from "next"
import { ResumeEditorView } from "~/features/resume/resume-editor-view"

export const metadata: Metadata = { title: "Edit resume" }

export default function Page() {
  return <ResumeEditorView />
}
