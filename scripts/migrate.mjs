/**
 * Applies pending migrations once per deploy.
 *
 * This used to run on boot, from `src/instrumentation.ts`. On a container that
 * is one process, once. On a serverless host it is once per cold start, and a
 * traffic spike cold-starts several concurrently — every one of them running
 * the migrator against the same database with no lock between them.
 *
 * Plain `.mjs` on purpose: it runs before the build, under whatever Node the
 * host provides, with no transpile step in front of it.
 *
 * Uses an unpooled connection. DDL through a transaction pooler is a known
 * source of trouble, so the unpooled URLs are preferred over `DATABASE_URL`
 * (which points at the pooled endpoint wherever a pooler exists).
 */
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

// The app loads `.env` through Next; this script has to ask for it.
if (!process.env.DATABASE_URL) {
  try {
    await import("dotenv/config")
  } catch {
    // Not installed in production images, where the env is already set.
  }
}

const connectionString =
  process.env.MIGRATION_DATABASE_URL ??
  // Both names the Neon integration may set for the unpooled endpoint.
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL

if (!connectionString) {
  console.error(
    "migrate: no connection string. Set MIGRATION_DATABASE_URL or DATABASE_URL."
  )
  process.exit(1)
}

const pool = new Pool({ connectionString, max: 1 })

try {
  await migrate(drizzle(pool), { migrationsFolder: "migrations" })
  console.log("migrate: up to date")
} catch (error) {
  console.error("migrate: failed", error)
  process.exitCode = 1
} finally {
  await pool.end()
}
