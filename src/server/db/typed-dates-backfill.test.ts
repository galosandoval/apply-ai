import { readFile } from "node:fs/promises"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { testDatabaseUrl } from "./test-database"

/**
 * The data half of `migrations/0014_typed_dates_and_current.sql`.
 *
 * A migration runs once, and by the time the test database is connected it has
 * already run against no rows — so the parse pass is exercised here against
 * fixtures in a throwaway schema, the same way `0013`'s backfill is. The SQL
 * under test is the SQL that ships; nothing is retyped into the test.
 *
 * This is the risky half of #71. Every date in production is whatever the user
 * typed into a box validated only as "3 to 50 characters", and what the parse
 * does with each shape — including the shapes it cannot read — is a decision
 * this file is the record of.
 */

const hasTestDatabase = !!testDatabaseUrl

const migrationFile = "migrations/0014_typed_dates_and_current.sql"

/**
 * Everything the migration does except the `ALTER`s that precede it: the parse
 * function, the two flag updates, the two normalizing updates, and the drop.
 *
 * Picked by what a statement does rather than by where it sits in the file, so
 * an edit that reorders the migration does not quietly stop testing half of it.
 */
async function dataStatements() {
  const sql = await readFile(migrationFile, "utf8")

  const withoutComments = (statement: string) =>
    statement
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim()

  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => !withoutComments(statement).startsWith("ALTER"))
    .filter((statement) => withoutComments(statement).length > 0)
}

/** The tables as they stand the moment the parse runs: the `ALTER`s applied. */
const fixtureSchema = `
  CREATE TABLE "apply-ai_work" (
    "id" text PRIMARY KEY,
    "start_date" text NOT NULL,
    "end_date" text DEFAULT '' NOT NULL,
    "current" boolean DEFAULT false NOT NULL
  );
  CREATE TABLE "apply-ai_school" (
    "id" text PRIMARY KEY,
    "start_date" text NOT NULL,
    "end_date" text DEFAULT '' NOT NULL,
    "current" boolean DEFAULT false NOT NULL
  );
`

/** One row per shape the free-text columns are known to hold. */
const fixtureRows = `
  INSERT INTO "apply-ai_work" ("id", "start_date", "end_date") VALUES
    ('iso-month', '2017-09', '2021-05'),
    ('iso-year', '2017', '2021'),
    ('iso-day', '2017-09-04', '2021-05-31'),
    ('named', 'Sept 2017', 'May 2021'),
    ('named-dot', 'Sept. 2017', 'September 2021'),
    ('spanish', 'septiembre 2017', 'Actualidad'),
    ('slashes', '09/2017', '5/2021'),
    ('reversed', '2017/09', '2021-05'),
    ('unpadded', '2017-9', '2021-05'),
    ('present', 'Jan 2020', 'Present'),
    ('now', '2020-01', 'now'),
    ('blank-end', '2020-01', ''),
    ('unreadable', '2018 - 2020 (contract)', 'summer 2020');

  INSERT INTO "apply-ai_school" ("id", "start_date", "end_date") VALUES
    ('graduated', 'September 2016', 'May 2020'),
    ('attending', 'ene 2022', 'Current'),
    ('no-end', '2016', '');
`

let client: Client

describe.skipIf(!hasTestDatabase)("0014 typed dates", () => {
  beforeAll(async () => {
    client = new Client({ connectionString: testDatabaseUrl })

    await client.connect()
    await client.query("DROP SCHEMA IF EXISTS typed_dates_test CASCADE")
    await client.query("CREATE SCHEMA typed_dates_test")
    await client.query("SET search_path TO typed_dates_test")
    await client.query(fixtureSchema)
    await client.query(fixtureRows)

    for (const statement of await dataStatements()) {
      await client.query(statement)
    }
  })

  afterAll(async () => {
    await client?.query("DROP SCHEMA IF EXISTS typed_dates_test CASCADE")
    await client?.end()
  })

  async function entry(table: "work" | "school", id: string) {
    const { rows } = await client.query<{
      start_date: string
      end_date: string
      current: boolean
    }>(
      `SELECT "start_date", "end_date", "current"
       FROM "apply-ai_${table}" WHERE "id" = $1`,
      [id]
    )

    return rows[0]
  }

  const dates = (start: string, end: string, current = false) => ({
    start_date: start,
    end_date: end,
    current
  })

  it("leaves a date already in the subset exactly as it is", async () => {
    expect(await entry("work", "iso-month")).toEqual(
      dates("2017-09", "2021-05")
    )
    expect(await entry("work", "iso-day")).toEqual(
      dates("2017-09-04", "2021-05-31")
    )
  })

  /*
    Year precision is a claim about how much the user knows, not a date missing
    two thirds of itself — so it is never filled in with a month nobody wrote.
  */
  it("keeps a year-only date at year precision", async () => {
    expect(await entry("work", "iso-year")).toEqual(dates("2017", "2021"))
  })

  it("reads a written month, abbreviated or not, dotted or not", async () => {
    expect(await entry("work", "named")).toEqual(dates("2017-09", "2021-05"))
    expect(await entry("work", "named-dot")).toEqual(
      dates("2017-09", "2021-09")
    )
  })

  it("reads a month written in Spanish", async () => {
    expect((await entry("work", "spanish"))?.start_date).toBe("2017-09")
  })

  it("reads a numeric month in either order, and pads it", async () => {
    expect(await entry("work", "slashes")).toEqual(dates("2017-09", "2021-05"))
    expect(await entry("work", "reversed")).toEqual(dates("2017-09", "2021-05"))
    expect(await entry("work", "unpadded")).toEqual(dates("2017-09", "2021-05"))
  })

  it.each(["present", "now", "spanish"])(
    "moves the end date of %s into the flag",
    async (id) => {
      const row = await entry("work", id)

      expect(row?.current).toBe(true)
      expect(row?.end_date).toBe("")
    }
  )

  /**
   * An empty end date is deliberately *not* read as "still here". It is equally
   * the blank row the editor inserts and a field someone left off, and writing
   * "still attending" under a degree finished in 2020 is a false claim printed
   * on a document. The new validator asks the user which of the two it was.
   */
  it("does not read an empty end date as a current entry", async () => {
    expect(await entry("work", "blank-end")).toEqual(dates("2020-01", ""))
    expect(await entry("school", "no-end")).toEqual(dates("2016", ""))
  })

  /**
   * The fallback the spec asked to be decided deliberately. A date nobody can
   * read is kept exactly as the user typed it: the document still prints it
   * (the formatter falls back to the raw string), and the validator asks for a
   * correction the next time that field is written. A migration that quietly
   * blanks a date on a resume someone has already sent is the worst outcome
   * available here.
   */
  it("leaves a date it cannot read exactly as it was", async () => {
    expect(await entry("work", "unreadable")).toEqual(
      dates("2018 - 2020 (contract)", "summer 2020")
    )
  })

  it("holds a school to the same rules", async () => {
    expect(await entry("school", "graduated")).toEqual(
      dates("2016-09", "2020-05")
    )

    expect(await entry("school", "attending")).toEqual(
      dates("2022-01", "", true)
    )
  })

  /** The helper is scaffolding, and a migration does not leave any behind. */
  it("drops the parse function it created", async () => {
    const { rows } = await client.query(
      "SELECT 1 FROM pg_proc WHERE proname = 'apply_ai_normalize_resume_date'"
    )

    expect(rows).toHaveLength(0)
  })
})
