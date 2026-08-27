import { describe, expect, it } from "vitest"
import {
  addSectionContentEntry,
  coreSectionKinds,
  emptySectionContent,
  isCoreSectionKind,
  moveSectionContentEntry,
  parseSectionContent,
  readSectionContentString,
  removeSectionContentEntry,
  replaceSectionContentString,
  sectionComponentTypes,
  sectionContentEntries,
  sectionContentFields,
  sectionContentNoun
} from "./section-content"

/**
 * A section's `content` is client-supplied JSON, and `componentType` is the only
 * thing that says what shape it may take — so a gap here hands a component a
 * payload it cannot render.
 */

describe("section kinds", () => {
  it("has exactly two core kinds — the ones with typed rows", () => {
    expect(coreSectionKinds).toEqual(["experience", "education"])
  })

  // Skills is content-bearing now, so it is not core even though it is named.
  it("does not treat skills as core", () => {
    expect(isCoreSectionKind("skills")).toBe(false)
  })

  it.each(coreSectionKinds)("treats %s as core", (kind) => {
    expect(isCoreSectionKind(kind)).toBe(true)
  })

  it("does not treat custom as core", () => {
    expect(isCoreSectionKind("custom")).toBe(false)
  })

  it("does not treat an unknown kind as core", () => {
    expect(isCoreSectionKind("nonsense")).toBe(false)
  })
})

describe("component types", () => {
  it("is the set spec C renders", () => {
    expect(sectionComponentTypes).toEqual([
      "richText",
      "twoColumn",
      "list",
      "tagList",
      "iconList",
      "meter",
      "groupedList"
    ])
  })

  it.each(sectionComponentTypes)(
    "has empty content for %s",
    (componentType) => {
      const empty = emptySectionContent(componentType)

      expect(parseSectionContent(componentType, empty)).toEqual(empty)
    }
  )
})

describe("parseSectionContent — accepted payloads", () => {
  const accepted = {
    richText: { markdown: "**Senior** engineer with [links](https://a.dev)" },
    twoColumn: { rows: [{ left: "AWS Certified", right: "2024" }] },
    list: { items: ["Shipped the thing", "Shipped the other thing"] },
    tagList: { tags: ["TypeScript", "Postgres"] },
    iconList: { icons: [{ icon: "github", text: "github.com/me" }] },
    meter: { meters: [{ label: "Spanish", level: 80 }] },
    groupedList: {
      groups: [{ label: "Languages", items: ["TypeScript", "Go"] }]
    }
  } as const

  it.each(sectionComponentTypes)("accepts %s content", (componentType) => {
    expect(parseSectionContent(componentType, accepted[componentType])).toEqual(
      accepted[componentType]
    )
  })

  it("strips keys the component does not own", () => {
    expect(
      parseSectionContent("list", { items: ["one"], markdown: "smuggled" })
    ).toEqual({ items: ["one"] })
  })
})

describe("parseSectionContent — rejected payloads", () => {
  /** The assertion that a component can never be handed another's payload. */
  it("rejects rich text content on a tag list", () => {
    expect(parseSectionContent("tagList", { markdown: "# nope" })).toBeNull()
  })

  it("rejects tag list content on a rich text section", () => {
    expect(parseSectionContent("richText", { tags: ["nope"] })).toBeNull()
  })

  it("rejects list content on an icon list", () => {
    expect(parseSectionContent("iconList", { items: ["nope"] })).toBeNull()
  })

  it.each([null, undefined, "a string", 7, ["an array"]])(
    "rejects %j as content",
    (content) => {
      expect(parseSectionContent("richText", content)).toBeNull()
    }
  )

  it("rejects a two-column row missing a side", () => {
    expect(
      parseSectionContent("twoColumn", { rows: [{ left: "only" }] })
    ).toBeNull()
  })

  it("rejects an unknown component type", () => {
    expect(parseSectionContent("carousel", { markdown: "" })).toBeNull()
  })
})

