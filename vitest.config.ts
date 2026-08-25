import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

/**
 * Vite is a test-time devDependency only — the app is built by Next.js. This
 * config exists so `~/*` resolves and `.tsx` seams (the resume document) can be
 * rendered to markup from a test.
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Playwright owns `e2e/`; vitest would otherwise try to run those specs.
    exclude: ["e2e/**", "node_modules/**"],
    /**
     * One file at a time. Four test files drive the same `TEST_DATABASE_URL`,
     * and each truncates every table between its own cases — run in parallel
     * they delete each other's fixtures mid-test. Serialising is a couple of
     * seconds; a per-file schema would be the alternative, and is not worth it
     * at this size.
     */
    fileParallelism: false
  }
})
