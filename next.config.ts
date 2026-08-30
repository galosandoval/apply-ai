/** Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. */
import "./src/env"
import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const config: NextConfig = {
  reactStrictMode: true,

  /** Next writes AGENTS.md / CLAUDE.md on dev boot otherwise. */
  agentRules: false,

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
      /** The browser itself — `playwright-core` ships none. 67MB compressed. */
      "./node_modules/@sparticuz/chromium/**"
    ],
    /**
     * `/api/trpc/[trpc]` would be read as a glob — the brackets are a
     * character class, matching `/api/trpc/t` and nothing real. Hence `**`.
     */
    "/api/trpc/**": [
      "./node_modules/pdfjs-dist/legacy/build/**",
      /**
       * pdfjs `require`s `@napi-rs/canvas` inside a try/catch, so the tracer
       * never sees it and the function ships without it. It then fails to
       * polyfill `DOMMatrix`, which pdfjs constructs at module scope — the
       * import throws before any text is read. The second glob is the
       * platform-specific binary (`…-linux-x64-gnu` on the host that matters).
       */
      "./node_modules/@napi-rs/canvas/**",
      "./node_modules/@napi-rs/canvas-*/**"
    ]
  }
}

export default withNextIntl(config)
