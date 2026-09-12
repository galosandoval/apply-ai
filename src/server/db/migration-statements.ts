import { readFile } from "node:fs/promises"

/**
 * The statements of a migration file, read out of the file that ships.
 *
 * A migration runs once, long before a test connects, so a test that wants to
 * assert what one does has to read it rather than be handed a connection it
 * already ran against. Retyping the SQL into the test is the one thing that
 * cannot be afforded: it would go on passing after the migration changed.
 *
 * `--> statement-breakpoint` is drizzle's own separator, written by
 * `drizzle-kit generate` and honoured by the migrator, so splitting on it gives
 * the same statements the migrator would run.
 *
 * Every statement comes back, comments and all. A test that runs only part of a
 * file — the backfill half of an expand-and-backfill, say — filters this list
 * itself, with `withoutComments` where the leading `--` block is in the way.
 */
export async function migrationStatements(file: string) {
  return splitStatements(await readFile(file, "utf8"))
}

/**
 * The same split, over SQL a caller already has in hand.
 *
 * For a test that runs one block of a migration rather than the file — the
 * backfill half of an expand-and-backfill, cut out by its marker before the
 * statements are separated.
 */
export function splitStatements(sql: string) {
  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)
}

/**
 * A statement with its `--` lines stripped, for deciding what it is.
 *
 * The migrations carry long rationale headers, so the first line of a statement
 * is rarely the SQL. Only ever used to classify a statement — never to run one,
 * which happens with the comments intact.
 */
export function withoutComments(statement: string) {
  return statement
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim()
}
