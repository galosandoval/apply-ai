"use client"

import { useState } from "react"
import { ResumeDocument } from "~/components/resume"
import {
  type OnEditField,
  type ResumeDocumentData
} from "~/components/resume-document"
import { Button } from "~/components/ui/button"
import { useAppForm } from "~/components/use-app-form"
import {
  type DownloadPdfSchema,
  type InsertResumeSchema,
  insertResumeSchema
} from "~/server/db/crud-schema"
import { profileDocumentFields } from "~/lib/resume-document-data"
import { type GeneratedResume } from "~/server/modules/profile/generate-resume"
import { api, type RouterOutputs } from "~/utils/api"

/**
 * The draft the model returned, editable in place and downloadable as a PDF.
 *
 * The draft arrives already shaped — `generateObject` validates it against the
 * schema server-side — so there is nothing to parse and no half-parsed state.
 */
export function GeneratedResumeView({
  generated,
  profile
}: {
  generated: GeneratedResume
  profile: RouterOutputs["profile"]["read"]
}) {
  const [savedResumeId, setSavedResumeId] = useState("")
  const [isDownloading, setIsDownloading] = useState(false)

  const { mutate, isPending } = api.resume.create.useMutation({
    onSuccess: (data) => {
      setSavedResumeId(data.resumeId)
    }
  })

  const fromProfile = profileDocumentFields(profile)

  const { watch, setValue, handleSubmit } = useAppForm(insertResumeSchema, {
    values: {
      education: generated.education,
      experience: generated.experience,
      profession: generated.profession,
      skills: fromProfile.skills,
      email: fromProfile.email,
      phone: fromProfile.phone,
      location: fromProfile.location,
      portfolio: fromProfile.portfolio,
      linkedIn: fromProfile.linkedIn
    }
  })

  const onSubmitSaveResume = (data: InsertResumeSchema) => {
    mutate({
      ...data,
      education: data.education.map((school) => ({ ...school })),
      skills: data.skills,
      interests: data.interests ?? ""
    })
  }

  const resumeData: ResumeDocumentData = {
    fullName: fromProfile.fullName,
    profession: watch("profession"),
    email: watch("email"),
    phone: watch("phone"),
    linkedIn: watch("linkedIn"),
    portfolio: watch("portfolio"),
    location: watch("location"),
    skills: watch("skills"),
    experience: watch("experience"),
    education: watch("education")
  }

  /**
   * Commits one `Editable` edit into form state.
   *
   * The preview edits an unsaved resume, so there is no row to autosave to —
   * `resume.updateField` serves `/resume/[id]`, where the resume exists.
   */
  const handleEditField: OnEditField = (path, value) => {
    setValue(path, value, { shouldDirty: true })
  }

  const handleDownloadPdf = async () => {
    setIsDownloading(true)

    try {
      const body: DownloadPdfSchema = resumeData

      const response = await fetch("/api/resume/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      if (!response.ok) throw new Error(await response.text())

      const blob = await response.blob()
      const link = document.createElement("a")

      link.href = window.URL.createObjectURL(blob)
      link.download = "resume.pdf"
      link.click()
      window.URL.revokeObjectURL(link.href)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmitSaveResume)}
      className="flex flex-col items-center gap-4 overflow-y-auto pt-16"
    >
      <ResumeDocument data={resumeData} onEdit={handleEditField} />

      <div className="flex gap-2 pb-12">
        <Button loading={isPending} type="submit">
          {savedResumeId ? "Saved" : "Save resume"}
        </Button>

        <Button
          loading={isDownloading}
          onClick={handleDownloadPdf}
          type="button"
          variant="secondary"
        >
          Download PDF
        </Button>
      </div>
    </form>
  )
}