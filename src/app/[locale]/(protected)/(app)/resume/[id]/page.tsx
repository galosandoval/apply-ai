import { type Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ResumeEditorView } from "~/features/resume/resume-editor-view"

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "meta" })

  return { title: t("editResume") }
}

export default function Page() {
  return <ResumeEditorView />
}
