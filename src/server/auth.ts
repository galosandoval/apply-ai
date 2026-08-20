import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { env } from "~/env"
import { db } from "~/server/db"
import * as schema from "~/server/db/schema"

/**
 * better-auth owns signup, sign-in and the session cookie.
 *
 * Passwords live on `account`, not on `user` — the old bcrypt column is gone
 * and was not migrated: there were no accounts to keep, and that made a
 * breaking auth change free exactly once.
 */
export const auth = betterAuth({
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification
    }
  }),

  emailAndPassword: {
    enabled: true,
    // Matches what the sign-up form has always accepted.
    minPasswordLength: 8,
    maxPasswordLength: 50,
    // No email provider in this spec, so there is nothing to verify against
    // and no reset flow to offer.
    requireEmailVerification: false
  },

  user: {
    additionalFields: {
      firstName: { type: "string", required: false, input: false },
      lastName: { type: "string", required: false, input: false },
      profession: { type: "string", required: false, input: false },
      introduction: { type: "string", required: false, input: false },
      interests: { type: "string", required: false, input: false }
    }
  },

  // Sets the session cookie from a route handler response.
  plugins: [nextCookies()]
})

export type Session = typeof auth.$Infer.Session

/**
 * The one way to read a session on the server.
 *
 * Takes `Headers` rather than a `Request` so a route handler (`req.headers`)
 * and a layout (`await headers()`) reach it the same way — otherwise each grows
 * its own call into better-auth.
 */
export function getServerAuthSession(headers: Headers) {
  return auth.api.getSession({ headers })
}
