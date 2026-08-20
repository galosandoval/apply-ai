/**
 * Migrations still apply on app boot — but at boot, not at module import.
 *
 * They used to run at the top of `~/server/db`, which meant `next build` opened
 * a connection while collecting page data: the image could not be built without
 * a reachable database, which is exactly backwards for a container build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const { migrate } = await import("drizzle-orm/node-postgres/migrator")
  const { db } = await import("~/server/db")

  await migrate(db, { migrationsFolder: "migrations" })
}
