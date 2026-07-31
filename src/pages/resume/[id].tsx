import Head from "next/head"
import { useRouter } from "next/router"
import { useRef } from "react"
import toast from "react-hot-toast"
import {
  ResumeDocument,
  type ResumeDocumentData,
  type ResumeFieldPath
} from "~/components/resume"
import {
  formatResumeFieldPath,
  isEditableResumePath,
  parseResumeFieldPath,
  type ResumeFieldTarget,
  withRow
} from "~/lib/resume-field-path"
import { api, type RouterOutputs } from "~/utils/api"
import { useUser } from "~/utils/useUser"

type SavedResume = RouterOutputs["resume"]["readById"]

export default function ResumeEditor() {
  const router = useRouter()
  const resumeId = typeof router.query.id === "string" ? router.query.id : ""

  return (
    <>
      <Head>
        <title>Edit resume</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Editor resumeId={resumeId} />
    </>
  )
}

function Editor({ resumeId }: { resumeId: string }) {
  const { resume, profile, errorMessage, isSaving, onEdit } =
    useEditableResume(resumeId)

  if (errorMessage) {
    return <main className="grid h-full place-items-center">{errorMessage}</main>
  }

  if (!resume || !profile) {
    return <main className="grid h-full place-items-center">Loading...</main>
  }

  return (
    <main className="flex flex-col items-center gap-4 overflow-y-auto py-8">
      <p className="text-sm text-neutral-500" role="status">
        {isSaving ? "Saving…" : "Changes save automatically"}
      </p>

      <ResumeDocument
        data={toDocumentData(resume, profile)}
        onEdit={onEdit}
        canEditPath={isEditableResumePath}
      />
    </main>
  )
}

/**
 * The editable resume: the saved snapshot, plus the profile fields the document
 * still needs to render, plus an autosaving `onEdit` for `ResumeDocument`.
 */
function useEditableResume(resumeId: string) {
  const { id: userId } = useUser()
  const utils = api.useContext()

  const resumeQuery = api.resume.readById.useQuery(
    { resumeId },
    { enabled: !!resumeId }
  )

  const profileQuery = api.profile.read.useQuery(
    { userId },
    { enabled: !!userId }
  )

  // Tracks writes still in the air. Refetching while any remain would serve a
  // response that predates them and clobber their optimistic values.
  const savesInFlight = useRef(0)

  const { mutate, isLoading: isSaving } = api.resume.updateField.useMutation({
    onMutate: ({ path, value }) => {
      savesInFlight.current += 1

      const target = parseResumeFieldPath(path)

      if (!target) return {}

      // Captured for rollback before the optimistic write, and narrow: undoing
      // the whole snapshot would also discard edits that already succeeded.
      const previousValue = readFieldValue(
        utils.resume.readById.getData({ resumeId }),
        target
      )

      utils.resume.readById.setData({ resumeId }, (current) =>
        current ? writeField(current, target, value) : current
      )

      return { target, previousValue }
    },
    onError: (error, _variables, context) => {
      const { target, previousValue } = context ?? {}

      if (target && previousValue !== undefined) {
        utils.resume.readById.setData({ resumeId }, (current) =>
          current ? writeField(current, target, previousValue) : current
        )
      }

      console.error(error)
      toast.error("Could not save that change.")
    },
    onSettled: () => {
      savesInFlight.current -= 1

      if (savesInFlight.current > 0) return

      void utils.resume.readById.invalidate({ resumeId })
    }
  })

  /**
   * Re-addresses the template's index path onto row ids before sending, so a
   * concurrent reorder can't land the write on the wrong job.
   */
  const onEdit = (path: ResumeFieldPath, value: string) => {
    const resume = resumeQuery.data
    const target = resume && parseResumeFieldPath(path)

    // Not addressable means the template asked to edit something this editor
    // doesn't own — a bug here, not a user error, so don't fire a doomed request.
    if (!resume || !target) {
      console.error(`Not an editable resume field: ${path}`)
      return
    }

    if (target.section === "resume") {
      mutate({ resumeId, path, value })
      return
    }

    const rows =
      target.section === "experience" ? resume.experience : resume.education
    const rowId = rows[Number(target.row)]?.id

    if (!rowId) {
      console.error(`No row for editable path: ${path}`)
      return
    }

    mutate({
      resumeId,
      path: formatResumeFieldPath(withRow(target, rowId)),
      value
    })
  }

  return {
    resume: resumeQuery.data,
    profile: profileQuery.data,
    errorMessage: loadErrorMessage(resumeQuery.isError, profileQuery.isError),
    isSaving,
    onEdit
  }
}

/**
 * A missing resume and a failed profile load are different problems, and
 * "Not found" for the latter sends the reader hunting in the wrong place.
 */
function loadErrorMessage(resumeFailed: boolean, profileFailed: boolean) {
  if (resumeFailed) return "Resume not found."
  if (profileFailed) return "Could not load your profile."

  return null
}

/** Reads the value a target currently points at, for rollback. */
function readFieldValue(
  resume: SavedResume | undefined,
  target: ResumeFieldTarget
) {
  if (!resume) return undefined

  if (target.section === "resume") return resume.profession

  if (target.section === "education") {
    const school = resume.education.find((row) => row.id === target.row)

    return school?.[target.column] ?? undefined
  }

  const job = resume.experience.find((row) => row.id === target.row)

  if (!job) return undefined

  return target.kind === "bullet"
    ? job.bullets[target.bulletIndex]
    : job[target.column]
}

/**
 * Applies an id-addressed edit to cached query data, for the optimistic update
 * and its rollback. The parsed target makes the column safe to index by —
 * `parseResumeFieldPath` has already rejected anything not writable.
 */
function writeField(
  resume: SavedResume,
  target: ResumeFieldTarget,
  value: string
): SavedResume {
  if (target.section === "resume") return { ...resume, profession: value }

  if (target.section === "education") {
    return {
      ...resume,
      education: resume.education.map((school) =>
        school.id === target.row ? { ...school, [target.column]: value } : school
      )
    }
  }

  return {
    ...resume,
    experience: resume.experience.map((job) => {
      if (job.id !== target.row) return job

      if (target.kind !== "bullet") return { ...job, [target.column]: value }

      const bullets = [...job.bullets]
      bullets[target.bulletIndex] = value

      return { ...job, bullets }
    })
  }
}

/** Assembles the document from the resume snapshot and the shared profile. */
function toDocumentData(
  resume: SavedResume,
  profile: RouterOutputs["profile"]["read"]
): ResumeDocumentData {
  return {
    fullName: `${profile.firstName} ${profile.lastName}`,
    profession: resume.profession,
    email: profile.email ?? "",
    location: profile.contact?.location ?? "",
    phone: profile.contact?.phone ?? "",
    linkedIn: profile.contact?.linkedIn ?? "",
    portfolio: profile.contact?.portfolio ?? "",
    skills: profile.skills.map((skill) => ({
      ...skill,
      all: skill.all.join(", ")
    })),
    experience: resume.experience,
    education: resume.education
  }
}
