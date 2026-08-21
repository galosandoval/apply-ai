import { describe, expect, it } from "vitest"
import {
  coreSectionKinds,
  emptySectionContent,
  isCoreSectionKind,
  parseSectionContent,
  sectionComponentTypes
} from "./section-content"

/**
 * A section's `content` is client-supplied JSON, and `componentType` is the only
 * thing that says what shape it may take — so a gap here hands a component a
 * payload it cannot render.
 */

describe("section kinds", () => {
  it("has exactly three core kinds", () => {
    expect(coreSectionKinds).toEqual(["experience", "education", "skills"])
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
      "iconList"
    ])
  })

  it.each(sectionComponentTypes)("has empty content for %s", (componentType) => {
    const empty = emptySectionContent(componentType)

    expect(parseSectionContent(componentType, empty)).toEqual(empty)
  })
})

describe("parseSectionContent — accepted payloads", () => {
  const accepted = {
    richText: { markdown: "**Senior** engineer with [links](https://a.dev)" },
    twoColumn: { rows: [{ left: "AWS Certified", right: "2024" }] },
    list: { items: ["Shipped the thing", "Shipped the other thing"] },
    tagList: { tags: ["TypeScript", "Postgres"] },
    iconList: { icons: [{ icon: "github", text: "github.com/me" }] }
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
