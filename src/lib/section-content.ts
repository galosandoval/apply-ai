/**
 * What a section is and what it may hold.
 *
 * Shared by the client and the server: the same discriminator decides which
 * component draws a section, which paths can address its content, and which
 * payloads a write will accept.
 *
 * Everything that varies per component type lives in one entry of
 * `sectionComponents` — its schema, its empty value, its slice of the path
 * grammar, and how one string inside it is replaced. Adding a component type is
 * one tuple entry and one registry entry, not a hunt for every switch on it.
 */

import { z } from "zod"
import { moveItem } from "./move-item"

/**
 * Core kinds keep their typed rows — a `work` row's company, dates and bullets
 * are what make a resume machine-readable, so their structure is not the user's
 * to restructure. Only `custom` carries `content`.
 */
export const coreSectionKinds = ["experience", "education", "skills"] as const

export type CoreSectionKind = (typeof coreSectionKinds)[number]
export type SectionKind = CoreSectionKind | "custom"

export function isCoreSectionKind(kind: string): kind is CoreSectionKind {
  return (coreSectionKinds as readonly string[]).includes(kind)
}

/**
 * The shapes a section can draw as. Fixed by spec C, which renders them; this
 * module stores and validates the discriminator, and nothing more.
 */
export const sectionComponentTypes = [
  "richText",
  "twoColumn",
  "list",
  "tagList",
  "iconList"
] as const

export type SectionComponentType = (typeof sectionComponentTypes)[number]

export function isSectionComponentType(
  value: string
): value is SectionComponentType {
  return (sectionComponentTypes as readonly string[]).includes(value)
}

/**
 * The sections every resume starts with: what each is called, which shape it
 * draws as, and the order they are drawn in.
 *
 * One definition because two would drift. The server inserts a new resume's
 * rows from this, and the renderer falls back to it for a document that has no
 * rows yet — an unsaved draft, or a PDF payload. A resume that has its own
 * sections is drawn from those and never reads this.
 */
export const coreSectionDefaults: {
  kind: CoreSectionKind
  label: string
  componentType: SectionComponentType
}[] = [
  { kind: "skills", label: "Skills", componentType: "list" },
  { kind: "experience", label: "Experience", componentType: "twoColumn" },
  { kind: "education", label: "Education", componentType: "twoColumn" }
]

/**
 * Rich text is a **markdown string** in the constrained subset spec D defines —
 * bold, links, bullet lists. Not HTML: there is no sanitizer to get wrong, and
 * the value strips to clean text for a parser for free.
 */
const richTextContent = z.object({ markdown: z.string() })

const twoColumnContent = z.object({
  rows: z.array(z.object({ left: z.string(), right: z.string() }))
})

const listContent = z.object({ items: z.array(z.string()) })

const tagListContent = z.object({ tags: z.array(z.string()) })

const iconListContent = z.object({
  icons: z.array(z.object({ icon: z.string(), text: z.string() }))
})

export type SectionContent = {
  richText: z.infer<typeof richTextContent>
  twoColumn: z.infer<typeof twoColumnContent>
  list: z.infer<typeof listContent>
  tagList: z.infer<typeof tagListContent>
  iconList: z.infer<typeof iconListContent>
}

export type AnySectionContent = SectionContent[SectionComponentType]

/**
 * One string inside a custom section's content.
 *
 * Every shape belongs to exactly one component type, so the path alone says
 * which component the write is for — which is how a write addressed in one
 * component's shape can be refused on a section that renders as another.
 */
export type SectionContentTarget =
  | { componentType: "richText"; field: "markdown" }
  | { componentType: "list"; index: number }
  | { componentType: "tagList"; index: number }
  | { componentType: "twoColumn"; index: number; side: "left" | "right" }
  | { componentType: "iconList"; index: number; field: "icon" | "text" }

type ContentTargetIn<Type extends SectionComponentType> = Extract<
  SectionContentTarget,
  { componentType: Type }
>

/**
 * Everything that differs between one component type and the next.
 *
 * `empty` is a factory rather than a value so no two sections ever share one.
 * `field` is the segment a content path opens with, and `parse` reads what
 * follows it; `format` renders the whole path back. `replace` rewrites one
 * string of an already-valid content payload, or returns `null` when the target
 * names an element that isn't there — writing past the end of a list would
 * otherwise pad it with holes.
 */
