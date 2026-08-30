import { type Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { localeAlternates } from "~/i18n/alternates"
import { PrivacyPolicyEn } from "./en"
import { PrivacyPolicyEs } from "./es"

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "meta" })

  return {
    title: t("privacyPolicy"),
    alternates: localeAlternates("/privacy-policy")
  }
}

/**
 * One document per locale, picked here — not a namespace of numbered paragraph
 * keys. Legal text translates as prose: keying it invites the drift where the
 * English gains a clause and the Spanish quietly does not.
 */
export default async function Page({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  setRequestLocale(locale)

  if (locale === "es") return <PrivacyPolicyEs />

  return <PrivacyPolicyEn />
}
