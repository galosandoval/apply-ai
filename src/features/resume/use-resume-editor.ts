"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { parseResumeFieldPath } from "~/lib/resume-field-path"
import { apiNameFor, type ResumeSelection } from "~/lib/resume-selection"
import {
  type AnySectionContent,
  type SectionComponentType
} from "~/lib/section-content"
import { api } from "~/utils/api"
import {
  readFieldValue,
  type SavedResume,
  writeField
} from "~/features/resume/resume-field-lens"
import {
  buildPanel,
  type StructureActions
} from "~/features/resume/resume-panel-model"

// The editing surface behind the panel.
//
// Everything the panel can do resolves to a mutation, and everything the
// document draws comes from one query — so this owns both, and the panel and
// the document below it hold no state of their own beyond a caret.

/**
 * How long a keystroke waits before it is sent.
 *
 * Blur-only was designed for one input at a time. A panel holds several,
 * tabbing between them should not feel like several separate saves, and a panel
 * that stays open has no natural "done" moment — so a pause is the commit, and
 * blur only flushes what the pause has not sent yet.
 */
const autosaveDelay = 400

/**
 * Saving, saved, failed. Autosave without feedback is indistinguishable from
 * data loss.
 */
export type SaveState = "idle" | "saving" | "saved" | "failed"

export function useResumeEditor(resumeId: string) {
  const utils = api.useContext()
  const resumeQuery = api.resume.readById.useQuery(
    { resumeId },
    { enabled: !!resumeId }
  )

  const [requested, setRequested] = useState<ResumeSelection | null>(null)

  const save = useSaveState()
  const patch = useCallback(
    (change: (resume: SavedResume) => SavedResume) => {
      utils.resume.readById.setData({ resumeId }, (current) =>
        current ? change(current) : current
      )
    },
    [resumeId, utils]
  )

  const resync = useCallback(
    () => void utils.resume.readById.invalidate({ resumeId }),
    [resumeId, utils]
  )

  const fields = useFieldAutosave({ resumeId, patch, resync, save })
  const structure = useStructureMutations({ resumeId, patch, resync, save })

  const resume = resumeQuery.data

  // A section or row that has just been deleted must not stay selected, so this
  // is derived rather than remembered: the panel cannot go on offering fields
  // for a thing that is no longer on the resume.
  const selected =
    resume && requested && existsIn(resume, requested) ? requested : null

  return {
    resume,
    errorMessage: resumeQuery.isError ? "Resume not found." : null,
    saveState: save.state,
    selected,
    onSelect: setRequested,
    /**
     * Back to the resume itself, which is what owns its sections — so adding,
     * reordering and removing one is reachable again after anything else has
     * been selected.
     */
    onClearSelection: () => setRequested(null),
    /** Every keystroke: the document updates now, the server a pause later. */
    onFieldChange: fields.change,
    /** Leaving an input sends whatever the pause has not sent yet. */
    onFieldCommit: fields.flush,
    panel: resume
      ? buildPanel({ resume, selected, select: setRequested, structure })
      : null,
    addSection: structure.addSection
  }
}

/** True while the thing the panel is editing is still on the resume. */
function existsIn(resume: SavedResume, selection: ResumeSelection) {
  switch (selection.kind) {
    case "header":
      return true
    case "section":
      return resume.sections.some((row) => row.id === selection.sectionId)
    case "row":
      return resume[selection.list].some((row) => row.id === selection.rowId)
  }
}

/**
 * Saving, saved and failed, across every mutation the panel can fire.
 *
 * One counter rather than one flag per mutation: the user is asking "is my work
 * safe", and that question is about all of it at once.
 */
function useSaveState() {
  const inFlight = useRef(0)
  const [state, setState] = useState<SaveState>("idle")

  return {
    state,
    begin: () => {
      inFlight.current += 1
      setState("saving")
    },
    end: (ok: boolean) => {
      inFlight.current -= 1

      if (!ok) {
        setState("failed")
        return
      }

      setState(inFlight.current > 0 ? "saving" : "saved")
    }
  }
}

