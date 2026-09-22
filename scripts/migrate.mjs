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
 *
 * This is also the first thing deployed, and it runs on its own, ahead of the
 * build — a build log has nothing else to say which database it touched. So
 * before migrating, it logs the host and database name it resolved from the
 * connection string. Never the full connection string: that carries the
 * password, and a build log is not somewhere a credential belongs.
 */
import { fileURLToPath } from "node:url"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

/**
 * `MIGRATION_DATABASE_URL`, then either name the Neon integration may set for
 * the unpooled endpoint, then the pooled `DATABASE_URL` last, because a local
 * `.env` has only that name. Takes the environment as an argument, rather than
 * reading `process.env` itself, so a test can drive every rung of this chain
 * without mutating the process.
 *
 * @param {Record<string, string | undefined>} env
 */
export function resolveConnectionString(env) {
  return (
    env.MIGRATION_DATABASE_URL ??
    env.DATABASE_URL_UNPOOLED ??
    env.POSTGRES_URL_NON_POOLING ??
    env.DATABASE_URL
  )
}

/**
 * Host and database name only — the two parts of a connection string that are
 * safe to log.
 *
 * @param {string} connectionString
 */
function describe(connectionString) {
  const url = new URL(connectionString)

  return `${url.hostname}${url.pathname}`
}

/**
 * Runs every pending migration in `migrations/` against `connectionString`.
 *
 * @param {string} connectionString
 */
export async function runMigration(connectionString) {
  console.log(`migrate: connecting to ${describe(connectionString)}`)

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
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // The app loads `.env` through Next; this script has to ask for it.
  if (!process.env.DATABASE_URL) {
    try {
      await import("dotenv/config")
    } catch {
      // Not installed in production images, where the env is already set.
    }
  }

  const connectionString = resolveConnectionString(process.env)

  if (!connectionString) {
    console.error(
      "migrate: no connection string. Set MIGRATION_DATABASE_URL or DATABASE_URL."
    )
    process.exit(1)
  }

  await runMigration(connectionString)
}
