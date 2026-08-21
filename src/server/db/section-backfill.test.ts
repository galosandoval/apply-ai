import { readFile } from "node:fs/promises"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { testDatabaseUrl } from "./test-database"

/**
 * The backfill half of `migrations/0006_sections_and_snapshots.sql`.
 *
 * A migration only runs once, and by the time the test database is connected it
 * has already run against no rows — so the backfill is exercised here by
 * executing the statements from the migration file itself against fixtures in a
 * throwaway schema. The SQL under test is the SQL that ships; nothing is
 * retyped into the test.
 *
 * A single `Client` rather than the pooled connection, because `search_path` is
 * per session and a pool would hand statements to a connection that never saw
 * it.
 */

const hasTestDatabase = !!testDatabaseUrl

const migrationFile = "migrations/0006_sections_and_snapshots.sql"

/** Everything after the marker is data movement rather than schema change. */
async function backfillStatements() {
  const sql = await readFile(migrationFile, "utf8")
  const backfill = sql.split("-- >>> backfill")[1]

  if (!backfill) throw new Error(`No backfill block in ${migrationFile}`)

  return backfill
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)
}

/**
 * The tables as they stand at the moment the backfill runs: the new columns
 * added, `introduction` and `interests` not yet dropped.
 */
const fixtureSchema = `
  CREATE TABLE "apply-ai_user" (
    "id" text PRIMARY KEY, "email" text NOT NULL, "first_name" text,
    "last_name" text, "introduction" text, "interests" text
  );
  CREATE TABLE "apply-ai_resume" (
    "id" text PRIMARY KEY, "user_id" text, "introduction" text, "interests" text
  );
  CREATE TABLE "apply-ai_section" (
    "id" text PRIMARY KEY, "resume_id" text NOT NULL, "kind" text NOT NULL,
    "label" text NOT NULL, "component_type" text NOT NULL,
    "position" integer NOT NULL, "content" jsonb
  );
  CREATE TABLE "apply-ai_skill" (
    "id" text PRIMARY KEY, "category" text NOT NULL, "all" text[] NOT NULL,
    "position" integer NOT NULL, "user_id" text, "resume_id" text
  );
  CREATE TABLE "apply-ai_contact" (
    "id" text PRIMARY KEY, "full_name" text, "email" text, "phone" text,
    "linked_in" text, "portfolio" text, "location" text NOT NULL,
    "user_id" text NOT NULL, "resume_id" text
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
 * One account with a summary of its own, and four resumes covering every
 * combination the two dropped columns could be in.
 */
const fixtureRows = `
  INSERT INTO "apply-ai_user" VALUES
    ('u1', 'ada@example.com', 'Ada', 'Lovelace', 'Account summary', NULL);

  INSERT INTO "apply-ai_resume" VALUES
    ('r-empty',   'u1', NULL,             NULL),
    ('r-intro',   'u1', 'Resume summary', NULL),
    ('r-both',    'u1', 'Resume summary', 'Chess'),
    ('r-blank',   'u1', '   ',            '');

  INSERT INTO "apply-ai_skill" VALUES
    ('s1', 'Languages', ARRAY['TypeScript'], 0, 'u1', NULL);

  INSERT INTO "apply-ai_contact" VALUES
    ('c1', NULL, NULL, '555-0100', 'linkedin.com/in/ada', 'ada.dev', 'London, UK', 'u1', NULL);

  INSERT INTO "apply-ai_work" VALUES
    ('w-b', 0, NULL, 'r-intro'), ('w-a', 0, NULL, 'r-intro');

  INSERT INTO "apply-ai_school" VALUES
    ('e-b', 0, NULL, 'r-intro'), ('e-a', 0, NULL, 'r-intro');
