"use client"

import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"
import { parseResumeFieldPath } from "~/lib/resume-field-path"
import { type ResumeSelection, type RowListName } from "~/lib/resume-selection"
import {
  type ResumeStyle,
  resumeStyleStamp,
  toResumeStyle
} from "~/lib/resume-style"
import { type AnySectionContent } from "~/lib/section-content"
import { api } from "~/utils/api"
import {
  readFieldValue,
  type SavedResume,
  writeField
} from "~/features/resume/resume-field-lens"
import {
  type AddedSectionPreset,
  buildPanel,
  type PanelField,
  type PanelModel,
  resolveSelection,
  type StructureActions
} from "~/features/resume/resume-panel-model"

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

/**
 * The editing surface behind the panel.
 *
 * Everything the panel can do resolves to a mutation, and everything the
 * document draws comes from one query — so this owns both, and the panel and
 * the document below it hold no state of their own beyond a caret.
 */
export function useResumeEditor(resumeId: string) {
  const utils = api.useContext()
  const resumeQuery = api.resume.readById.useQuery(
    { resumeId },
    { enabled: !!resumeId }
  )

  const t = useTranslations("resumeEditor")
  const panelT = useTranslations("resumePanel")
  const contentT = useTranslations("sectionContent")

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

  const cache = useMemo(
    () => ({ resumeId, patch, resync, save }),
    [resumeId, patch, resync, save]
  )

  const fields = useFieldAutosave(cache)
  const structure = useStructureMutations(cache, fields)
  const style = useStylePicker(cache)

  const resume = resumeQuery.data

  // A section or row that has just been deleted must not stay selected, so this
  // is derived rather than remembered: the panel cannot go on offering fields
  // for a thing that is no longer on the resume.
  const selected =
    resume && requested && resolveSelection(resume, requested)
      ? requested
      : null

  return {
    resume,
    errorMessage: resumeQuery.isError ? t("notFound") : null,
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
      ? withUnsavedText(
          buildPanel({
            resume,
            selected,
            select: setRequested,
            structure,
            t: panelT,
            contentT
          }),
          fields.unsaved
        )
      : null,
    addSection: structure.addSection,
    /** The direction the resume is saved in, which is what the picker marks. */
    style: toResumeStyle(resume?.style),
    /** A direction being previewed and not yet chosen, or nothing. */
    previewStyle: style.previewed,
    onStylePreview: style.preview,
    onStyleChange: style.choose
  }
}

/**
 * Previewing a style, and then choosing one.
 *
 * Previewing is local and writes nothing: the document redraws in the style
 * being pointed at and goes back when the pointer leaves, so a user sees a
 * direction against their own work history before committing to it. Choosing
 * patches the cache first so the click lands instantly, then sends it.
 *
 * The whole `ResumeStyleStamp` is patched, not just the name — the two are one
 * decision and the server writes the same pair.
 */
function useStylePicker(cache: ResumeCache) {
  const { resumeId, patch } = cache
  const settle = useSettle(cache)
  const setStyle = api.resume.setStyle.useMutation(settle)
  const [previewed, setPreviewed] = useState<ResumeStyle | null>(null)

  return {
    previewed,
    preview: setPreviewed,
    choose: (style: ResumeStyle) => {
      setPreviewed(null)
      patch((resume) => ({ ...resume, ...resumeStyleStamp(style) }))
      setStyle.mutate({ resumeId, style })
    }
  }
}

/**
 * The panel, showing what the user typed into a field whose save was refused.
 *
 * The document rolls back, because it is the preview and has to show what is
 * actually stored — but the input keeps the sentence, so a network error does
 * not eat one.
 */
function withUnsavedText(
  panel: PanelModel,
  unsaved: ReadonlyMap<string, string>
): PanelModel {
  if (!unsaved.size) return panel

  const restore = (field: PanelField): PanelField => {
    const typed = unsaved.get(field.path)

    return typed === undefined ? field : { ...field, value: typed }
  }

  return {
    ...panel,
    fields: panel.fields.map(restore),
    lists: panel.lists.map((list) => ({
      ...list,
      items: list.items.map((item) => ({
        ...item,
        fields: item.fields.map(restore)
      }))
    }))
  }
}

/**
 * Saving, saved and failed, across every mutation the panel can fire.
 *
 * One indicator rather than one per mutation: the user is asking "is my work
 * safe", and that question is about all of it at once. Which is also why a
 * failed field write is remembered by path rather than only shown once — a
 * later success elsewhere must not report the resume as saved while a sentence
 * the user typed is still only in the panel.
 */
