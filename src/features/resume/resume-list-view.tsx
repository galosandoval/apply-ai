"use client"

import Link from "next/link"
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
  const utils = api.useContext()
  const { data: resumes, status } = api.resume.list.useQuery()

  const remove = api.resume.remove.useMutation({
    onSuccess: () => utils.resume.list.invalidate(),
    onError: (error) => {
      console.error(error)
      toast.error("Could not delete that resume.")
    }
  })

  if (status === "error") {
    return <main className="grid h-full place-items-center">{status}</main>
  }

  if (status === "pending" || !resumes) {
    return <main className="grid h-full place-items-center">Loading...</main>
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
              {resume.jobDescription || "No job description saved"}
            </p>

            <p className="pt-1 text-xs text-neutral-500">
              {resume.createdAt.toDateString()}
            </p>
          </Link>

          <Button
            className="self-start"
            onClick={() => remove.mutate({ resumeId: resume.id })}
            size="sm"
            type="button"
            variant="ghost"
          >
            Delete
          </Button>
        </div>
      ))}
    </div>
  )
}
