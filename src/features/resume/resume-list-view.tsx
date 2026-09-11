"use client"

import { useFormatter, useTranslations } from "next-intl"
import { Link } from "~/i18n/navigation"
import toast from "react-hot-toast"
import { Button } from "~/components/ui/button"
import { appPath } from "~/lib/path"
import { api } from "~/utils/api"

/**
 * The resumes the account owns.
 *
 * Generation creates a resume rather than previewing one, so this list is where
 * every draft lands — and a draft the user dislikes has to be removable, or
 * generating twice is permanent.
 */
export function ResumeListView() {
  const t = useTranslations("resumeList")
  const format = useFormatter()
  const utils = api.useUtils()
  const { data: resumes, status } = api.resume.list.useQuery()

  const remove = api.resume.remove.useMutation({
    onSuccess: () => utils.resume.list.invalidate(),
    onError: (error) => {
      console.error(error)
      toast.error(t("deleteFailed"))
    }
  })

  if (status === "error") {
    return <main className="grid h-full place-items-center">{status}</main>
  }

  if (status === "pending" || !resumes) {
    return (
      <main className="grid h-full place-items-center">{t("loading")}</main>
    )
  }

  /*
    An account with no resumes hits this list right after signing up, so the
    empty case has to point at the one action that fills it rather than leave
    a blank grid.
  */
  if (resumes.length === 0) {
    return (
      <main className="grid h-full place-items-center p-4">
        <div className="flex max-w-sm flex-col items-center gap-2 text-center">
          <h2 className="text-lg font-semibold">{t("emptyHeading")}</h2>

          <p className="text-sm text-muted-foreground">{t("emptyBlurb")}</p>

          <Button asChild className="mt-2" size="sm">
            <Link href={appPath.newResume}>{t("emptyAction")}</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <div className="grid gap-2 p-4 md:grid-cols-2 lg:grid-cols-4">
      {resumes.map((resume) => (
        <div
          className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3"
          key={resume.id}
        >
          <Link className="flex-1" href={appPath.resumeById(resume.id)}>
            <h2 className="font-semibold">{resume.profession}</h2>

            {/*
              The posting is what tells one resume from another — a list of
              dates is a list of dates. Two lines of it is enough to recognize.
            */}
            <p className="line-clamp-2 text-sm text-neutral-600">
              {resume.jobDescription || t("noJobDescription")}
            </p>

            <p className="pt-1 text-xs text-neutral-500">
              {format.dateTime(resume.createdAt, "long")}
            </p>
          </Link>

          <Button
            className="self-start"
            onClick={() => remove.mutate({ resumeId: resume.id })}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("delete")}
          </Button>
        </div>
      ))}
    </div>
  )
}
