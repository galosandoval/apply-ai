"use client"

import { useParams } from "next/navigation"
import { useRef } from "react"
import toast from "react-hot-toast"
import { ResumeDocument } from "~/components/resume"
import {
  type ResumeDocumentData,
  type ResumeFieldPath
} from "~/components/resume-document"
import { useResumeRenderMode } from "~/components/use-resume-render-mode"
import {
  formatResumeFieldPath,
  isEditableResumePath,
  isRowTarget,
  parseResumeFieldPath,
  type ResumeFieldTarget,
  withRow
} from "~/lib/resume-field-path"
import { api, type RouterOutputs } from "~/utils/api"

type SavedResume = RouterOutputs["resume"]["readById"]

type ResumeSection = ResumeFieldTarget["section"]

type TargetIn<Section extends ResumeSection> = Extract<
  ResumeFieldTarget,
  { section: Section }
>

export function ResumeEditorView() {
  const params = useParams<{ id: string }>()

  return <Editor resumeId={params?.id ?? ""} />
}

function Editor({ resumeId }: { resumeId: string }) {
  const { resume, errorMessage, isSaving, onEdit } = useEditableResume(resumeId)
  const mode = useResumeRenderMode()

  if (errorMessage) {
    return (
      <main className="grid h-full place-items-center">{errorMessage}</main>
    )
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
        canEditPath={isEditableResumePath}
        data={toDocumentData(resume)}
        mode={mode}
        onEdit={onEdit}
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
  const resumeQuery = api.resume.readById.useQuery(
    { resumeId },
    { enabled: !!resumeId }
  )

  const { save, isSaving } = useFieldAutosave(resumeId)

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

    if (!isRowTarget(target)) {
      save({ resumeId, path, value })
      return
    }

    // The section name is also the key it lives under on the resume.
    const rowId = resume[target.section][Number(target.row)]?.id

    if (!rowId) {
      console.error(`No row for editable path: ${path}`)
      return
    }

    save({
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
 * Sends one field write and patches the cache while it's in the air, rolling
 * that patch back if the write is refused.
 */
function useFieldAutosave(resumeId: string) {
  const utils = api.useContext()

  // Tracks writes still in the air. Refetching while any remain would serve a
  // response that predates them and clobber their optimistic values.
  const savesInFlight = useRef(0)

  const { mutate, isPending } = api.resume.updateField.useMutation({
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

  return { save: mutate, isSaving: isPending }
}

/**
 * How one section's targets are read out of the cached resume and written back
 * into it.
 *
 * The two halves live in one entry on purpose: they are inverses, and splitting
 * them into a read switch and a write switch is what lets a new section be
 * added to one and forgotten in the other.
 */
type FieldLens<Section extends ResumeSection> = {
  read: (resume: SavedResume, target: TargetIn<Section>) => string | undefined
  write: (
    resume: SavedResume,
    target: TargetIn<Section>,
    value: string
  ) => SavedResume
}

const fieldLenses: { [Section in ResumeSection]: FieldLens<Section> } = {
  resume: {
    read: (resume) => resume.profession,
    write: (resume, _target, value) => ({ ...resume, profession: value })
  },

  contact: {
    read: (resume, target) => resume.contact[target.column] ?? undefined,
    write: (resume, target, value) => ({
      ...resume,
      contact: { ...resume.contact, [target.column]: value }
    })
  },

  education: {
    read: (resume, target) =>
      resume.education.find((row) => row.id === target.row)?.[target.column] ??
      undefined,
    write: (resume, target, value) => ({
      ...resume,
      education: resume.education.map((school) =>
        school.id === target.row
          ? { ...school, [target.column]: value }
          : school
      )
    })
  },

  skill: {
    read: (resume, target) =>
      resume.skill.find((row) => row.id === target.row)?.[target.column],
    write: (resume, target, value) => ({
      ...resume,
      skill: resume.skill.map((group) =>
        group.id === target.row ? { ...group, [target.column]: value } : group
      )
    })
  },

  experience: {
    read: (resume, target) => {
      const job = resume.experience.find((row) => row.id === target.row)

      if (!job) return undefined

      return target.kind === "bullet"
        ? job.bullets[target.bulletIndex]
        : (job[target.column] ?? undefined)
    },
    write: (resume, target, value) => ({
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
    })
  },

  // Sections are not drawn from the document data yet — spec C renders them.
  section: {
    read: () => undefined,
    write: (resume) => resume
  }
}

/**
 * The lens that handles `target`.
 *
 * Indexing by `target.section` always picks the entry written for exactly that
 * target, but TypeScript can't correlate the two halves of that lookup — so the
 * widening happens once, here, and the call sites stay honest.
 */
function lensFor(target: ResumeFieldTarget): FieldLens<ResumeSection> {
  return fieldLenses[target.section] as FieldLens<ResumeSection>
}

/** Reads the value a target currently points at, for rollback. */
function readFieldValue(
  resume: SavedResume | undefined,
  target: ResumeFieldTarget
) {
  return resume ? lensFor(target).read(resume, target) : undefined
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
  return lensFor(target).write(resume, target, value)
}

/** The document, entirely from the resume's own snapshot. */
function toDocumentData(resume: SavedResume): ResumeDocumentData {
  return {
    profession: resume.profession,
    contact: resume.contact,
    skill: resume.skill,
    experience: resume.experience,
    education: resume.education,
    // What is drawn and in what order is data now, not JSX order.
    sections: resume.sections
  }
}
