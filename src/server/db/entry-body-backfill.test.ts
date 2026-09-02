import { readFile } from "node:fs/promises"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { renderResumeMarkdown } from "~/lib/resume-markdown"
import { testDatabaseUrl } from "./test-database"

/**
 * The backfill half of `migrations/0013_drop_bullets_and_description.sql`.
 *
 * A migration only runs once, and by the time the test database is connected it
 * has already run against no rows — so the two `UPDATE`s are exercised here
 * against fixtures in a throwaway schema, the same way `0006`'s backfill is.
 * The SQL under test is the SQL that ships; nothing is retyped into the test.
 *
 * What it has to get right is that a migrated job looks the way it looked
 * yesterday: a bullet becomes a `- ` line, in the order it was in, and the
 * renderer draws every `- ` line as a real list item.
 */

const hasTestDatabase = !!testDatabaseUrl

const migrationFile = "migrations/0013_drop_bullets_and_description.sql"

/**
 * The data movement, without the column drops that follow it.
 *
 * A statement is picked by what it does rather than by where it sits in the
 * file, and the comments above it are left on it — they are part of the SQL
 * that ships, and Postgres reads them as nothing.
 */
async function backfillStatements() {
  const sql = await readFile(migrationFile, "utf8")

  const isUpdate = (statement: string) =>
    statement
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim()
      .toUpperCase()
      .startsWith("UPDATE")

  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(isUpdate)
}

/** The tables as they stand at the moment the backfill runs: 0012 applied. */
const fixtureSchema = `
  CREATE TABLE "apply-ai_work" (
    "id" text PRIMARY KEY, "bullets" text[] NOT NULL,
    "body" text DEFAULT '' NOT NULL
  );
  CREATE TABLE "apply-ai_school" (
    "id" text PRIMARY KEY, "description" text,
    "body" text DEFAULT '' NOT NULL
  );
`

const fixtureRows = `
  INSERT INTO "apply-ai_work" VALUES
    ('w-many', ARRAY['Wrote the first algorithm', 'Described a general computer'], ''),
    ('w-one', ARRAY['Read the notes'], ''),
    ('w-blanks', ARRAY['Shipped it', '', '   '], ''),
    ('w-wrapped', ARRAY[E'Shipped it,\nand then shipped more'], ''),
    ('w-none', ARRAY[]::text[], '');

  INSERT INTO "apply-ai_school" VALUES
    ('e-prose', 'Studied under De Morgan', ''),
    ('e-lines', E'Studied under De Morgan\nThesis on Bernoulli numbers', ''),
    ('e-null', NULL, '');
`

let client: Client

describe.skipIf(!hasTestDatabase)("0013 backfill", () => {
  beforeAll(async () => {
    client = new Client({ connectionString: testDatabaseUrl })

    await client.connect()
    await client.query("DROP SCHEMA IF EXISTS body_backfill_test CASCADE")
    await client.query("CREATE SCHEMA body_backfill_test")
    await client.query("SET search_path TO body_backfill_test")
    await client.query(fixtureSchema)
    await client.query(fixtureRows)

    for (const statement of await backfillStatements()) {
      await client.query(statement)
    }
  })

  afterAll(async () => {
    await client?.query("DROP SCHEMA IF EXISTS body_backfill_test CASCADE")
    await client?.end()
  })

  async function bodyOf(table: "work" | "school", id: string) {
    const { rows } = await client.query<{ body: string }>(
      `SELECT "body" FROM "apply-ai_${table}" WHERE "id" = $1`,
      [id]
    )

    return rows[0]?.body
  }

  it("joins a job's bullets as `- ` lines, in order", async () => {
    expect(await bodyOf("work", "w-many")).toBe(
      "- Wrote the first algorithm\n- Described a general computer"
    )
  })

  it("renders a migrated body as the list it was", async () => {
    const blocks = renderResumeMarkdown((await bodyOf("work", "w-many"))!)

    expect(blocks.map((block) => block.kind)).toEqual(["bullet", "bullet"])
  })

  it("drops a blank bullet rather than writing a marker with nothing after it", async () => {
    expect(await bodyOf("work", "w-blanks")).toBe("- Shipped it")
  })

  /**
   * The old panel edited a bullet in a textarea and drew it with
   * `whitespace-pre-line`, so a bullet holding a line break is real data. Left
   * alone the second line falls outside the `- ` and migrates into a paragraph
   * beside the list; one list item is what it was, so one line is what it
   * becomes.
   */
  it("folds a bullet's own newlines rather than splitting it in two", async () => {
    expect(await bodyOf("work", "w-wrapped")).toBe(
      "- Shipped it, and then shipped more"
    )

    const blocks = renderResumeMarkdown((await bodyOf("work", "w-wrapped"))!)

    expect(blocks.map((block) => block.kind)).toEqual(["bullet"])
  })

  it("leaves a job with no bullets an empty body, never null", async () => {
    expect(await bodyOf("work", "w-none")).toBe("")
  })

  // Prose is already legal markdown, and re-marking it as a bullet would be
  // the migration inventing a list the user never wrote.
  it("carries a school's description over verbatim", async () => {
    expect(await bodyOf("school", "e-prose")).toBe("Studied under De Morgan")

    const blocks = renderResumeMarkdown((await bodyOf("school", "e-prose"))!)

    expect(blocks.map((block) => block.kind)).toEqual(["paragraph"])
  })

  /**
   * A description was drawn with the newlines it was typed with. Markdown
   * joins two adjacent lines into one paragraph, so keeping the line break
   * means spelling it the way markdown spells "two blocks".
   */
  it("keeps a multi-line description on separate lines", async () => {
    const blocks = renderResumeMarkdown((await bodyOf("school", "e-lines"))!)

    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "paragraph"
    ])
  })

  it("turns a null description into an empty body", async () => {
    expect(await bodyOf("school", "e-null")).toBe("")
  })
})
