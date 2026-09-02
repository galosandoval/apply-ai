"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  type DisplaySectionPreset,
  searchSectionCatalog
} from "~/lib/section-catalog"
import { MarkdownField } from "~/components/markdown-field"
import {
  type AddedSectionPreset,
  type PanelAction,
  type PanelField,
  type PanelList,
  type PanelModel
} from "~/features/resume/resume-panel-model"

/**
 * The panel that edits whatever is selected.
 *
 * It renders a `PanelModel` and nothing else: which fields exist, what they are
 * called and what can be added to them are decided by the selected thing's
 * shape, not here. That is what keeps a sixth section type from meaning a sixth
 * panel.
 */
export function ResumePanel({
  panel,
  onChange,
  onCommit,
  onAddSection,
  onBack
}: {
  panel: PanelModel
  onChange: (path: string, value: string) => void
  onCommit: () => void
  /** Offered on the resume itself, which is the thing that owns sections. */
  onAddSection?: (preset: AddedSectionPreset) => void
  /**
   * Back to the resume. Present whenever something is selected: clicking past
   * the document also clears it, but on a phone the document is behind a tab
   * and there is nothing there to click past.
   */
  onBack?: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {onBack && (
        <Button
          className="self-start"
          onClick={onBack}
          size="sm"
          type="button"
          variant="ghost"
        >
          ← Resume
        </Button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{panel.title}</h2>

        <div className="flex gap-1">
          {panel.actions.map((action) => (
            <ActionButton action={action} key={action.label} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {panel.fields.map((field) => (
          <Field
            field={field}
            key={field.path}
            onChange={onChange}
            onCommit={onCommit}
          />
        ))}
      </div>

      {panel.lists.map((list) => (
        <List
          key={list.title}
          list={list}
          onChange={onChange}
          onCommit={onCommit}
        />
      ))}

      {onAddSection && <AddSection onAdd={onAddSection} />}
    </div>
  )
}

function ActionButton({ action }: { action: PanelAction }) {
  return (
    <Button
      onClick={action.onClick}
      size="sm"
      type="button"
      variant={action.variant === "destructive" ? "destructive" : "outline"}
    >
      {action.label}
    </Button>
  )
}

/**
 * One editable string.
 *
 * Keyed by path, which is keyed by row id — so reordering cannot carry what is
 * in this input to the row that took its place.
 */
function Field({
  field,
  onChange,
  onCommit
}: {
  field: PanelField
  onChange: (path: string, value: string) => void
  onCommit: () => void
}) {
  const id = `field-${field.path}`

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{field.label}</Label>

      <FieldControl
        field={field}
        id={id}
        onChange={(value) => onChange(field.path, value)}
        onCommit={onCommit}
      />
    </div>
  )
}

/** The input the field's shape asks for: a line, or markdown with its toolbar. */
function FieldControl({
  field,
  id,
  onChange,
  onCommit
}: {
  field: PanelField
  id: string
  onChange: (value: string) => void
  onCommit: () => void
}) {
  if (field.input === "markdown") {
    return (
      <MarkdownField
        id={id}
        onChange={onChange}
        onCommit={onCommit}
        value={field.value}
      />
    )
  }

  return (
    <Input
      id={id}
      onBlur={onCommit}
      onChange={(event) => onChange(event.target.value)}
      value={field.value}
    />
  )
}

/**
 * A repeated thing: the entries of a core section, the elements of a custom
 * section's content.
 *
 * Move up and move down rather than dragging. The requirement is that
 * reordering exists, and two buttons work on a phone, in a screen reader, and
 * on the first day.
 */
function List({
  list,
  onChange,
  onCommit
}: {
  list: PanelList
  onChange: (path: string, value: string) => void
  onCommit: () => void
}) {
  const t = useTranslations("resumePanel")

  return (
    <section className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {list.title}
      </h3>

      {!list.items.length && (
        <p className="text-sm text-neutral-500">
          {t(`nouns.${list.noun}.empty`)}
        </p>
      )}

      {list.items.map((item, index) => (
        <div
          className="flex flex-col gap-2 rounded-md border border-neutral-200 p-2"
          key={item.key}
        >
          {item.label !== undefined && (
            <button
              className="text-left text-sm font-medium underline-offset-2 hover:underline"
              onClick={item.onSelect}
              type="button"
            >
              {item.label}
            </button>
          )}

          {item.fields.map((field) => (
            <Field
              field={field}
              key={field.path}
              onChange={onChange}
              onCommit={onCommit}
            />
          ))}

          <div className="flex gap-1">
            {list.onMove && (
              <>
                <Button
                  disabled={index === 0}
                  onClick={() => list.onMove?.(index, index - 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("up")}
                </Button>

                <Button
                  disabled={index === list.items.length - 1}
                  onClick={() => list.onMove?.(index, index + 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("down")}
                </Button>
              </>
            )}

            {list.onRemove && (
              <Button
                onClick={() => list.onRemove?.(index)}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t("remove")}
              </Button>
            )}
          </div>
        </div>
      ))}

      {list.onAdd && (
        <Button
          onClick={list.onAdd}
          size="sm"
          type="button"
          variant="secondary"
        >
          {t(`nouns.${list.noun}.add`)}
        </Button>
      )}
    </section>
  )
}

/**
 * Adding a section, by name rather than by shape.
 *
 * A user adding "Certificates" is naming the *content* they have, not choosing
 * between a two-column frame and a tag row — so the picker offers named
 * sections and the shape comes with the one they pick. The label is an ordinary
 * field on the section afterwards, so a preset is a starting point and never a
 * decision the user is stuck with.
 *
 * The shape itself stays fixed at creation, which is the part that has not
 * changed: it decides what the section's content *is*, and there is no honest
 * conversion from a paragraph to a set of tags.
 */
function AddSection({
  onAdd
}: {
  onAdd: (preset: AddedSectionPreset) => void
}) {
  const t = useTranslations("resumePanel")
  const [query, setQuery] = useState("")
  const catalogT = useTranslations("sectionCatalog")
  const groups = searchSectionCatalog(query, catalogT)

  const add = (preset: DisplaySectionPreset) => {
    onAdd(preset)
    setQuery("")
  }

  return (
    <section className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {t("addSectionTitle")}
      </h3>

      <Label className="sr-only" htmlFor="section-search">
        {t("searchSections")}
      </Label>
      <Input
        id="section-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("searchSections")}
        value={query}
      />

      {groups.length === 0 ? (
        <p className="py-2 text-sm text-neutral-500">
          {t("noSectionMatch", { query: query.trim() })}
        </p>
      ) : (
        <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
          {groups.map((group) => (
            <div className="flex flex-col gap-1" key={group.id}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {group.title}
              </h4>

              {group.presets.map((preset) => (
                <button
                  className="rounded-md px-2 py-1.5 text-left hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none"
                  key={preset.id}
                  onClick={() => add(preset)}
                  type="button"
                >
                  <span className="block text-sm font-medium">
                    {preset.label}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {preset.hint}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
