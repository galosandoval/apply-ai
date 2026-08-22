import { type IconEntry, type SectionShape } from "~/components/resume-section"
import {
  isSectionComponentType,
  parseSectionContent
} from "~/lib/section-content"

/**
 * A custom section's stored content as the shape that draws it.
 *
 * Content is re-parsed against the component that has to render it rather than
 * trusted: a row whose payload disagrees with its `componentType` draws nothing
 * at all, which is a visibly missing section rather than half of one.
 *
 * Core sections never come through here — their content is their typed rows,
 * and the document feeds those to the same shapes directly.
 */
export function customSectionShape(
  componentType: string,
  content: unknown
): SectionShape | null {
  if (!isSectionComponentType(componentType)) return null

  // Parsed inside each branch rather than once above it: the parse is what
  // proves the payload matches, and only there does its type say so.
  switch (componentType) {
    case "richText": {
      const parsed = parseSectionContent("richText", content)

      return parsed && { componentType, markdown: parsed.markdown }
    }

    case "twoColumn": {
      const parsed = parseSectionContent("twoColumn", content)

      return (
        parsed && {
          componentType,
          rows: parsed.rows.map((row, index) => ({
            key: String(index),
            left: row.left,
            right: row.right
          }))
        }
      )
    }

    case "list": {
      const parsed = parseSectionContent("list", content)

      // One unlabelled group: a custom list is flat, where Skills is grouped.
      return (
        parsed && {
          componentType,
          groups: [{ key: "items", items: parsed.items }]
        }
      )
    }

    case "tagList": {
      const parsed = parseSectionContent("tagList", content)

      return (
        parsed && {
          componentType,
          tags: parsed.tags.map((tag, index) => ({
            key: String(index),
            label: tag
          }))
        }
      )
    }

    case "iconList": {
      const parsed = parseSectionContent("iconList", content)

      return (
        parsed && {
          componentType,
          icons: parsed.icons.map<IconEntry>((entry, index) => ({
            key: String(index),
            icon: entry.icon,
            label: entry.text
          }))
        }
      )
    }
  }
}
