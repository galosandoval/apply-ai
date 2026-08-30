import { type Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { OnboardingPanels } from "~/features/onboarding/onboarding-panels"

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "meta" })

  return { title: t("onboarding") }
}

export default function Page() {
  return <OnboardingPanels />
}
