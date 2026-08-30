import { type Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "~/i18n/navigation"
import { Button } from "~/components/ui/button"
import Image from "next/image"
import {
  ClipboardCopyIcon,
  DownloadIcon,
  Pencil1Icon
} from "@radix-ui/react-icons"
import { AuthModal } from "~/components/auth-modal"
import { localeAlternates } from "~/i18n/alternates"

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "meta" })

  return { title: t("home"), alternates: localeAlternates("/") }
}

export default async function Home({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  setRequestLocale(locale)

  return (
    <main className="overflow-y-auto">
      <Landing />
    </main>
  )
}

function Landing() {
  const t = useTranslations("landing.testimonial")

  return (
    <div className="w-full">
      <Hero />

      <HowItWorks />

      <section className="w-full py-12 md:py-16 xl:py-24">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-center lg:gap-12">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
                {t("title")}
              </h2>
              <p className="max-w-prose text-gray-500 dark:text-gray-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                {t("quote")}
              </p>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  )
}

function Hero() {
  const t = useTranslations("landing.hero")

  return (
    <section className="w-full py-12 md:py-16 xl:py-24">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col justify-center space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                {t("title")}
              </h1>
              <p className="max-w-[500px] text-gray-500 dark:text-gray-400">
                {t("description")}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline">
                <AuthModal label={t("cta")} initialModal="sign-up" />
              </Button>
              <p className="text-xs text-gray-500">{t("finePrint")}</p>
            </div>
          </div>
          <div className="flex items-start justify-center">
            <Image
              alt={t("imageAlt")}
              className="aspect-[3/2] h-auto w-full max-w-[600px] overflow-hidden rounded-xl object-cover object-top"
              height="400"
              src="/landing-resume.png"
              width="600"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const t = useTranslations("landing.howItWorks")

  return (
    <section className="w-full py-12 md:py-24 lg:py-32">
      <div className="container grid items-center gap-4 px-4 text-center md:px-6 lg:gap-10">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            {t("title")}
          </h2>
          <p className="mx-auto max-w-[600px] text-gray-500 dark:text-gray-400 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
            {t("description")}
          </p>
        </div>
        <div className="mx-auto grid max-w-5xl items-start gap-6 sm:grid-cols-2 md:gap-12 lg:max-w-6xl lg:grid-cols-3">
          <Step
            icon={<Pencil1Icon className="h-24 w-24" />}
            title={t("profile.title")}
            description={t("profile.description")}
          />
          <Step
            icon={<ClipboardCopyIcon className="h-24 w-24" />}
            title={t("copyPaste.title")}
            description={t("copyPaste.description")}
          />
          <Step
            icon={<DownloadIcon className="h-24 w-24" />}
            title={t("download.title")}
            description={t("download.description")}
          />
        </div>
      </div>
    </section>
  )
}

function Step({
  icon,
  title,
  description
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      {icon}
      <div className="space-y-2 text-center">
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
    </div>
  )
}

function Footer() {
  const t = useTranslations("landing.footer")

  return (
    <section className="w-full py-6 md:py-12">
      <div className="container flex flex-col items-center space-y-4 px-4 md:flex-row md:justify-between md:space-y-0 md:px-6">
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 md:text-base">
          {t("copyright")}
        </div>
        <nav className="flex items-center space-x-4 text-sm md:space-x-6">
          <Link className="text-gray-500 underline" href="/privacy-policy">
            {t("privacy")}
          </Link>
          <Link className="text-gray-500 underline" href="/terms-of-service">
            {t("terms")}
          </Link>
          <Link
            className="text-gray-500 underline"
            href="mailto:galo.sandoval.dev@gmail.com"
          >
            {t("contact")}
          </Link>
        </nav>
      </div>
    </section>
  )
}