type SaveHandle = ReturnType<typeof useSaveState>

/**
 * Debounced autosave for one field write, with the document updated as it is
 * typed and rolled back if the write is refused.
 *
 * Two behaviours carried over deliberately: the rollback captures only the
 * field being changed, so it cannot undo edits that already succeeded; and the
 * refetch waits for every write that is still outstanding, so it cannot serve a
 * response predating one.
 */
function useFieldAutosave({
  resumeId,
  patch,
  resync,
  save
}: {
  resumeId: string
  patch: (change: (resume: SavedResume) => SavedResume) => void
  resync: () => void
  save: SaveHandle
}) {
  const utils = api.useContext()

  // What each pending path looked like before the user started typing into it,
  // and the timer that will send it.
  const pending = useRef(
    new Map<
      string,
      {
        value: string
        previous: string | undefined
        timer: ReturnType<typeof setTimeout>
      }
    >()
  )

  /**
   * What each in-flight path looked like before the user started typing into
   * it. Narrow on purpose: reverting the whole cached resume would also undo
   * edits that had already succeeded.
   */
  const rollback = useRef(new Map<string, string | undefined>())

  const writesInFlight = useRef(0)

  const { mutate } = api.resume.updateField.useMutation({
    onError: (error, variables) => {
      const previous = rollback.current.get(variables.path)
      const target = parseResumeFieldPath(variables.path)

      if (target && previous !== undefined) {
        patch((resume) => writeField(resume, target, previous))
      }

      rollback.current.delete(variables.path)
      save.end(false)

      console.error(error)
      toast.error("Could not save that change.")
    },
    onSuccess: (_data, variables) => {
      rollback.current.delete(variables.path)
      save.end(true)
    },
    onSettled: () => {
      writesInFlight.current -= 1

      /*
        A refetch while anything is outstanding would serve a response that
        predates it and clobber its optimistic value — and "outstanding"
        includes a keystroke still waiting out its pause, not only one already
        in the air. Typing, waiting for that save, then typing again during the
        refetch it triggered is exactly how the second keystroke would be lost.
      */
      if (writesInFlight.current > 0 || pending.current.size > 0) return

      resync()
    }
  })

  const send = useCallback(
    (path: string) => {
      const entry = pending.current.get(path)

      if (!entry) return

      pending.current.delete(path)
      clearTimeout(entry.timer)

      // Captured before the write rather than read back at failure time: by
      // then the cache already holds what was typed.
      if (!rollback.current.has(path)) {
        rollback.current.set(path, entry.previous)
      }

      writesInFlight.current += 1
      save.begin()

      mutate({ resumeId, path, value: entry.value })
    },
    [mutate, resumeId, save]
  )

  const change = useCallback(
    (path: string, value: string) => {
      const target = parseResumeFieldPath(path)

      if (!target) {
        console.error(`Not an editable resume field: ${path}`)
        return
      }

      const existing = pending.current.get(path)

      if (existing) clearTimeout(existing.timer)

      const previous =
        existing?.previous ??
        readFieldValue(utils.resume.readById.getData({ resumeId }), target)

      // The document is the preview, so it updates on the keystroke; only the
      // request waits for the pause.
      patch((resume) => writeField(resume, target, value))

      pending.current.set(path, {
        value,
        previous,
        timer: setTimeout(() => send(path), autosaveDelay)
      })
    },
    [patch, resumeId, send, utils]
  )

  const flush = useCallback(() => {
    for (const path of [...pending.current.keys()]) send(path)
  }, [send])

  // A pending keystroke must not be lost because the tab closed or the route
  // changed a moment after it.
  useEffect(() => {
    const timers = pending.current

    return () => {
      for (const entry of timers.values()) clearTimeout(entry.timer)
    }
  }, [])

  return { change, flush }
}