function useSaveState() {
  const inFlight = useRef(0)
  const unsaved = useRef(new Set<string>())
  const [state, setState] = useState<SaveState>("idle")

  const publish = useCallback((settled: SaveState) => {
    setState(unsaved.current.size > 0 ? "failed" : settled)
  }, [])

  const begin = useCallback(() => {
    inFlight.current += 1
    publish("saving")
  }, [publish])

  const end = useCallback(
    (ok: boolean) => {
      inFlight.current -= 1

      if (!ok) {
        setState("failed")
        return
      }

      publish(inFlight.current > 0 ? "saving" : "saved")
    },
    [publish]
  )

  /** This field's text is still only in the panel, until it saves. */
  const markUnsaved = useCallback((path: string) => {
    unsaved.current.add(path)
    setState("failed")
  }, [])

  const markSaved = useCallback((path: string) => {
    unsaved.current.delete(path)
  }, [])

  return useMemo(
    () => ({ state, begin, end, markUnsaved, markSaved }),
    [state, begin, end, markUnsaved, markSaved]
  )
}

type SaveHandle = ReturnType<typeof useSaveState>

/**
 * The one cached copy of the resume every write goes through: which resume it
 * is, how to change it before the server has answered, how to refetch it, and
 * where the save indicator lives.
 *
 * One handle rather than four parameters that always travel together and mean
 * nothing apart.
 */
type ResumeCache = {
  resumeId: string
  patch: (change: (resume: SavedResume) => SavedResume) => void
  resync: () => void
  save: SaveHandle
}

/**
 * What a structural write has to do about the keystrokes still waiting out
 * their pause, before it changes the set of things they address.
 */
type PendingFields = {
  /** Sends everything the pause has not sent yet. */
  flush: () => void
  /** Drops the pending writes addressed inside `prefix`, unsent. */
  discard: (prefix: string) => void
}

/**
 * Debounced autosave for one field write, with the document updated as it is
 * typed and rolled back if the write is refused.
 *
 * Two behaviours carried over deliberately: the rollback captures only the
 * field being changed, so it cannot undo edits that already succeeded; and the
 * refetch waits for every write that is still outstanding, so it cannot serve a
 * response predating one.
 */
function useFieldAutosave({ resumeId, patch, resync, save }: ResumeCache) {
  const t = useTranslations("resumeEditor")

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

  const { unsaved, remember, forget } = useUnsavedText()

  const { mutate } = api.resume.updateField.useMutation({
    onError: (error, variables) => {
      const previous = rollback.current.get(variables.path)
      const target = parseResumeFieldPath(variables.path)

      // The document shows what is stored, so it goes back — but the panel
      // keeps the sentence, which is the half of this the user would miss.
      if (target && previous !== undefined) {
        patch((resume) => writeField(resume, target, previous))
      }

      remember(variables.path, variables.value)

      rollback.current.delete(variables.path)
      save.markUnsaved(variables.path)
      save.end(false)

      console.error(error)
      toast.error(t("saveFailed"))
    },
    onSuccess: (_data, variables) => {
      rollback.current.delete(variables.path)
      forget(variables.path)
      save.markSaved(variables.path)
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

      // Typing into a field whose last write failed is the retry: the cache
      // holds what is being typed again, so the panel has nothing to restore.
      forget(path)

      // The document is the preview, so it updates on the keystroke; only the
      // request waits for the pause.
      patch((resume) => writeField(resume, target, value))

      pending.current.set(path, {
        value,
        previous,
        timer: setTimeout(() => send(path), autosaveDelay)
      })
    },
    [forget, patch, resumeId, send, utils]
  )

  const flush = useCallback(() => {
    for (const path of [...pending.current.keys()]) send(path)
  }, [send])

  /**
   * A structural write rewrites a whole container — the bullets of a job, the
   * content of a section — and it carries the typed text with it, because the
   * cache it was built from already holds every keystroke. Sending the
   * debounced field write as well would land it *after* the reorder, at an
   * index that by then names a different bullet. So the container write
   * supersedes them, and removing a row drops writes to a row about to go.
   */
  const discard = useCallback((prefix: string) => {
    for (const [path, entry] of pending.current) {
      if (!path.startsWith(prefix)) continue

      clearTimeout(entry.timer)
      pending.current.delete(path)
    }
  }, [])

  useExitFlush(
    flush,
    () =>
      pending.current.size > 0 ||
      writesInFlight.current > 0 ||
      // Text a refused write left behind is only in the panel, so leaving the
      // page is the moment it is actually lost.
      unsaved.size > 0
  )

  return { change, flush, discard, unsaved }
}

/**
 * What the user typed into a field whose write was refused, by path.
 *
 * Kept beside the cache rather than in it: the cache is what is stored, and the
 * whole point of this is the one string that is not.
 */
function useUnsavedText() {
  const [unsaved, setUnsaved] = useState<ReadonlyMap<string, string>>(new Map())

  const remember = useCallback((path: string, value: string) => {
    setUnsaved((current) => new Map(current).set(path, value))
  }, [])

  const forget = useCallback((path: string) => {
    setUnsaved((current) => {
      if (!current.has(path)) return current

      const next = new Map(current)
      next.delete(path)

      return next
    })
  }, [])

  return { unsaved, remember, forget }
}

/**
 * Sends whatever is still waiting out its pause when the editor goes away.
 *
 * A pending keystroke must not be lost because the tab closed or the route
 * changed a moment after it, so both exits send rather than only cancelling the
 * timer — a debounce that throws away its last keystroke on the way out is a
 * debounce that eats sentences. Leaving the page can only be *asked* to wait,
 * so that path does both: it sends, and it warns while anything is still
 * unsent.
 */
function useExitFlush(flush: () => void, isOutstanding: () => boolean) {
  const latest = useRef({ flush, isOutstanding })

  useEffect(() => {
    latest.current = { flush, isOutstanding }
  })

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      latest.current.flush()

      if (!latest.current.isOutstanding()) return

      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", onBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      latest.current.flush()
    }
  }, [])
}

