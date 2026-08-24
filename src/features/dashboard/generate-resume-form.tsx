"use client"

import { useRouter } from "next/navigation"
import { type ChangeEvent, type FormEvent, useState } from "react"
import toast from "react-hot-toast"
import { PromptInput } from "~/components/prompt-input"
import { appPath } from "~/lib/path"
import { seedFromAccount } from "~/lib/resume-document-data"
import { testPrompt } from "~/lib/test-prompt"
import { api, type RouterOutputs } from "~/utils/api"

/** Prefilled in development so drafting doesn't start with a blank page. */
const initialInput = process.env.NODE_ENV === "development" ? testPrompt : ""

/**
 * Drafting a resume against a posting.
 *
 * Generation **creates** the resume and sends the user to the editor. The
 * preview that used to sit here was a second editing surface whose save button
 * had never fired — and a generated resume the user navigated away from was
 * simply lost. There is one editor now, and the resume exists before it opens.
 *
 * The cost is a row in the list for a draft the user dislikes, which is what
 * the delete action on the list is for.
 */
export function GenerateResumeForm({
  profile
}: {
  profile: RouterOutputs["profile"]["read"]
}) {
  const router = useRouter()
  const [jobDescription, setJobDescription] = useState(initialInput)

  const create = api.resume.create.useMutation({
    onSuccess: ({ resumeId }) => router.push(appPath.resumeById(resumeId)),
    onError: (error) => toast.error(error.message)
  })

  const generate = api.resume.generate.useMutation({
    onSuccess: (generated) =>
      create.mutate({
        ...seedFromAccount(profile),
        education: generated.education,
        experience: generated.experience,
        profession: generated.profession,
        // The posting travels with the resume: it is what tells one resume from
        // another in the list, and what scoring will score against.
        jobDescription
      }),
    onError: (error) => toast.error(error.message)
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    generate.mutate({
      profession: profile.profession,
      experience: JSON.stringify(
        profile.experience.map((job) => ({
          name: job.name,
          startDate: job.startDate,
          endDate: job.endDate,
          title: job.title,
          bullets: job.bullets
        }))
      ),
      education: JSON.stringify(
        profile.education.map((school) => ({
          name: school.name,
          startDate: school.startDate,
          endDate: school.endDate,
          degree: school.degree,
          description: school.description,
          gpa: school.gpa
        }))
      ),
      jobDescription
    })
  }

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setJobDescription(event.target.value)
  }

  // The redirect happens after the resume exists, so the pending state covers
  // the write as well as the drafting.
  if (generate.isPending || create.isPending || create.isSuccess) {
    return <p>Writing your resume...</p>
  }

  return (
    <form
      className="flex w-full flex-col gap-2 md:max-w-[60%]"
      onSubmit={onSubmit}
    >
      <PromptInput
        handleInputChange={handleInputChange}
        input={jobDescription}
      />
    </form>
  )
}
