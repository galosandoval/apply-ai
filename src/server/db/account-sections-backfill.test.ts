import { readFile } from "node:fs/promises"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { testDatabaseUrl } from "./test-database"

/**
 * `migrations/0017_account_sections_backfill.sql`, run against fixtures.
 *
 * Same shape as `section-backfill.test.ts`, and for the same reason: a
 * migration runs once, against no rows, long before a test connects — so the
 * statements are read out of the file that ships and executed against fixtures
 * in a throwaway schema. Nothing is retyped into the test.
 *
 * The whole file is the backfill here; there is no schema change to skip past.
 */

const hasTestDatabase = !!testDatabaseUrl

const migrationFile = "migrations/0017_account_sections_backfill.sql"

async function backfillStatements() {
  const sql = await readFile(migrationFile, "utf8")

  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)
}

/** The tables as they stand when the backfill runs. */
const fixtureSchema = `
  CREATE TABLE "apply-ai_user" (
    "id" text PRIMARY KEY, "email" text NOT NULL,
    "locale" text DEFAULT 'en' NOT NULL
  );
  CREATE TABLE "apply-ai_resume" ("id" text PRIMARY KEY, "user_id" text);
  CREATE TABLE "apply-ai_section" (
    "id" text PRIMARY KEY, "resume_id" text, "user_id" text,
    "kind" text NOT NULL, "label" text NOT NULL,
    "component_type" text NOT NULL, "position" integer NOT NULL,
    "content" jsonb
  );
  CREATE TABLE "apply-ai_skill" (
    "id" text PRIMARY KEY, "category" text NOT NULL, "all" text[] NOT NULL,
    "position" integer NOT NULL, "user_id" text
  );
  CREATE TABLE "apply-ai_work" (
    "id" text PRIMARY KEY, "position" integer DEFAULT 0 NOT NULL,
    "user_id" text, "resume_id" text
  );
  CREATE TABLE "apply-ai_school" (
    "id" text PRIMARY KEY, "position" integer DEFAULT 0 NOT NULL,
    "user_id" text, "resume_id" text
  );
`

/**
 * One account per combination that decides what the backfill writes: a full
 * profile, a profile holding one thing, an empty one, a Spanish one, and one
 * whose only rows belong to a resume rather than to the account.
 */
const fixtureRows = `
  INSERT INTO "apply-ai_user" ("id", "email", "locale") VALUES
    ('u-full',    'full@example.com',    'en'),
    ('u-jobs',    'jobs@example.com',    'en'),
    ('u-empty',   'empty@example.com',   'en'),
    ('u-spanish', 'spanish@example.com', 'es'),
    ('u-resume',  'resume@example.com',  'en'),
    ('u-edited',  'edited@example.com',  'en');

  INSERT INTO "apply-ai_resume" VALUES ('r-1', 'u-resume');

  INSERT INTO "apply-ai_skill" VALUES
    ('k-full',    'Languages', ARRAY['TypeScript'], 0, 'u-full'),
    ('k-spanish', 'Lenguajes', ARRAY['TypeScript'], 0, 'u-spanish'),
    ('k-edited',  'Languages', ARRAY['TypeScript'], 0, 'u-edited');

  INSERT INTO "apply-ai_work" VALUES
    ('w-full', 0, 'u-full', NULL),
    ('w-jobs', 0, 'u-jobs', NULL),
    ('w-spanish', 0, 'u-spanish', NULL),
    ('w-snapshot', 0, 'u-resume', 'r-1');

  INSERT INTO "apply-ai_school" VALUES
    ('e-full', 0, 'u-full', NULL),
    ('e-spanish', 0, 'u-spanish', NULL);

  -- A resume's own sections, and an account that has already been backfilled
  -- and has since removed one.
  INSERT INTO "apply-ai_section" VALUES
    ('s-resume', 'r-1', NULL, 'experience', 'Experience', 'twoColumn', 0, NULL),
    ('s-edited', NULL, 'u-edited', 'skills', 'Superpowers', 'groupedList', 0, NULL);
`

let client: Client

describe.skipIf(!hasTestDatabase)("0017 account sections backfill", () => {
  beforeAll(async () => {
    client = new Client({ connectionString: testDatabaseUrl })

    await client.connect()
    await client.query("DROP SCHEMA IF EXISTS account_sections_test CASCADE")
    await client.query("CREATE SCHEMA account_sections_test")
    await client.query("SET search_path TO account_sections_test")
    await client.query(fixtureSchema)
    await client.query(fixtureRows)

    await runBackfill()
  })

  afterAll(async () => {
    await client?.query("DROP SCHEMA IF EXISTS account_sections_test CASCADE")
    await client?.end()
  })

  async function runBackfill() {
    for (const statement of await backfillStatements()) {
      await client.query(statement)
    }
  }

  async function sectionsOf(userId: string) {
    const { rows } = await client.query<{
      kind: string
      label: string
      component_type: string
      position: number
      content: unknown
      resume_id: string | null
    }>(
      `SELECT "kind", "label", "component_type", "position", "content", "resume_id"
       FROM "apply-ai_section" WHERE "user_id" = $1 ORDER BY "position"`,
      [userId]
    )

    return rows
  }

  it("writes a section per thing the profile holds, in render order", async () => {
    const rows = await sectionsOf("u-full")

    expect(rows.map((row) => row.kind)).toEqual([
      "skills",
      "experience",
      "education"
    ])
    expect(rows.map((row) => row.label)).toEqual([
      "Skills",
      "Experience",
      "Education"
    ])
    expect(rows.map((row) => row.component_type)).toEqual([
      "groupedList",
      "twoColumn",
      "twoColumn"
    ])
    expect(rows.map((row) => row.position)).toEqual([0, 1, 2])
  })

  it("leaves a core section's content to its typed rows", async () => {
    const rows = await sectionsOf("u-full")

    expect(rows.map((row) => row.content)).toEqual([null, null, null])
  })

  it("owns them by the account and not by a resume", async () => {
    const rows = await sectionsOf("u-full")

    expect(rows.map((row) => row.resume_id)).toEqual([null, null, null])
  })

  it("numbers from zero over the sections an account actually got", async () => {
    const rows = await sectionsOf("u-jobs")

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: "experience", position: 0 })
  })

  it("gives an empty profile nothing, so it still reads as the defaults", async () => {
    expect(await sectionsOf("u-empty")).toEqual([])
  })

  it("writes the headings in the account's own language", async () => {
    const rows = await sectionsOf("u-spanish")

    expect(rows.map((row) => row.label)).toEqual([
      "Habilidades",
      "Experiencia",
      "Formación académica"
    ])
  })

  it("reads the account's master rows, not a resume's snapshot of them", async () => {
    expect(await sectionsOf("u-resume")).toEqual([])
  })

  it("leaves resume-owned sections alone", async () => {
    const { rows } = await client.query<{ id: string; label: string }>(
      `SELECT "id", "label" FROM "apply-ai_section" WHERE "resume_id" IS NOT NULL`
    )

    expect(rows).toEqual([{ id: "s-resume", label: "Experience" }])
  })

  it("skips an account that already has sections of its own", async () => {
    const rows = await sectionsOf("u-edited")

    // Renamed, and the two it holds rows for never came back.
    expect(rows.map((row) => row.label)).toEqual(["Superpowers"])
  })

  it("changes nothing when it runs a second time", async () => {
    const before = await sectionsOf("u-full")

    await runBackfill()

    expect(await sectionsOf("u-full")).toEqual(before)
  })
})