type ComponentSpec<Type extends SectionComponentType> = {
  field: string
  schema: z.ZodObject<z.ZodRawShape>
  empty: () => SectionContent[Type]
  parse: (tail: string[]) => ContentTargetIn<Type> | null
  format: (target: ContentTargetIn<Type>) => string
  replace: (
    content: SectionContent[Type],
    target: ContentTargetIn<Type>,
    value: string
  ) => SectionContent[Type] | null
  read: (
    content: SectionContent[Type],
    target: ContentTargetIn<Type>
  ) => string | null
  /** Fields that are not part of a repeated element — rich text's whole body. */
  fields: (content: SectionContent[Type]) => SectionContentField[]
  /** The repeated part, for the shapes that have one. Rich text does not. */
  collection: Collection<Type> | null
}

/**
 * One string of a section's content, as the panel edits it.
 *
 * The panel is generated from this rather than written per component type: a
 * sixth shape is a registry entry, not a new panel, which is the only way the
 * editor stays as small as the renderer it edits.
 */
export type SectionContentField = {
  label: string
  target: SectionContentTarget
  value: string
  /** A plain line, or the constrained markdown subset with its toolbar. */
  input: "text" | "markdown"
}

/** One repeated element of a section's content — a row, an item, a tag. */
export type SectionContentEntry = {
  index: number
  fields: SectionContentField[]
}

/**
 * The repeated part of a shape: how many there are, how one reads, and how the
 * set of them changes.
 *
 * Adding, removing and moving are the same three array operations everywhere,
 * so they are built once from an accessor pair rather than written per shape —
 * see `collectionOf`.
 */
type Collection<Type extends SectionComponentType> = {
  /** What one element is called, for the add and remove buttons. */
  noun: string
  count: (content: SectionContent[Type]) => number
  fields: (
    content: SectionContent[Type],
    index: number
  ) => SectionContentField[]
  add: (content: SectionContent[Type]) => SectionContent[Type]
  remove: (content: SectionContent[Type], index: number) => SectionContent[Type]
  move: (
    content: SectionContent[Type],
    from: number,
    to: number
  ) => SectionContent[Type]
}

/**
 * A collection built from an accessor pair, so each shape says only what its
 * elements are and what one blank one looks like.
 */
function collectionOf<Type extends SectionComponentType, Element>({
  noun,
  get,
  set,
  empty,
  fields
}: {
  noun: string
  get: (content: SectionContent[Type]) => Element[]
  set: (content: SectionContent[Type], items: Element[]) => SectionContent[Type]
  empty: () => Element
  fields: (element: Element, index: number) => SectionContentField[]
}): Collection<Type> {
  return {
    noun,
    count: (content) => get(content).length,
    fields: (content, index) => {
      const element = get(content)[index]

      return element === undefined ? [] : fields(element, index)
    },
    add: (content) => set(content, [...get(content), empty()]),
    remove: (content, index) =>
      set(
        content,
        get(content).filter((_element, at) => at !== index)
      ),
    move: (content, from, to) => set(content, moveItem(get(content), from, to))
  }
}

