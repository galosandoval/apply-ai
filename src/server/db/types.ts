import { type db } from "~/server/db"

export type Database = typeof db

/** The handle Drizzle hands to a `db.transaction(...)` callback. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0]

/**
 * Repositories accept this rather than importing `db` directly, so the same
 * function works standalone or inside a transaction opened by a service.
 */
export type DbOrTx = Database | Transaction
