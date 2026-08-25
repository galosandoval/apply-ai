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
   * and pdf-parse resolves its pdfjs worker by path off its own module URL.
   * Neither survives bundling — keep them external and ship the packages whole.
   */
  serverExternalPackages: ["playwright-core", "pdf-parse", "pdfjs-dist"],

  outputFileTracingIncludes: {
    "/api/resume/pdf": ["./node_modules/playwright-core/**"],
    "/api/trpc/[trpc]": ["./node_modules/pdfjs-dist/legacy/build/**"]
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
