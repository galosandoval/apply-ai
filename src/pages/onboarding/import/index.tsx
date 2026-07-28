import { useRouter } from "next/router"
import { useRef, useState } from "react"
import toast from "react-hot-toast"
import { MyAlert } from "~/components/alert"
import { Button } from "~/components/ui/button"
import { appPath } from "~/lib/path"
import { api } from "~/utils/api"
import { useUser } from "~/utils/useUser"

const maxFileSizeBytes = 4_500_000

export default function ImportResume() {
  const router = useRouter()
  const utils = api.useContext()
  const { id: userId } = useUser()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState("")

  const { mutate, isLoading } = api.profile.importFromPdf.useMutation({
    onError: (error) => toast.error(error.message),

    onSuccess: async (counts) => {
      await utils.profile.read.invalidate({ userId })

      toast.success(
        `Imported ${counts.experience} jobs, ${counts.education} schools, and ${counts.skills} skill groups.`
      )

      await router.push(appPath.contact)
    }
  })

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("That file isn't a PDF.")
      return
    }

    if (file.size > maxFileSizeBytes) {
      toast.error("That PDF is too large. Keep it under 4.5MB.")
      return
    }

    setFileName(file.name)
    mutate({ fileBase64: await readAsBase64(file) })
  }

  return (
    <main className="h-full overflow-y-auto md:grid md:place-items-center">
      <div className="flex max-w-3xl flex-col gap-4 py-16">
        <h1 className="text-3xl">Start with your current resume</h1>

        <p className="max-w-md text-sm text-muted-foreground">
          Upload a PDF and we&apos;ll fill in your contact info, work history,
          education, and skills. You get to review and edit everything before
          anything is used.
        </p>

        <div className="max-w-md">
          <MyAlert
            title="LinkedIn"
            description="LinkedIn doesn't let apps read your work history, but it does let you export your profile as a PDF. Open your profile, choose More, then Save to PDF, and upload that here."
          />
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]

            // Reset so re-picking the same file after an error still fires.
            event.target.value = ""

            if (file) void handleFile(file)
          }}
        />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            loading={isLoading}
            onClick={() => inputRef.current?.click()}
          >
            {isLoading ? "Reading your resume..." : "Upload a PDF"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={isLoading}
            onClick={() => void router.push(appPath.contact)}
          >
            I&apos;ll fill it in myself
          </Button>
        </div>

        {isLoading && fileName ? (
          <p className="text-sm text-muted-foreground">
            {fileName} — this takes a few seconds.
          </p>
        ) : null}
      </div>
    </main>
  )
}

/** Strips the `data:application/pdf;base64,` prefix the FileReader adds. */
function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "")
    reader.onerror = () => reject(new Error("Could not read that file."))
    reader.readAsDataURL(file)
  })
}
