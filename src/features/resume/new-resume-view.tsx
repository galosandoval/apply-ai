"use client"

import { useTranslations } from "next-intl"
import { GenerateResumeForm } from "~/features/resume/generate-resume-form"

/**
 * The page a signed-in user lands on: paste a posting, get a resume.
 *
 * The heading and blurb sit inside the form's column rather than the page
 * container, so they line up with the textarea they describe instead of with
 * the viewport.
 */
export function NewResumeView() {
  const t = useTranslations("newResume")

  return (
    <main className="top-0 my-auto grid h-full place-items-center overflow-y-auto max-md:block">
      <div className="flex w-full max-w-[60%] flex-col gap-4 max-md:max-w-full">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("heading")}</h1>
          <p className="text-sm text-muted-foreground">{t("blurb")}</p>
        </div>

        <GenerateResumeForm />
      </div>
    </main>
  )
}
