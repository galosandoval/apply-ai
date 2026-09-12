import { readFile } from "node:fs/promises"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { testDatabaseUrl } from "./test-database"

/**
 * `migrations/0018_section_one_owner.sql`, run against fixtures.
 *
 * Same shape as the backfill tests, and for the same reason: a migration runs
 * once, long before a test connects, so the statements are read out of the file
 * that ships and executed against fixtures in a throwaway schema.
 *
 * `0017` runs first, against its own fixtures, rather than the rows it writes
 * being retyped here. What the constraint has to survive is whatever the
 * backfill actually leaves behind, and a hand-copied approximation of that is
 * the one thing this test cannot afford to be — it would go on passing after
 * the backfill changed under it.
 *
 * Two things are worth asserting, and they are not the same thing. The
 * constraint is what the app is left holding: a row with both owners or with
 * neither stops being expressible. The preflight is what a deploy meets first:
 * an ambiguous row fails the migration with a message that names the problem,
 * rather than with Postgres' own.
 */

const hasTestDatabase = !!testDatabaseUrl

const backfillFile = "migrations/0017_account_sections_backfill.sql"
const constraintFile = "migrations/0018_section_one_owner.sql"

async function migrationStatements(file: string) {
  const sql = await readFile(file, "utf8")

  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)
}

/** The tables as they stand when the constraint is added. */
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
 * Enough of a profile for the backfill to have something to write: an account
 * holding all three core kinds, an empty one it must skip, and a resume with a
 * snapshot section of its own.
 */
const fixtureRows = `
  INSERT INTO "apply-ai_user" ("id", "email", "locale") VALUES
    ('u-full',  'full@example.com',  'en'),
    ('u-empty', 'empty@example.com', 'en');

  INSERT INTO "apply-ai_resume" VALUES ('r-1', 'u-full');

  INSERT INTO "apply-ai_skill" VALUES
    ('k-full', 'Languages', ARRAY['TypeScript'], 0, 'u-full');
  INSERT INTO "apply-ai_work" VALUES ('w-full', 0, 'u-full', NULL);
  INSERT INTO "apply-ai_school" VALUES ('e-full', 0, 'u-full', NULL);

  INSERT INTO "apply-ai_section" VALUES
    ('s-snapshot', 'r-1', NULL, 'experience', 'Experience', 'twoColumn', 0, NULL);
`

/** A section row, by the owners it names — either, both, or neither. */
const sectionRow = (
  id: string,
  resumeId: string | null,
  userId: string | null
) =>
  `INSERT INTO "apply-ai_section" VALUES ('${id}', ${
    resumeId ? `'${resumeId}'` : "NULL"
  }, ${
    userId ? `'${userId}'` : "NULL"
  }, 'custom', 'Certificates', 'list', 9, NULL)`

let client: Client

describe.skipIf(!hasTestDatabase)("0018 one owner per section", () => {
  beforeAll(async () => {
    client = new Client({ connectionString: testDatabaseUrl })

    await client.connect()
  })

  afterAll(async () => {
    await client?.query("DROP SCHEMA IF EXISTS section_owner_test CASCADE")
    await client?.end()
  })

  /** A fresh schema per test: one of them leaves the migration unapplied. */
  async function freshSchema() {
    await client.query("DROP SCHEMA IF EXISTS section_owner_test CASCADE")
    await client.query("CREATE SCHEMA section_owner_test")
    await client.query("SET search_path TO section_owner_test")
    await client.query(fixtureSchema)
    await client.query(fixtureRows)
  }

  async function run(file: string) {
    for (const statement of await migrationStatements(file)) {
      await client.query(statement)
    }
  }

  /** The state a deploy of this migration actually meets: after the backfill. */
  async function backfilledSchema() {
    await freshSchema()
    await run(backfillFile)
  }

  it("applies against the rows the backfill leaves behind", async () => {
    await backfilledSchema()

    // The backfill having written nothing would pass this on an empty table.
    const { rows } = await client.query(
      `SELECT 1 FROM "apply-ai_section" WHERE "user_id" IS NOT NULL`
    )
    expect(rows).toHaveLength(3)

    await expect(run(constraintFile)).resolves.toBeUndefined()
  })

  it("rejects a row claiming both owners", async () => {
    await backfilledSchema()
    await run(constraintFile)

    await expect(
      client.query(sectionRow("s-both", "r-1", "u-full"))
    ).rejects.toThrow(/section_one_owner/)
  })

  it("rejects a row claiming neither", async () => {
    await backfilledSchema()
    await run(constraintFile)

    await expect(
      client.query(sectionRow("s-orphan", null, null))
    ).rejects.toThrow(/section_one_owner/)
  })

  it("still accepts a row with exactly one owner", async () => {
    await backfilledSchema()
    await run(constraintFile)

    await expect(
      client.query(sectionRow("s-master", null, "u-full"))
    ).resolves.toBeDefined()
    await expect(
      client.query(sectionRow("s-snapshot-2", "r-1", null))
    ).resolves.toBeDefined()
  })

  it("names the ambiguous rows rather than leaving Postgres to", async () => {
    await backfilledSchema()
    await client.query(sectionRow("s-both", "r-1", "u-full"))

    await expect(run(constraintFile)).rejects.toThrow(/1 section row/)
  })
})
