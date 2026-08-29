import { type Metadata } from "next"
import { hasLocale, NextIntlClientProvider } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { Toaster } from "react-hot-toast"
import "~/styles/global.css"
import { Providers } from "~/app/providers"
import { env } from "~/env"
import { routing } from "~/i18n/routing"

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "meta" })

  return {
    /**
     * Makes the canonical and `hreflang` links absolute. Relative alternates
     * are not reliably honoured by crawlers, which would waste the whole point
     * of prefixed URLs.
     */
    metadataBase: new URL(env.APP_URL),
    title: {
      default: t("appName"),
      template: `%s · ${t("appName")}`
    },
    description: t("description"),
    icons: { icon: "/favicon.ico" }
  }
}

/** Prerenders both locales instead of rendering every page on demand. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

/**
 * The shell every page shares. The navbar is not here: which one you get is
 * decided by the route group you are in, not by reading the session at render
 * time and branching.
 *
 * This is the root layout — there is no `app/layout.tsx` above it, because the
 * `<html lang>` attribute has to name the locale and the locale is a route
 * param. Every page lives under `[locale]`; only the route handlers in
 * `app/api` sit outside, and those render no HTML.
 */
export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) notFound()

  setRequestLocale(locale)

  return (
    <html lang={locale} className="h-full">
      <body className="h-full font-sans antialiased">
        <NextIntlClientProvider>
          <Providers>
            <Toaster />

            <div className="flex h-full flex-col">{children}</div>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
