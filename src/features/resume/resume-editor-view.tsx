"use client"

import { useParams } from "next/navigation"
import { useRef } from "react"
import toast from "react-hot-toast"
import { ResumeDocument } from "~/components/resume"
import {
  type ResumeDocumentData,
  type ResumeFieldPath
} from "~/components/resume-document"
import {
  formatResumeFieldPath,
  isEditableResumePath,
  parseResumeFieldPath,
  type ResumeFieldTarget,
  withRow
} from "~/lib/resume-field-path"
import { api, type RouterOutputs } from "~/utils/api"

type SavedResume = RouterOutputs["resume"]["readById"]

export function ResumeEditorView() {
  const params = useParams<{ id: string }>()

  return <Editor resumeId={params?.id ?? ""} />
}

function Editor({ resumeId }: { resumeId: string }) {
  const { resume, errorMessage, isSaving, onEdit } = useEditableResume(resumeId)

  if (errorMessage) {
    return <main className="grid h-full place-items-center">{errorMessage}</main>
  }

  if (!resume) {
    return <main className="grid h-full place-items-center">Loading...</main>
  }

  return (
    <main className="flex flex-col items-center gap-4 overflow-y-auto py-8">
      <p className="text-sm text-neutral-500" role="status">
        {isSaving ? "Saving…" : "Changes save automatically"}
      </p>

      <ResumeDocument
        data={toDocumentData(resume)}
        onEdit={onEdit}
        canEditPath={isEditableResumePath}
      />
    </main>
  )
}

/**
 * The editable resume, plus an autosaving `onEdit` for `ResumeDocument`.
 *
 * There is no profile query any more: a saved resume owns its own contact
 * details and skills, so everything the document draws comes from one snapshot.
 */
function useEditableResume(resumeId: string) {
  const utils = api.useContext()

  const resumeQuery = api.resume.readById.useQuery(
    { resumeId },
    { enabled: !!resumeId }
  )

  // Tracks writes still in the air. Refetching while any remain would serve a
  // response that predates them and clobber their optimistic values.
  const savesInFlight = useRef(0)

  const { mutate, isPending: isSaving } = api.resume.updateField.useMutation({
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

    const indexed = indexedRows(resume, target)

    if (!indexed) {
      mutate({ resumeId, path, value })
      return
    }

    const rowId = indexed.rows[Number(indexed.row)]?.id

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
    errorMessage: resumeQuery.isError ? "Resume not found." : null,
    isSaving,
    onEdit
  }
}

/**
 * The list a row-addressed target indexes into, or `null` for a target the
 * resume holds directly — those paths carry no row to swap.
 */
function indexedRows(resume: SavedResume, target: ResumeFieldTarget) {
  switch (target.section) {
    case "experience":
      return { rows: resume.experience, row: target.row }
    case "education":
      return { rows: resume.education, row: target.row }
    case "skill":
      return { rows: resume.skill, row: target.row }
    default:
      return null
  }
}

/** Reads the value a target currently points at, for rollback. */
function readFieldValue(
  resume: SavedResume | undefined,
  target: ResumeFieldTarget
) {
  if (!resume) return undefined

  switch (target.section) {
    case "resume":
      return resume.profession

    case "contact":
      return resume.contact[target.column] ?? undefined

    case "education":
      return (
        resume.education.find((row) => row.id === target.row)?.[
          target.column
        ] ?? undefined
      )

    case "skill":
      return resume.skill.find((row) => row.id === target.row)?.[target.column]

    case "experience": {
      const job = resume.experience.find((row) => row.id === target.row)

      if (!job) return undefined

      return target.kind === "bullet"
        ? job.bullets[target.bulletIndex]
        : job[target.column] ?? undefined
    }

    // Sections are not drawn from the document data yet — spec C renders them.
    default:
      return undefined
  }
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
  switch (target.section) {
    case "resume":
      return { ...resume, profession: value }

    case "contact":
      return { ...resume, contact: { ...resume.contact, [target.column]: value } }

    case "education":
      return {
        ...resume,
        education: resume.education.map((school) =>
          school.id === target.row
            ? { ...school, [target.column]: value }
            : school
        )
      }

    case "skill":
      return {
        ...resume,
        skill: resume.skill.map((group) =>
          group.id === target.row ? { ...group, [target.column]: value } : group
        )
      }

    case "experience":
      return {
        ...resume,
        experience: resume.experience.map((job) => {
          if (job.id !== target.row) return job

          if (target.kind !== "bullet") return { ...job, [target.column]: value }

          return {
            ...job,
            bullets: job.bullets.map((bullet, index) =>
              index === target.bulletIndex ? value : bullet
            )
          }
        })
      }

    default:
      return resume
  }
}

/** The document, entirely from the resume's own snapshot. */
function toDocumentData(resume: SavedResume): ResumeDocumentData {
  return {
    profession: resume.profession,
    contact: resume.contact,
    skill: resume.skill,
    experience: resume.experience,
    education: resume.education
  }
}
