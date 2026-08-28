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

  /**
   * Fly runs the standalone server; the Dockerfile copies `.next/standalone`.
   *
   * Not on Vercel: standalone moves the trace files, and Vercel's own build
   * step then fails looking for `.next/next-server.js.nft.json`. Vercel traces
   * the function itself, so the setting buys nothing there anyway.
   */
  output: process.env.VERCEL ? undefined : "standalone",

  transpilePackages: ["geist"],

  /**
   * Playwright resolves its own files at runtime (browsers.json, the driver),
   * and pdf-parse resolves its pdfjs worker by path off its own module URL.
   * Neither survives bundling — keep them external and ship the packages whole.
   */
  serverExternalPackages: [
    "playwright-core",
    "@sparticuz/chromium",
    "pdf-parse",
    "pdfjs-dist"
  ],

  outputFileTracingIncludes: {
    "/api/resume/pdf": [
      "./node_modules/playwright-core/**",
      /**
       * 67MB of compressed browser, and only Vercel needs it — the Fly image
       * has its own Chromium, and dragging this into `.next/standalone` would
       * be dead weight there. See `launch-print-browser.ts`.
       */
      ...(process.env.VERCEL ? ["./node_modules/@sparticuz/chromium/**"] : [])
    ],
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
