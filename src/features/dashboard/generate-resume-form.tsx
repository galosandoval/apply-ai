"use client"

import { type ChangeEvent, type FormEvent, useState } from "react"
import toast from "react-hot-toast"
import { PromptInput } from "~/components/prompt-input"
import { testPrompt } from "~/lib/test-prompt"
import { type GeneratedResume } from "~/server/modules/profile/generate-resume"
import { api, type RouterOutputs } from "~/utils/api"
import { GeneratedResumeView } from "./generated-resume"

/** Prefilled in development so drafting doesn't start with a blank page. */
const initialInput = process.env.NODE_ENV === "development" ? testPrompt : ""

export function GenerateResumeForm({
  profile
}: {
  profile: RouterOutputs["profile"]["read"]
}) {
  const [jobDescription, setJobDescription] = useState(initialInput)
  const [generated, setGenerated] = useState<GeneratedResume | null>(null)

  const { mutate, isPending } = api.resume.generate.useMutation({
    onSuccess: setGenerated,
    onError: (error) => toast.error(error.message)
  })

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setJobDescription(event.target.value)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    mutate({
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

  if (isPending) {
    return <p>Writing your resume...</p>
  }

  if (generated) {
    return <GeneratedResumeView generated={generated} profile={profile} />
  }

  return (
    <form
      className="flex w-full flex-col gap-2 md:max-w-[60%]"
      onSubmit={onSubmit}
    >
      <PromptInput handleInputChange={handleInputChange} input={jobDescription} />
    </form>
  )
}