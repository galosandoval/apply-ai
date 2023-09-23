import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { env } from "~/env.mjs"

// for migrations

// for query purposes
const queryClient = postgres(env.DATABASE_URL)
export const db: PostgresJsDatabase = drizzle(queryClient)
