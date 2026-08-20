import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

/**
 * A second connection, used only by integration tests.
 *
 * `~/server/db` is deliberately not imported — not even for its types: it reads
 * `DATABASE_URL`, so pulling it into a test would point the test at the
 * development database.
 *
 * `TEST_DATABASE_URL` must point at a database whose rows are disposable —
 * `resetTestDatabase` deletes every row in the app's tables.
 */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL

export type TestDatabase = ReturnType<typeof drizzle<Record<string, never>>>

let connection: { db: TestDatabase; pool: Pool } | null = null

/** Connects and migrates once per process. */
export async function connectTestDatabase() {
  if (connection) return connection.db

  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL is not set")
  }

  const pool = new Pool({ connectionString: testDatabaseUrl })
  const db = drizzle(pool)

  await migrate(db, { migrationsFolder: "migrations" })

  connection = { db, pool }

  return db
}

export async function disconnectTestDatabase() {
  await connection?.pool.end()
  connection = null
}

/**
 * Empties the app's tables between tests. Truncating by name in one statement
 * keeps this independent of the foreign-key order, which the schema changes.
 */
export async function resetTestDatabase(db: TestDatabase) {
  await db.execute(
    sql.raw(`TRUNCATE TABLE
      "apply-ai_work",
      "apply-ai_school",
      "apply-ai_skill",
      "apply-ai_contact",
      "apply-ai_session",
      "apply-ai_account",
      "apply-ai_verification",
      "apply-ai_resume",
      "apply-ai_user"
     RESTART IDENTITY CASCADE`)
  )
}
