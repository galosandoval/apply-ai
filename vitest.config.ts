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
    exclude: ["e2e/**", "node_modules/**"]
  }
})
