import { describe, expect, it } from "vitest"
import english from "../../messages/en.json"
import spanish from "../../messages/es.json"
import {
  searchSectionCatalog,
  sectionPresets,
  type SectionCatalogTranslate
} from "./section-catalog"

/**
 * The catalog as the picker reads it — values in, values out, no React.
 *
 * The message files are read rather than stubbed for the same reason the picker
 * matches on copy: a test with its own invented labels would pass while the
 * entry a user can see failed to come back.
 */

/** `useTranslations("sectionCatalog")`, over the real message tree. */
function catalog(messages: {
  sectionCatalog: unknown
}): SectionCatalogTranslate {
  return (key) => {
    const value = key
      .split(".")
      .reduce<unknown>(
        (node, part) =>
          typeof node === "object" && node !== null
            ? (node as Record<string, unknown>)[part]
            : undefined,
        messages.sectionCatalog
      )

    return typeof value === "string" ? value : key
  }
}

const t = catalog(english)
const es = catalog(spanish)

const found = (query: string, translate = t) =>
  searchSectionCatalog(query, translate).flatMap((group) =>
    group.presets.map((preset) => preset.id)
  )

describe("every preset is a preset a user can read", () => {
  it.each(sectionPresets.map((preset) => preset.id))(
    "%s has a label and a hint in both languages",
    (id) => {
      for (const translate of [t, es]) {
        expect(translate(`presets.${id}.label`)).not.toBe(`presets.${id}.label`)
        expect(translate(`presets.${id}.hint`)).not.toBe(`presets.${id}.hint`)
      }
    }
  )
})

describe("strengths", () => {
  // `generatedSectionAllowlist` has drawn strengths as a tag list since
  // generation landed. A user typing the heading gets the same shape.
  it("is in the catalog, drawn the way a generation draws it", () => {
    expect(sectionPresets).toContainEqual({
      id: "strengths",
      componentType: "tagList"
    })
  })

  it("is offered under skills, in both languages", () => {
    expect(found("Strengths")).toEqual(["strengths"])
    expect(found("Fortalezas", es)).toEqual(["strengths"])
  })
})

describe("search reads the label, the hint and the aliases", () => {
  it("finds an entry by a word only its hint uses", () => {
    expect(found("hundred")).toContain("graphs")
  })

  // The alias is matched, never drawn: the hint stays the line written for the
  // person reading it.
  it("finds an entry by a heading only its aliases record", () => {
    expect(found("profile")).toContain("summary")
    expect(found("perfil", es)).toContain("summary")
  })

  it("ignores the accents a person may or may not type", () => {
    expect(found("Graficas", es)).toContain("graphs")
    expect(found("Gráficas", es)).toContain("graphs")
  })

  it("returns the whole catalog for an empty query", () => {
    expect(found("")).toHaveLength(sectionPresets.length)
  })

  it("drops the groups with nothing left in them", () => {
    const groups = searchSectionCatalog("Hobbies", t)

    expect(groups).toHaveLength(1)
    expect(groups[0]?.id).toBe("personal")
  })
})
