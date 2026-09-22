import { describe, expect, it } from "vitest"
import { resolveConnectionString } from "./migrate.mjs"

/**
 * Pure precedence, no database and no `process.env` mutation — the resolver
 * takes the environment as an argument for exactly this reason. Each case
 * below fills in one rung and everything above it, the way a real
 * environment would: a higher-precedence value is always set alongside the
 * lower ones it is meant to win over.
 */
describe("resolveConnectionString", () => {
  it.each([
    [
      "MIGRATION_DATABASE_URL",
      {
        MIGRATION_DATABASE_URL: "postgres://migration",
        DATABASE_URL_UNPOOLED: "postgres://unpooled",
        POSTGRES_URL_NON_POOLING: "postgres://non-pooling",
        DATABASE_URL: "postgres://pooled"
      },
      "postgres://migration"
    ],
    [
      "DATABASE_URL_UNPOOLED",
      {
        DATABASE_URL_UNPOOLED: "postgres://unpooled",
        POSTGRES_URL_NON_POOLING: "postgres://non-pooling",
        DATABASE_URL: "postgres://pooled"
      },
      "postgres://unpooled"
    ],
    [
      "POSTGRES_URL_NON_POOLING",
      {
        POSTGRES_URL_NON_POOLING: "postgres://non-pooling",
        DATABASE_URL: "postgres://pooled"
      },
      "postgres://non-pooling"
    ],
    ["DATABASE_URL", { DATABASE_URL: "postgres://pooled" }, "postgres://pooled"]
  ])("prefers %s when it is set", (_name, env, expected) => {
    expect(resolveConnectionString(env)).toBe(expected)
  })

  it("resolves nothing when the environment sets none of them", () => {
    expect(resolveConnectionString({})).toBeUndefined()
  })
})
