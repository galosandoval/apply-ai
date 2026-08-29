"use client"

import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import { Button } from "~/components/ui/button"
import { useOnboardingStep } from "~/features/onboarding/use-onboarding-step"
import { api } from "~/utils/api"

const MAX_FILE_SIZE_BYTES = 8_000_000

/**
 * Thrown from a plain Promise, outside any component, so it can't reach for a
 * hook. The caller catches it and shows `onboarding.import.unreadable`.
 */
const UNREADABLE_FILE = "unreadable-file"

export function ImportStep() {
  const t = useTranslations("onboarding.import")
  const { goToStep } = useOnboardingStep()
  const utils = api.useContext()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState("")
  /** A file this page turned away, before the server ever saw it. */
  const [rejection, setRejection] = useState("")

  const { mutate, isPending, error } = api.profile.importFromPdf.useMutation({
    onSuccess: async (counts) => {
      await utils.profile.read.invalidate()

      toast.success(t("imported", counts))

      goToStep("contact")
    }
  })

  const validateAndUpload = async (file: File) => {
    if (file.type !== "application/pdf") {
      setRejection(t("notPdf"))
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setRejection(t("tooLarge"))
      return
    }

    setRejection("")

    setFileName(file.name)

    // The rejection used to escape unhandled — the reader's message went
    // nowhere and the page sat on a filename that never uploaded.
    try {
      mutate({ fileBase64: await readAsBase64(file) })
    } catch {
      setRejection(t("unreadable"))
    }
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    // Reset so re-picking the same file after an error still fires.
    event.target.value = ""

    if (file) void validateAndUpload(file)
  }

  // Whichever refused the file: this page, or the server that tried to read it.
  const failure = rejection.length ? rejection : (error?.message ?? "")

  return (
    <div>
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl">{t("title")}</h1>

        <p className="max-w-md text-sm text-muted-foreground">
          Upload a PDF and we&apos;ll fill in your contact info, work history,
          education, and skills. You get to review and edit everything before
          anything is used.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            loading={isPending}
            onClick={() => inputRef.current?.click()}
          >
            {isPending ? t("reading") : t("upload")}
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => goToStep("contact")}
          >
            I&apos;ll fill it in myself
          </Button>
        </div>

        {isPending && fileName ? (
          <p className="text-sm text-muted-foreground">
            {fileName} — this takes a few seconds.
          </p>
        ) : null}

        {/*
        A PDF that won't parse is a detour, not a dead end: the message says
        what happened and the next step is right under it, so the user is
        never left on a page with nothing to press.
      */}
        {failure ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="max-w-md text-sm text-destructive">{failure}</p>

            <Button
              type="button"
              variant="secondary"
              onClick={() => goToStep("contact")}
            >
              Fill in the forms instead
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Strips the `data:application/pdf;base64,` prefix the FileReader adds. */
function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "")
    reader.onerror = () => reject(new Error(UNREADABLE_FILE))
    reader.readAsDataURL(file)
  })
}
