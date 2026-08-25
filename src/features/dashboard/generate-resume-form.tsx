"use client"

import { useRouter } from "next/navigation"
import { type ChangeEvent, type FormEvent, useState } from "react"
import { PromptInput } from "~/components/prompt-input"
import { appPath } from "~/lib/path"
import { testPrompt } from "~/lib/test-prompt"
import { api } from "~/utils/api"

/** Prefilled in development so drafting doesn't start with a blank page. */
const initialInput = process.env.NODE_ENV === "development" ? testPrompt : ""

/**
 * Drafting a resume against a posting.
 *
 * The posting is the whole input. The history the resume is written from is
 * read off the account by the server, in the same call that snapshots it onto
 * the resume — this form never handles it, so the two cannot disagree.
 *
 * Generation **creates** the resume and sends the user to the editor. The
 * preview that used to sit here was a second editing surface whose save button
 * had never fired — and a generated resume the user navigated away from was
 * simply lost. There is one editor now, and the resume exists before it opens.
 *
 * The cost is a row in the list for a draft the user dislikes, which is what
 * the delete action on the list is for.
 */
export function GenerateResumeForm() {
  const router = useRouter()
  const [jobDescription, setJobDescription] = useState(initialInput)

  const generate = api.resume.generate.useMutation({
    onSuccess: ({ resumeId }) => router.push(appPath.resumeById(resumeId))
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    generate.mutate({ jobDescription })
  }

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setJobDescription(event.target.value)
  }

  // The redirect happens after the resume exists, so the pending state covers
  // the write as well as the drafting.
  if (generate.isPending || generate.isSuccess) {
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

      {/*
        A failure leaves the posting in the box, so retrying is pressing send
        again rather than pasting it a second time.
      */}
      {generate.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {generate.error.message} Your posting is still here — send it again to
          retry.
        </p>
      ) : null}
    </form>
  )
}