`

let client: Client

describe.skipIf(!hasTestDatabase)("0006 backfill", () => {
  beforeAll(async () => {
    client = new Client({ connectionString: testDatabaseUrl })

    await client.connect()
    await client.query("DROP SCHEMA IF EXISTS backfill_test CASCADE")
    await client.query("CREATE SCHEMA backfill_test")
    await client.query("SET search_path TO backfill_test")
    await client.query(fixtureSchema)
    await client.query(fixtureRows)

    for (const statement of await backfillStatements()) {
      await client.query(statement)
    }
  })

  afterAll(async () => {
    await client?.query("DROP SCHEMA IF EXISTS backfill_test CASCADE")
    await client?.end()
  })

  async function sectionsOf(resumeId: string) {
    const { rows } = await client.query<{
      kind: string
      label: string
      position: number
      content: { markdown: string } | null
    }>(
      `SELECT "kind", "label", "position", "content" FROM "apply-ai_section"
       WHERE "resume_id" = $1 ORDER BY "position"`,
      [resumeId]
    )

    return rows
  }

  it("gives every resume the three core sections it was drawn with", async () => {
    for (const resumeId of ["r-empty", "r-intro", "r-both", "r-blank"]) {
      const core = (await sectionsOf(resumeId)).filter(
        (row) => row.content === null
      )

      expect(core.map((row) => row.kind)).toEqual([
        "skills",
        "experience",
        "education"
      ])
      expect(core.map((row) => row.label)).toEqual([
        "Skills",
        "Experience",
        "Education"
      ])
    }
  })

  it("moves a resume's introduction into a rich-text section, read first", async () => {
    const [first] = await sectionsOf("r-intro")

    expect(first?.kind).toBe("custom")
    expect(first?.label).toBe("Summary")
    expect(first?.content).toEqual({ markdown: "Resume summary" })
    expect(first?.position).toBeLessThan(0)
  })

  it("moves both columns when both are present", async () => {
    const rows = await sectionsOf("r-both")

    expect(rows.map((row) => row.label)).toEqual([
      "Summary",
      "Skills",
      "Experience",
      "Education",
      "Interests"
    ])
    expect(rows.at(-1)?.content).toEqual({ markdown: "Chess" })
  })

  it("seeds a summary from the account when the resume has none", async () => {
    const [first] = await sectionsOf("r-empty")

    expect(first?.content).toEqual({ markdown: "Account summary" })
  })

  it("treats a blank column as absent, not as an empty section", async () => {
    const custom = (await sectionsOf("r-blank")).filter(
      (row) => row.kind === "custom"
    )

    // The account's summary still seeds it; the empty `interests` makes nothing.
    expect(custom.map((row) => row.label)).toEqual(["Summary"])
  })

  it("snapshots the account's skills onto every resume, once", async () => {
    const { rows } = await client.query<{ resume_id: string | null }>(
      `SELECT "resume_id" FROM "apply-ai_skill" ORDER BY "resume_id" NULLS FIRST`
    )

    expect(rows.map((row) => row.resume_id)).toEqual([
      null,
      "r-blank",
      "r-both",
      "r-empty",
      "r-intro"
    ])
  })

  it("snapshots contact with the name and email the resume was showing", async () => {
    const { rows } = await client.query<{
      full_name: string | null
      email: string | null
      location: string
    }>(
      `SELECT "full_name", "email", "location" FROM "apply-ai_contact"
       WHERE "resume_id" = 'r-intro'`
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      location: "London, UK"
    })
  })

  it("leaves the account's own master rows untouched", async () => {
    const { rows } = await client.query(
      `SELECT "id" FROM "apply-ai_contact" WHERE "resume_id" IS NULL`
    )

    expect(rows).toHaveLength(1)
  })

  it("freezes the previous `ORDER BY id` row order into positions", async () => {
    for (const table of ["apply-ai_work", "apply-ai_school"]) {
      const { rows } = await client.query<{ id: string; position: number }>(
        `SELECT "id", "position" FROM "${table}" ORDER BY "position"`
      )

      expect(rows).toEqual([
        { id: expect.stringMatching(/-a$/) as string, position: 0 },
        { id: expect.stringMatching(/-b$/) as string, position: 1 }
      ])
    }
  })
})
