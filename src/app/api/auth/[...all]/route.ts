import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "~/server/auth"

/** The drizzle adapter runs on a pg pool — never the edge runtime. */
export const runtime = "nodejs"

export const { GET, POST } = toNextJsHandler(auth)