const sectionComponents: {
  [Type in SectionComponentType]: ComponentSpec<Type>
} = {
  richText: {
    field: "markdown",
    schema: richTextContent,
    empty: () => ({ markdown: "" }),
    parse: (tail) =>
      tail.length === 0
        ? { componentType: "richText", field: "markdown" }
        : null,
    format: () => "markdown",
    replace: (_content, _target, value) => ({ markdown: value }),
    read: (content) => content.markdown,
    fields: (content) => [
      {
        label: "Text",
        target: { componentType: "richText", field: "markdown" },
        value: content.markdown,
        input: "markdown"
      }
    ],
    // A block of prose is one field, not a list of them: the bullet list inside
    // it is markdown's, and the app's list of things is the list component.
    collection: null
  },

  twoColumn: {
    field: "rows",
    schema: twoColumnContent,
    empty: () => ({ rows: [] }),
    parse: (tail) => {
      const index = toIndex(tail[0])
      const side = tail[1]

      if (index === null || tail.length !== 2) return null

      return side === "left" || side === "right"
        ? { componentType: "twoColumn", index, side }
        : null
    },
    format: (target) => `rows.${target.index}.${target.side}`,
    read: (content, target) =>
      content.rows[target.index]?.[target.side] ?? null,
    fields: () => [],
    collection: collectionOf({
      noun: "row",
      get: (content) => content.rows,
      set: (_content, rows) => ({ rows }),
      empty: () => ({ left: "", right: "" }),
      fields: (row, index) => [
        {
          label: "Left",
          target: { componentType: "twoColumn", index, side: "left" },
          value: row.left,
          input: "text"
        },
        {
          label: "Right",
          target: { componentType: "twoColumn", index, side: "right" },
          value: row.right,
          input: "text"
        }
      ]
    }),
    replace: (content, target, value) => {
      const row = content.rows[target.index]

      return row
        ? {
            rows: replace(content.rows, target.index, {
              ...row,
              [target.side]: value
            })
          }
        : null
    }
  },

  list: {
    field: "items",
    schema: listContent,
    empty: () => ({ items: [] }),
    parse: (tail) => {
      const index = tail.length === 1 ? toIndex(tail[0]) : null

      return index === null ? null : { componentType: "list", index }
    },
    format: (target) => `items.${target.index}`,
    read: (content, target) => content.items[target.index] ?? null,
    fields: () => [],
    collection: collectionOf({
      noun: "item",
      get: (content) => content.items,
      set: (_content, items) => ({ items }),
      empty: () => "",
      fields: (item, index) => [
        {
          label: "Item",
          target: { componentType: "list", index },
          value: item,
          input: "text"
        }
      ]
    }),
    replace: (content, target, value) => {
      const items = replaceString(content.items, target.index, value)

      return items && { items }
    }
  },

  tagList: {
    field: "tags",
    schema: tagListContent,
    empty: () => ({ tags: [] }),
    parse: (tail) => {
      const index = tail.length === 1 ? toIndex(tail[0]) : null

      return index === null ? null : { componentType: "tagList", index }
    },
    format: (target) => `tags.${target.index}`,
    read: (content, target) => content.tags[target.index] ?? null,
    fields: () => [],
    collection: collectionOf({
      noun: "tag",
      get: (content) => content.tags,
      set: (_content, tags) => ({ tags }),
      empty: () => "",
      fields: (tag, index) => [
        {
          label: "Tag",
          target: { componentType: "tagList", index },
          value: tag,
          input: "text"
        }
      ]
    }),
    replace: (content, target, value) => {
      const tags = replaceString(content.tags, target.index, value)

      return tags && { tags }
    }
  },

  iconList: {
    field: "icons",
    schema: iconListContent,
    empty: () => ({ icons: [] }),
    parse: (tail) => {
      const index = toIndex(tail[0])
      const leaf = tail[1]

      if (index === null || tail.length !== 2) return null

      return leaf === "icon" || leaf === "text"
        ? { componentType: "iconList", index, field: leaf }
        : null
    },
    format: (target) => `icons.${target.index}.${target.field}`,
    read: (content, target) =>
      content.icons[target.index]?.[target.field] ?? null,
    fields: () => [],
    collection: collectionOf({
      noun: "entry",
      get: (content) => content.icons,
      set: (_content, icons) => ({ icons }),
      empty: () => ({ icon: "", text: "" }),
      fields: (entry, index) => [
        {
          label: "Icon",
          target: { componentType: "iconList", index, field: "icon" },
          value: entry.icon,
          input: "text"
        },
        {
          label: "Label",
          target: { componentType: "iconList", index, field: "text" },
          value: entry.text,
          input: "text"
        }
      ]
    }),
    replace: (content, target, value) => {
      const icon = content.icons[target.index]

      return icon
        ? {
            icons: replace(content.icons, target.index, {
              ...icon,
              [target.field]: value
            })
          }
        : null
    }
  }
}

/**
 * The spec that handles `target`.
 *
 * Indexing by `target.componentType` always picks the entry written for exactly
 * that target, but TypeScript can't correlate the two halves of that lookup — so
 * the widening happens once, here, and the call sites stay honest.
 */
function specFor(
  componentType: SectionComponentType
): ComponentSpec<SectionComponentType> {
  return sectionComponents[componentType] as ComponentSpec<SectionComponentType>
}

/**
 * Validates a content payload against the component that has to render it.
 *
 * Returns `null` rather than throwing: both the write path and the parser ask
 * this question about client-supplied values, and a rejection is an answer.
 * Unknown keys are stripped, so a tag list cannot smuggle rich text through.
 */
export function parseSectionContent<Type extends SectionComponentType>(
  componentType: Type,
  content: unknown
): SectionContent[Type] | null
export function parseSectionContent(
  componentType: string,
  content: unknown
): AnySectionContent | null
export function parseSectionContent(
  componentType: string,
  content: unknown
): AnySectionContent | null {
  if (!isSectionComponentType(componentType)) return null

  const parsed = specFor(componentType).schema.strip().safeParse(content)

  return parsed.success ? (parsed.data as AnySectionContent) : null
}

/** What a section holds the moment it is added, before anything is written. */
export function emptySectionContent<Type extends SectionComponentType>(
  componentType: Type
): SectionContent[Type] {
  return sectionComponents[componentType].empty()
}