/**
 * The panel is generated from a section's shape rather than written per
 * component type, so these are what make adding a shape one registry entry
 * instead of a new editor.
 */
describe("the panel's view of a shape", () => {
  it("gives rich text one markdown field and no collection", () => {
    expect(sectionContentFields("richText", { markdown: "**Hi**" })).toEqual([
      {
        label: "Text",
        target: { componentType: "richText", field: "markdown" },
        value: "**Hi**",
        input: "markdown"
      }
    ])

    expect(sectionContentNoun("richText")).toBeNull()
    expect(sectionContentEntries("richText", { markdown: "**Hi**" })).toEqual(
      []
    )
  })

  it("names what one element of each collection is called", () => {
    expect(sectionContentNoun("list")).toBe("item")
    expect(sectionContentNoun("tagList")).toBe("tag")
    expect(sectionContentNoun("twoColumn")).toBe("row")
    expect(sectionContentNoun("iconList")).toBe("entry")
  })

  it("addresses every element by the path that writes it", () => {
    const entries = sectionContentEntries("twoColumn", {
      rows: [{ left: "2020", right: "Something" }]
    })

    expect(entries).toEqual([
      {
        index: 0,
        fields: [
          {
            label: "Left",
            target: { componentType: "twoColumn", index: 0, side: "left" },
            value: "2020",
            input: "text"
          },
          {
            label: "Right",
            target: { componentType: "twoColumn", index: 0, side: "right" },
            value: "Something",
            input: "text"
          }
        ]
      }
    ])
  })

  it("reads back exactly what a field write put there", () => {
    const target = { componentType: "list", index: 1 } as const
    const next = replaceSectionContentString(
      target,
      { items: ["one", "two"] },
      "changed"
    )

    expect(readSectionContentString(target, next)).toBe("changed")
  })

  it("reads nothing for an element that is not there", () => {
    expect(
      readSectionContentString(
        { componentType: "list", index: 4 },
        { items: ["one"] }
      )
    ).toBeNull()
  })

  it("appends a blank element", () => {
    expect(addSectionContentEntry("tagList", { tags: ["one"] })).toEqual({
      tags: ["one", ""]
    })

    expect(addSectionContentEntry("iconList", { icons: [] })).toEqual({
      icons: [{ icon: "", text: "" }]
    })
  })

  it("removes one element and leaves the rest in order", () => {
    expect(
      removeSectionContentEntry("list", { items: ["one", "two", "three"] }, 1)
    ).toEqual({ items: ["one", "three"] })
  })

  it("moves an element", () => {
    expect(
      moveSectionContentEntry("list", { items: ["one", "two", "three"] }, 2, 0)
    ).toEqual({ items: ["three", "one", "two"] })
  })

  /** "Move the first one up" is offered rather than hidden; nothing happens. */
  it("leaves the list alone when a move runs off the end", () => {
    const content = { items: ["one", "two"] }

    expect(moveSectionContentEntry("list", content, 0, -1)).toEqual(content)
    expect(moveSectionContentEntry("list", content, 1, 2)).toEqual(content)
  })

  it("refuses a payload the component could not render", () => {
    expect(addSectionContentEntry("list", { tags: ["one"] })).toBeNull()
    expect(removeSectionContentEntry("list", { tags: ["one"] }, 0)).toBeNull()
    expect(moveSectionContentEntry("list", { tags: ["one"] }, 0, 1)).toBeNull()
  })

  /** Rich text has no elements, so there is nothing to add one to. */
  it("refuses to add an element to a shape that has no collection", () => {
    expect(addSectionContentEntry("richText", { markdown: "" })).toBeNull()
  })

  it("refuses a component type that does not exist", () => {
    expect(sectionContentNoun("carousel")).toBeNull()
    expect(sectionContentEntries("carousel", {})).toEqual([])
    expect(sectionContentFields("carousel", {})).toEqual([])
  })
})
