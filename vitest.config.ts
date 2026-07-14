import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/config/**/*.ts",
        "src/domain/workflow/**/*.ts",
        "src/server/log-record.ts",
        "src/server/runtime-config.schema.ts",
      ],
      exclude: ["src/**/*.test.ts"],
      thresholds: {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
});
