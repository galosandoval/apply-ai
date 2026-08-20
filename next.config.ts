/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env"
import type { NextConfig } from "next"

const config: NextConfig = {
  reactStrictMode: true,

  /** Next writes AGENTS.md / CLAUDE.md on dev boot otherwise. */
  agentRules: false,

  /** Fly runs the standalone server; the Dockerfile copies `.next/standalone`. */
  output: "standalone",

  transpilePackages: ["geist"],

  /**
   * Playwright resolves its own files at runtime (browsers.json, the driver),
   * which the bundler cannot see. Keep it external and ship the package whole.
   */
  serverExternalPackages: ["playwright-core"],

  outputFileTracingIncludes: {
    "/api/resume/pdf": ["./node_modules/playwright-core/**"]
  },

  redirects: async () => {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: false,
        has: [
          {
            type: "cookie",
            key: "better-auth.session_token"
          }
        ]
      }
    ]
  }
}

export default config
