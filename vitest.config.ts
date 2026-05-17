import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    exclude: ["node_modules/**", ".next/**", "dist/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      include: ["src/app/api/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      thresholds: {
        statements: 90,
        branches: 75,
        functions: 90,
        lines: 90,
      },
    },
  },
});
