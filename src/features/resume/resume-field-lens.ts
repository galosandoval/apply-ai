/**
 * Reading one addressed field out of a cached resume, and writing one back.
 *
 * The optimistic update, its rollback and the document data all come from here:
 * a path is the address, and this is what it addresses. Pure, so nothing about
 * how a write is sent leaks into what a write means.
 */

import { type ResumeDocumentData } from "~/components/resume-document"
import { type ResumeFieldTarget } from "~/lib/resume-field-path"
import {
  readSectionContentString,
  replaceSectionContentString
} from "~/lib/section-content"
import { type RouterOutputs } from "~/utils/api"

export type SavedResume = RouterOutputs["resume"]["readById"]

type ResumeSection = ResumeFieldTarget["section"]

type TargetIn<Section extends ResumeSection> = Extract<
  ResumeFieldTarget,
  { section: Section }
>

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

  section: {
    read: (resume, target) => {
      const row = resume.sections.find((current) => current.id === target.row)

      if (!row) return undefined

      if (target.kind === "label") return row.label

      return readSectionContentString(target.content, row.content) ?? undefined
    },
    write: (resume, target, value) => ({
      ...resume,
      sections: resume.sections.map((row) => {
        if (row.id !== target.row) return row

        if (target.kind === "label") return { ...row, label: value }

        const content = replaceSectionContentString(
          target.content,
          row.content,
          value
        )

        // A content payload that disagrees with its component is refused by the
        // server too, so the optimistic copy leaves it as it was rather than
        // showing a change that is about to be rejected.
        return content ? { ...row, content } : row
      })
    })
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
export function readFieldValue(
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
export function writeField(
  resume: SavedResume,
  target: ResumeFieldTarget,
  value: string
): SavedResume {
  return lensFor(target).write(resume, target, value)
}

/** The document, entirely from the resume's own snapshot. */
export function toDocumentData(resume: SavedResume): ResumeDocumentData {
  return {
    profession: resume.profession,
    contact: resume.contact,
    skill: resume.skill,
    experience: resume.experience,
    education: resume.education,
    // What is drawn and in what order is data now, not JSX order.
    sections: resume.sections,
    // The document owns how it looks, so the preview and the print agree.
    style: resume.style,
    accent: resume.accent
  }
}
