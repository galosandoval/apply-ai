import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    BETTER_AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    /**
     * Origin the app is served from. better-auth signs callbacks against it,
     * and rejects any request whose `Origin` header differs — so this is the
     * exact scheme and host the browser lands on, no trailing slash, no path.
     * Never `VERCEL_URL`: that changes every deployment.
     */
    APP_URL: z.string().url(),
    OPENAI_API_KEY: z.string().min(1)
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string().min(1),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    APP_URL: process.env.APP_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
   * Never set it on a deployed host — it moves the failure to runtime.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION
})
