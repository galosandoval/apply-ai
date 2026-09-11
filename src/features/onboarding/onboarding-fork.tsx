"use client"

import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import { Button } from "~/components/ui/button"
import { useErrorText } from "~/components/use-error-text"
import {
  forkHeadingId,
  useOnboardingStep
} from "~/features/onboarding/use-onboarding-step"
import { api } from "~/utils/api"

const MAX_FILE_SIZE_BYTES = 8_000_000

/**
 * Onboarding opens here: two routes to the same profile, neither of them the
 * lesser one. The upload is faster when it works, so it is offered first — but
 * it is offered as a choice, not as the path with an escape hatch beside it.
 */
export function OnboardingFork() {
  const t = useTranslations("onboarding.fork")
  const errorText = useErrorText()
  const { goToStep } = useOnboardingStep()
  const utils = api.useUtils()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState("")
  /**
   * A file this page turned away, before the server ever saw it. It is not the
   * import failing — the user picked the wrong thing and can pick again — so it
   * stays on the fork rather than sending them down a route they didn't choose.
   */
  const [rejection, setRejection] = useState("")

  const { mutate, isPending } = api.profile.importFromPdf.useMutation({
    onSuccess: async (counts) => {
      await utils.profile.read.invalidate()

      toast.success(t("imported", counts))

      goToStep("contact")
    },

    /*
      A PDF that won't parse is a detour, not a dead end: the user goes on to
      the forms — where they were headed anyway — and the explanation travels
      with them. Nobody is left on a screen deciding which button re-explains
      what just happened.

      `BAD_REQUEST` is the one code this procedure raises about the file itself
      — a PDF with no text it can read — so it earns its own copy. Anything else
      is ours, and reads the way every other failed procedure in the app does.
    */
    onError: (error) =>
      goToStep(
        "contact",
        error.data?.code === "BAD_REQUEST"
          ? t("unreadablePdf")
          : errorText(error)
      )
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

    // The rejection used to escape unhandled — the reader's message went
    // nowhere and the page sat on a filename that never uploaded. The name is
    // set only once there is something to upload under it.
    try {
      const fileBase64 = await readAsBase64(file)

      setFileName(file.name)

      mutate({ fileBase64 })
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 id={forkHeadingId} className="text-3xl">
          {t("title")}
        </h1>

        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <ForkChoice
          title={t("import.title")}
          description={t("import.description")}
          action={isPending ? t("import.reading") : t("import.action")}
          loading={isPending}
          onClick={() => inputRef.current?.click()}
        />

        <ForkChoice
          title={t("forms.title")}
          description={t("forms.description")}
          action={t("forms.action")}
          disabled={isPending}
          onClick={() => goToStep("contact")}
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleInputChange}
      />

      {isPending && fileName ? (
        <p className="text-sm text-muted-foreground">
          {t("uploading", { fileName })}
        </p>
      ) : null}

      {/* Nothing was uploaded, so there is nowhere to send them: say what was
          wrong with the file and leave both routes where they were. */}
      {rejection ? (
        <p role="alert" className="text-sm text-destructive">
          {rejection}
        </p>
      ) : null}
    </div>
  )
}

/**
 * One of the two routes in. Both are drawn the same on purpose — the styling is
 * what would otherwise say which one we expect the user to take.
 */
function ForkChoice({
  title,
  description,
  action,
  loading,
  disabled,
  onClick
}: {
  title: string
  description: string
  action: string
  loading?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-6">
      <h2 className="text-lg font-medium">{title}</h2>

      <p className="flex-1 text-sm text-muted-foreground">{description}</p>

      <Button
        type="button"
        className="w-full"
        loading={loading}
        disabled={disabled}
        onClick={onClick}
      >
        {action}
      </Button>
    </div>
  )
}

/** Strips the `data:application/pdf;base64,` prefix the FileReader adds. */
function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "")
    reader.onerror = () => reject(new Error("Could not read that file"))
    reader.readAsDataURL(file)
  })
}
