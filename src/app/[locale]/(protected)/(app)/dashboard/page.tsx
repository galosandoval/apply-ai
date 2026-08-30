import { type Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { DashboardView } from "~/features/dashboard/dashboard-view"

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "meta" })

  return { title: t("dashboard") }
}

export default function Page() {
  return <DashboardView />
}
