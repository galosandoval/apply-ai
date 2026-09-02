import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { invalid, translateValidation } from "./validation-message"

/**
 * The encoding is only half of it: a key with no message behind it renders as
 * a raw string on a form, and nothing else would catch that. So the keys the
 * schemas actually emit are read out of the source and checked against the
 * English messages.
 */

const english = JSON.parse(
  readFileSync(new URL("../../messages/en.json", import.meta.url), "utf8")
) as { validation: Record<string, string> }

const schemaSources = [
  "../server/db/crud-schema.ts",
  "../server/modules/resume/resume.schema.ts",
  "../server/modules/profile/profile.schema.ts"
]

/** Every key passed to `invalid` across the schemas that use it. */
const emittedKeys = [
  ...new Set(
    schemaSources.flatMap((source) =>
      [
        ...readFileSync(new URL(source, import.meta.url), "utf8").matchAll(
          /invalid\("([^"]+)"/g
        )
      ].map(([, key]) => key!)
    )
  )
]

describe("validation messages", () => {
  it("emits keys from more than one schema", () => {
    expect(emittedKeys.length).toBeGreaterThan(4)
  })

  it.each(emittedKeys)("has an English message for %s", (key) => {
    expect(english.validation[key]).toBeTypeOf("string")
  })

  it("resolves a key and its numbers", () => {
    const message = translateValidation(
      invalid("minChars", { count: 3 }),
      (key, values) => `${key}:${values?.count}`
    )

    expect(message).toBe("minChars:3")
  })

  it("passes a message it did not write straight through", () => {
    const message = translateValidation("Invalid email", () => "translated")

    expect(message).toBe("Invalid email")
  })
})