/**
 * Everything that changes the *set* of things on the resume, rather than one
 * string on it.
 *
 * Split in two because eight mutations in one hook is a hook read by scrolling:
 * the rows of a core section on one side, sections and their content on the
 * other, which is also how the procedures behind them are split.
 */
function useStructureMutations(
  cache: ResumeCache,
  fields: PendingFields
): StructureActions {
  return {
    ...useRowMutations(cache, fields),
    ...useSectionMutations(cache, fields)
  }
}

/**
 * What every structural mutation does about saving, failing and refetching.
 *
 * All of them resync afterwards, because a refused structural write is one the
 * local copy cannot repair by itself.
 */
function useSettle({ resync, save }: ResumeCache) {
  const t = useTranslations("resumeEditor")

  return {
    onMutate: () => save.begin(),
    onError: (error: unknown) => {
      console.error(error)
      toast.error(t("saveFailed"))
      save.end(false)
      resync()
    },
    onSuccess: () => save.end(true),
    onSettled: () => resync()
  }
}

/**
 * The jobs, schools and skill groups of a core section, and a job's bullets.
 *
 * The ones whose result can be computed here patch the cache first, so the
 * document moves with the click rather than a round trip later. Adding is the
 * exception: a new row's id is the server's to mint, and inventing one locally
 * would mean a row the panel could select and then lose.
 */
function useRowMutations(cache: ResumeCache, fields: PendingFields) {
  const { resumeId, patch } = cache
  const settle = useSettle(cache)

  const setBullets = api.resume.setBullets.useMutation(settle)
  const addRow = api.resume.addRow.useMutation(settle)
  const removeRow = api.resume.removeRow.useMutation(settle)
  const reorderRows = api.resume.reorderRows.useMutation(settle)

  return {
    setBullets: (rowId: string, bullets: string[]) => {
      // This write already carries every keystroke: `bullets` came from the
      // cache, which is patched as the user types.
      fields.discard(`experience.${rowId}.bullets.`)

      patch((resume) => ({
        ...resume,
        experience: resume.experience.map((job) =>
          job.id === rowId ? { ...job, bullets } : job
        )
      }))

      setBullets.mutate({ resumeId, rowId, bullets })
    },

    addRow: (list: RowListName) => {
      fields.flush()
      addRow.mutate({ resumeId, section: list })
    },

    removeRow: (list: RowListName, rowId: string) => {
      fields.discard(`${list}.${rowId}.`)
      fields.flush()

      patch((resume) => ({
        ...resume,
        [list]: resume[list].filter((row) => row.id !== rowId)
      }))

      removeRow.mutate({ resumeId, section: list, rowId })
    },

    reorderRows: (list: RowListName, rowIds: string[]) => {
      fields.flush()

      patch((resume) => ({
        ...resume,
        [list]: byIds<{ id: string }>(resume[list], rowIds)
      }))

      reorderRows.mutate({ resumeId, section: list, rowIds })
    }
  }
}

/** The sections a resume is made of, and what a custom one holds. */
function useSectionMutations(cache: ResumeCache, fields: PendingFields) {
  const { resumeId, patch } = cache
  const settle = useSettle(cache)

  const addSection = api.section.add.useMutation(settle)
  const removeSection = api.section.remove.useMutation(settle)
  const reorderSections = api.section.reorder.useMutation(settle)
  const setContent = api.section.setContent.useMutation(settle)

  return {
    addSection: (preset: AddedSectionPreset) => {
      fields.flush()
      addSection.mutate({
        resumeId,
        label: preset.label,
        presetId: preset.id,
        componentType: preset.componentType
      })
    },

    removeSection: (sectionId: string) => {
      fields.discard(`section.${sectionId}.`)
      fields.flush()

      patch((resume) => ({
        ...resume,
        sections: resume.sections.filter((row) => row.id !== sectionId)
      }))

      removeSection.mutate({ resumeId, sectionId })
    },

    reorderSections: (sectionIds: string[]) => {
      fields.flush()

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

    setContent: (sectionId: string, content: AnySectionContent) => {
      // Same reason as `setBullets`: `content` was read out of the cache the
      // keystrokes have already been patched into.
      fields.discard(`section.${sectionId}.content.`)

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