/**
 * Everything that changes the *set* of things on the resume, rather than one
 * string on it.
 *
 * The ones whose result can be computed here patch the cache first, so the
 * document moves with the click rather than a round trip later. Adding is the
 * exception: a new row's id is the server's to mint, and inventing one locally
 * would mean a row the panel could select and then lose.
 *
 * All of them resync afterwards, because a refused structural write is one the
 * local copy cannot repair by itself.
 */
function useStructureMutations({
  resumeId,
  patch,
  resync,
  save
}: {
  resumeId: string
  patch: (change: (resume: SavedResume) => SavedResume) => void
  resync: () => void
  save: SaveHandle
}): StructureActions {
  const settle = {
    onMutate: () => save.begin(),
    onError: (error: unknown) => {
      console.error(error)
      toast.error("Could not save that change.")
      save.end(false)
      resync()
    },
    onSuccess: () => save.end(true),
    onSettled: () => resync()
  }

  const setBullets = api.resume.setBullets.useMutation(settle)
  const addRow = api.resume.addRow.useMutation(settle)
  const removeRow = api.resume.removeRow.useMutation(settle)
  const reorderRows = api.resume.reorderRows.useMutation(settle)
  const addSection = api.section.add.useMutation(settle)
  const removeSection = api.section.remove.useMutation(settle)
  const reorderSections = api.section.reorder.useMutation(settle)
  const setContent = api.section.setContent.useMutation(settle)

  return {
    setBullets: (rowId, bullets) => {
      patch((resume) => ({
        ...resume,
        experience: resume.experience.map((job) =>
          job.id === rowId ? { ...job, bullets } : job
        )
      }))

      setBullets.mutate({ resumeId, rowId, bullets })
    },

    addRow: (list) => addRow.mutate({ resumeId, section: apiNameFor(list) }),

    removeRow: (list, rowId) => {
      patch((resume) => ({
        ...resume,
        [list]: resume[list].filter((row) => row.id !== rowId)
      }))

      removeRow.mutate({ resumeId, section: apiNameFor(list), rowId })
    },

    reorderRows: (list, rowIds) => {
      patch((resume) => ({
        ...resume,
        [list]: byIds<{ id: string }>(resume[list], rowIds)
      }))

      reorderRows.mutate({ resumeId, section: apiNameFor(list), rowIds })
    },

    addSection: (label: string, componentType: SectionComponentType) =>
      addSection.mutate({ resumeId, label, componentType }),

    removeSection: (sectionId) => {
      patch((resume) => ({
        ...resume,
        sections: resume.sections.filter((row) => row.id !== sectionId)
      }))

      removeSection.mutate({ resumeId, sectionId })
    },

    reorderSections: (sectionIds) => {
      patch((resume) => ({
        ...resume,
        // The document draws sections in `position` order, so a reorder has to
        // move the positions rather than only the array.
        sections: byIds(resume.sections, sectionIds).map((row, position) => ({
          ...row,
          position
        }))
      }))

      reorderSections.mutate({ resumeId, sectionIds })
    },

    setContent: (sectionId, content: AnySectionContent) => {
      patch((resume) => ({
        ...resume,
        sections: resume.sections.map((row) =>
          row.id === sectionId ? { ...row, content } : row
        )
      }))

      setContent.mutate({ resumeId, sectionId, content })
    }
  }
}

/**
 * The rows in the order `ids` names them.
 *
 * A reorder sends the whole order, so this is the same rewrite the server does
 * — and an id the list does not hold is dropped rather than inserted, which is
 * the write the server would refuse anyway.
 */
function byIds<Row extends { id: string }>(rows: Row[], ids: string[]): Row[] {
  const found = ids
    .map((id) => rows.find((row) => row.id === id))
    .filter((row): row is Row => !!row)

  return found.length === rows.length ? found : rows
}
