import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Pure-function tests only (no jsdom, no React Testing Library) — keeps the
// runner fast and the test surface deliberately scoped to logic/converters.
// Path aliases mirror tsconfig.json's `@/*` → `<repo>/*`.
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "out/**", "public/**"],
  },
});