/**
 * Parses the part of a field path that addresses one string inside a section's
 * content — everything after `section.<id>.content.`.
 */
export function parseSectionContentPath(
  segments: string[]
): SectionContentTarget | null {
  const [field, ...tail] = segments
  const componentType = sectionComponentTypes.find(
    (type) => sectionComponents[type].field === field
  )

  return componentType ? specFor(componentType).parse(tail) : null
}

/** Renders a content target back to its path segments. */
export function formatSectionContentPath(target: SectionContentTarget) {
  return specFor(target.componentType).format(target)
}

/**
 * The stored content with one element replaced, or `null` when the target names
 * an element that isn't there.
 *
 * The stored value is re-parsed against the target's component type on the way
 * in, so a row whose content somehow disagrees with its component is refused
 * rather than half-rewritten.
 */
export function replaceSectionContentString(
  target: SectionContentTarget,
  stored: unknown,
  value: string
): AnySectionContent | null {
  const current = parseSectionContent(target.componentType, stored)

  return current
    ? specFor(target.componentType).replace(current, target, value)
    : null
}

/**
 * The string a target points at, or `null` when it names an element that isn't
 * there.
 *
 * The inverse of `replaceSectionContentString`, and beside it for the same
 * reason the read and the write of a field lens share an entry: they are
 * inverses, and two homes is how one gets a shape the other doesn't.
 */
export function readSectionContentString(
  target: SectionContentTarget,
  stored: unknown
): string | null {
  const current = parseSectionContent(target.componentType, stored)

  return current ? specFor(target.componentType).read(current, target) : null
}

/**
 * The fields of a section's content that are not part of a repeated element.
 *
 * Rich text is the only shape with any: its whole body is one field. The rest
 * are collections, and their fields come from `sectionContentEntries`.
 */
export function sectionContentFields(
  componentType: string,
  stored: unknown
): SectionContentField[] {
  if (!isSectionComponentType(componentType)) return []

  const content = parseSectionContent(componentType, stored)

  return content ? specFor(componentType).fields(content) : []
}

/** The repeated elements of a section's content, in order. */
export function sectionContentEntries(
  componentType: string,
  stored: unknown
): SectionContentEntry[] {
  const content = parseSectionContent(componentType, stored)
  const collection = collectionFor(componentType)

  if (!content || !collection) return []

  return Array.from(
    { length: collection.count(content) },
    (_unused, index) => ({
      index,
      fields: collection.fields(content, index)
    })
  )
}

/** What one element of this shape is called, or `null` when it has none. */
export function sectionContentNoun(componentType: string) {
  return collectionFor(componentType)?.noun ?? null
}

/**
 * The content with one element appended, removed or moved — how the *set* of
 * strings in a custom section changes, where `replaceSectionContentString`
 * edits one that already exists.
 *
 * Each returns `null` when the stored payload doesn't match the component that
 * has to render it, so a disagreeing row is refused rather than rewritten into
 * a shape it never had.
 */
export function addSectionContentEntry(componentType: string, stored: unknown) {
  return applyToCollection(componentType, stored, (collection, content) =>
    collection.add(content)
  )
}

export function removeSectionContentEntry(
  componentType: string,
  stored: unknown,
  index: number
) {
  return applyToCollection(componentType, stored, (collection, content) =>
    collection.remove(content, index)
  )
}

export function moveSectionContentEntry(
  componentType: string,
  stored: unknown,
  from: number,
  to: number
) {
  return applyToCollection(componentType, stored, (collection, content) =>
    collection.move(content, from, to)
  )
}

function collectionFor(componentType: string) {
  return isSectionComponentType(componentType)
    ? specFor(componentType).collection
    : null
}

function applyToCollection(
  componentType: string,
  stored: unknown,
  change: (
    collection: Collection<SectionComponentType>,
    content: AnySectionContent
  ) => AnySectionContent
): AnySectionContent | null {
  const content = parseSectionContent(componentType, stored)
  const collection = collectionFor(componentType)

  return content && collection ? change(collection, content) : null
}

/**
 * Reads an array index segment. Digits only: `Number("")` is 0, so a path with
 * a missing or empty segment would otherwise coerce into element 0.
 */
function toIndex(token: string | undefined) {
  return token && /^\d+$/.test(token) ? Number(token) : null
}

function replaceString(values: string[], index: number, value: string) {
  return index < values.length ? replace(values, index, value) : null
}

function replace<Value>(values: Value[], index: number, value: Value) {
  return values.map((current, at) => (at === index ? value : current))
}
