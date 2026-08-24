"use client"

import { useState } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import {
  type SectionComponentType,
  sectionComponentTypes
} from "~/lib/section-content"
import { MarkdownField } from "~/features/resume/markdown-field"
import {
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
  onAddSection?: (label: string, componentType: SectionComponentType) => void
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

      {field.input === "markdown" ? (
        <MarkdownField
          id={id}
          onChange={(value) => onChange(field.path, value)}
          onCommit={onCommit}
          value={field.value}
        />
      ) : field.input === "textarea" ? (
        <Textarea
          id={id}
          onBlur={onCommit}
          onChange={(event) => onChange(field.path, event.target.value)}
          rows={3}
          value={field.value}
        />
      ) : (
        <Input
          id={id}
          onBlur={onCommit}
          onChange={(event) => onChange(field.path, event.target.value)}
          value={field.value}
        />
      )}
    </div>
  )
}

/**
 * A repeated thing: the bullets of a job, the entries of a section, the items
 * of a list.
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
  return (
    <section className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {list.title}
      </h3>

      {!list.items.length && (
        <p className="text-sm text-neutral-500">No {list.noun}s yet.</p>
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
                  Up
                </Button>

                <Button
                  disabled={index === list.items.length - 1}
                  onClick={() => list.onMove?.(index, index + 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Down
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
                Remove
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
          Add {list.noun}
        </Button>
      )}
    </section>
  )
}

/** What each shape is called where the user picks one. */
const shapeLabels: Record<SectionComponentType, string> = {
  richText: "Paragraph",
  twoColumn: "Two columns",
  list: "List",
  tagList: "Tags",
  iconList: "Icons"
}

/**
 * Adding a section, with its shape chosen up front.
 *
 * The shape is fixed at creation because it decides what the section's content
 * *is*: changing it afterwards would mean converting one payload into another,
 * and there is no honest conversion from a paragraph to a set of tags.
 */
function AddSection({
  onAdd
}: {
  onAdd: (label: string, componentType: SectionComponentType) => void
}) {
  const [label, setLabel] = useState("")
  const [componentType, setComponentType] =
    useState<SectionComponentType>("richText")

  const add = () => {
    if (!label.trim()) return

    onAdd(label.trim(), componentType)
    setLabel("")
  }

  return (
    <section className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Add a section
      </h3>

      <Label htmlFor="new-section-label">Name</Label>
      <Input
        id="new-section-label"
        onChange={(event) => setLabel(event.target.value)}
        placeholder="Summary"
        value={label}
      />

      <Label htmlFor="new-section-shape">Shape</Label>
      <select
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        id="new-section-shape"
        onChange={(event) =>
          setComponentType(event.target.value as SectionComponentType)
        }
        value={componentType}
      >
        {sectionComponentTypes.map((type) => (
          <option key={type} value={type}>
            {shapeLabels[type]}
          </option>
        ))}
      </select>

      <Button disabled={!label.trim()} onClick={add} type="button">
        Add section
      </Button>
    </section>
  )
}
